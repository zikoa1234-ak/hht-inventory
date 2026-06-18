const { Router } = require('express');
const db = require('../db');

const router = Router();

// Helper: compute status based on serial + asset tag
function computeStatus(serialNumber, assetTag) {
  const sn = serialNumber && serialNumber.trim();
  const at = assetTag && assetTag.trim();
  if (!sn && !at) return 'missing';
  if (sn && at) return 'complete';
  return 'partial';
}

// GET /api/positions — list all positions with summary
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.site_id, p.template_id, p.created_at, p.updated_at,
              s.name AS site_name,
              pt.name AS template_name,
              COUNT(pc.id)::int AS total_components,
              COUNT(CASE WHEN pc.status = 'complete' THEN 1 END)::int AS completed_components,
              COUNT(CASE WHEN pc.status = 'partial' THEN 1 END)::int AS partial_components,
              COUNT(CASE WHEN pc.status = 'missing' THEN 1 END)::int AS missing_components
       FROM positions p
       JOIN sites s ON s.id = p.site_id
       JOIN position_templates pt ON pt.id = p.template_id
       LEFT JOIN position_components pc ON pc.position_id = p.id
       GROUP BY p.id, s.name, pt.name
       ORDER BY s.name, p.name`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /positions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/positions — create position from template
router.post('/', async (req, res) => {
  const { site_id, template_id, name } = req.body;
  if (!site_id || !template_id || !name || !name.trim()) {
    return res.status(400).json({ error: 'site_id, template_id, and name are required' });
  }
  try {
    // Create position
    const pos = await db.query(
      'INSERT INTO positions (site_id, template_id, name) VALUES ($1, $2, $3) RETURNING id, site_id, template_id, name, created_at, updated_at',
      [site_id, template_id, name.trim()]
    );
    const positionId = pos.rows[0].id;

    // Copy template components into position_components
    const tc = await db.query(
      'SELECT component_name, sort_order FROM template_components WHERE template_id = $1 ORDER BY sort_order',
      [template_id]
    );

    for (const comp of tc.rows) {
      await db.query(
        `INSERT INTO position_components (position_id, component_name, sort_order, status, item_status)
         VALUES ($1, $2, $3, 'missing', 'IN USE')`,
        [positionId, comp.component_name, comp.sort_order]
      );
    }

    // Create initial session
    await db.query(
      'INSERT INTO scan_sessions (position_id) VALUES ($1)',
      [positionId]
    );

    // Return full position
    const full = await db.query(
      `SELECT p.*, s.name AS site_name, pt.name AS template_name
       FROM positions p
       JOIN sites s ON s.id = p.site_id
       JOIN position_templates pt ON pt.id = p.template_id
       WHERE p.id = $1`,
      [positionId]
    );
    const comps = await db.query(
      'SELECT * FROM position_components WHERE position_id = $1 ORDER BY sort_order',
      [positionId]
    );
    res.status(201).json({ ...full.rows[0], components: comps.rows });

    // Log component creation in history
    for (const comp of tc.rows) {
      await db.query(
        `INSERT INTO component_history (component_id, field_name, old_value, new_value, changed_by)
         VALUES ((SELECT id FROM position_components WHERE position_id = $1 AND component_name = $2), 'created', NULL, 'init', 'system')`,
        [positionId, comp.component_name]
      );
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Position already exists at this site' });
    }
    console.error('POST /positions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/positions/:id — single position with components
router.get('/:id', async (req, res) => {
  try {
    const pos = await db.query(
      `SELECT p.*, s.name AS site_name, pt.name AS template_name
       FROM positions p
       JOIN sites s ON s.id = p.site_id
       JOIN position_templates pt ON pt.id = p.template_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (pos.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    const comps = await db.query(
      `SELECT pc.*, m.name AS model_name
       FROM position_components pc
       LEFT JOIN models m ON m.id = pc.model_id
       WHERE pc.position_id = $1
       ORDER BY pc.sort_order`,
      [req.params.id]
    );
    const session = await db.query(
      'SELECT * FROM scan_sessions WHERE position_id = $1 AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1',
      [req.params.id]
    );
    res.json({
      ...pos.rows[0],
      components: comps.rows,
      active_session: session.rows[0] || null,
    });
  } catch (err) {
    console.error('GET /positions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/positions/:id — update position basic info
router.put('/:id', async (req, res) => {
  const { name, site_id } = req.body;
  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (name && name.trim()) {
      updates.push(`name = $${idx++}`);
      params.push(name.trim());
    }
    if (site_id) {
      updates.push(`site_id = $${idx++}`);
      params.push(site_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    await db.query(
      `UPDATE positions SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );

    const pos = await db.query(
      `SELECT p.*, s.name AS site_name, pt.name AS template_name
       FROM positions p
       JOIN sites s ON s.id = p.site_id
       JOIN position_templates pt ON pt.id = p.template_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    res.json(pos.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Position name already exists at this site' });
    }
    console.error('PUT /positions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/positions/:id/template — safely change template
router.patch('/:id/template', async (req, res) => {
  const { template_id } = req.body;
  if (!template_id) {
    return res.status(400).json({ error: 'template_id is required' });
  }
  try {
    // Get existing components
    const existing = await db.query(
      'SELECT * FROM position_components WHERE position_id = $1',
      [req.params.id]
    );
    const existingMap = new Map(existing.rows.map(c => [c.component_name, c]));

    // Get new template components
    const newComps = await db.query(
      'SELECT component_name, sort_order FROM template_components WHERE template_id = $1 ORDER BY sort_order',
      [template_id]
    );

    // Safe merge:
    // 1. Keep existing components that match by name
    // 2. Add missing components from new template
    // 3. Keep removed template components as "extra" (don't delete)
    for (const comp of newComps.rows) {
      if (!existingMap.has(comp.component_name)) {
        // New component — add it
        await db.query(
          `INSERT INTO position_components (position_id, component_name, sort_order, status, item_status)
           VALUES ($1, $2, $3, 'missing', 'IN USE')`,
          [req.params.id, comp.component_name, comp.sort_order]
        );
      } else {
        // Existing — just update sort order
        await db.query(
          'UPDATE position_components SET sort_order = $1 WHERE id = $2',
          [comp.sort_order, existingMap.get(comp.component_name).id]
        );
      }
    }

    // Mark remaining (removed from template) as extra components
    const newNames = new Set(newComps.rows.map(c => c.component_name));
    for (const [name, comp] of existingMap) {
      if (!newNames.has(name)) {
        await db.query(
          'UPDATE position_components SET is_extra_component = TRUE WHERE id = $1',
          [comp.id]
        );
      }
    }

    // Update position's template
    await db.query(
      'UPDATE positions SET template_id = $1, updated_at = NOW() WHERE id = $2',
      [template_id, req.params.id]
    );

    // Return updated position
    const pos = await db.query(
      `SELECT p.*, s.name AS site_name, pt.name AS template_name
       FROM positions p
       JOIN sites s ON s.id = p.site_id
       JOIN position_templates pt ON pt.id = p.template_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    const comps = await db.query(
      `SELECT pc.*, m.name AS model_name
       FROM position_components pc
       LEFT JOIN models m ON m.id = pc.model_id
       WHERE pc.position_id = $1
       ORDER BY pc.sort_order`,
      [req.params.id]
    );
    res.json({ ...pos.rows[0], components: comps.rows });
  } catch (err) {
    console.error('PATCH /positions/:id/template error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/positions/:id/components
router.get('/:id/components', async (req, res) => {
  try {
    const comps = await db.query(
      `SELECT pc.*, m.name AS model_name
       FROM position_components pc
       LEFT JOIN models m ON m.id = pc.model_id
       WHERE pc.position_id = $1
       ORDER BY pc.sort_order`,
      [req.params.id]
    );
    res.json(comps.rows);
  } catch (err) {
    console.error('GET /positions/:id/components error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/positions/:id/components — add extra manual component
router.post('/:id/components', async (req, res) => {
  const { component_name } = req.body;
  if (!component_name || !component_name.trim()) {
    return res.status(400).json({ error: 'Component name is required' });
  }
  try {
    const maxOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM position_components WHERE position_id = $1',
      [req.params.id]
    );
    const result = await db.query(
      `INSERT INTO position_components (position_id, component_name, sort_order, status, is_extra_component, item_status)
       VALUES ($1, $2, $3, 'missing', TRUE, 'IN USE')
       RETURNING *`,
      [req.params.id, component_name.trim(), maxOrder.rows[0].next_order]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Duplicate component name' });
    }
    console.error('POST /positions/:id/components error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/position-components/:id — update a single component's data
router.put('/components/:id', async (req, res) => {
  const { component_name, model_id, custom_model, serial_number, asset_tag, notes, updated_by, item_status, assigned_person } = req.body;

  // Build dynamic update
  const fields = {};
  if (component_name !== undefined) fields.component_name = component_name;
  if (model_id !== undefined) fields.model_id = model_id === '' ? null : model_id;
  if (custom_model !== undefined) fields.custom_model = custom_model || null;
  if (serial_number !== undefined) fields.serial_number = serial_number || null;
  if (asset_tag !== undefined) fields.asset_tag = asset_tag || null;
  if (notes !== undefined) fields.notes = notes || null;
  if (updated_by !== undefined) fields.updated_by = updated_by;
  if (assigned_person !== undefined) fields.assigned_person = assigned_person || null;
  if (item_status !== undefined) {
    // Validate allowed values
    const allowed = ['IN USE', 'IN STOCK', 'FAULTY'];
    if (!allowed.includes(item_status)) {
      return res.status(400).json({ error: 'item_status must be one of: IN USE, IN STOCK, FAULTY' });
    }
    fields.item_status = item_status;
  }

  // Always recompute status from latest serial + asset
  // We need the existing values if not being changed
  try {
    if (serial_number !== undefined || asset_tag !== undefined) {
      const existing = await db.query('SELECT serial_number, asset_tag FROM position_components WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Component not found' });
      const sn = serial_number !== undefined ? serial_number : existing.rows[0].serial_number;
      const at = asset_tag !== undefined ? asset_tag : existing.rows[0].asset_tag;
      fields.status = computeStatus(sn, at);
    }

    // Duplicate serial check: global (exclude self)
    if (serial_number !== undefined && serial_number && serial_number.trim()) {
      const dupCheck = await db.query(
        `SELECT id FROM position_components
         WHERE serial_number = $1 AND serial_number IS NOT NULL AND serial_number != '' AND id != $2 LIMIT 1`,
        [serial_number.trim(), req.params.id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This serial number is duplicated' });
      }
    }

    // Duplicate asset tag check: global (exclude self)
    if (asset_tag !== undefined && asset_tag && asset_tag.trim()) {
      const dupCheck = await db.query(
        `SELECT id FROM position_components
         WHERE asset_tag = $1 AND asset_tag IS NOT NULL AND asset_tag != '' AND id != $2 LIMIT 1`,
        [asset_tag.trim(), req.params.id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This asset tag is duplicated' });
      }
    }

    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${idx++}`);
      params.push(value);
    }
    setClauses.push(`updated_at = NOW()`);

    params.push(req.params.id);
    const result = await db.query(
      `UPDATE position_components SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Log to history for tracked fields
    if (serial_number !== undefined || asset_tag !== undefined || model_id !== undefined || custom_model !== undefined) {
      const changedBy = updated_by || 'user';
      const logEntries = [];
      if (serial_number !== undefined) {
        logEntries.push({ field: 'serial_number', old: null, new: serial_number });
      }
      if (asset_tag !== undefined) {
        logEntries.push({ field: 'asset_tag', old: null, new: asset_tag });
      }

      for (const entry of logEntries) {
        await db.query(
          `INSERT INTO component_history (component_id, field_name, old_value, new_value, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, entry.field, entry.old, entry.new, changedBy]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Duplicate component name' });
    }
    console.error('PUT /position-components/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/position-components/:id
router.delete('/components/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM position_components WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }
    res.json({ message: 'Component deleted' });
  } catch (err) {
    console.error('DELETE /position-components/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/positions/:id/init-from-template — initialize position_components from template if empty
router.post('/:id/init-from-template', async (req, res) => {
  try {
    const positionId = req.params.id;

    // Get position to find template_id
    const pos = await db.query(
      'SELECT id, template_id FROM positions WHERE id = $1',
      [positionId]
    );
    if (pos.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    const templateId = pos.rows[0].template_id;

    // Check if position already has components
    const existingCount = await db.query(
      'SELECT COUNT(*)::int AS count FROM position_components WHERE position_id = $1',
      [positionId]
    );

    if (existingCount.rows[0].count === 0) {
      // Copy template components into position_components
      const tc = await db.query(
        'SELECT component_name, sort_order FROM template_components WHERE template_id = $1 ORDER BY sort_order',
        [templateId]
      );

      for (const comp of tc.rows) {
        await db.query(
          `INSERT INTO position_components (position_id, component_name, sort_order, status, item_status)
           VALUES ($1, $2, $3, 'missing', 'IN USE')`,
          [positionId, comp.component_name, comp.sort_order]
        );
      }

      // Log initialization in history
      for (const comp of tc.rows) {
        await db.query(
          `INSERT INTO component_history (component_id, field_name, old_value, new_value, changed_by)
           VALUES ((SELECT id FROM position_components WHERE position_id = $1 AND component_name = $2), 'created', NULL, 'init', 'system')`,
          [positionId, comp.component_name]
        );
      }
    }

    // Return full position with components
    const full = await db.query(
      `SELECT p.*, s.name AS site_name, pt.name AS template_name
       FROM positions p
       JOIN sites s ON s.id = p.site_id
       JOIN position_templates pt ON pt.id = p.template_id
       WHERE p.id = $1`,
      [positionId]
    );
    const comps = await db.query(
      `SELECT pc.*, m.name AS model_name
       FROM position_components pc
       LEFT JOIN models m ON m.id = pc.model_id
       WHERE pc.position_id = $1
       ORDER BY pc.sort_order`,
      [positionId]
    );
    const session = await db.query(
      'SELECT * FROM scan_sessions WHERE position_id = $1 AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1',
      [positionId]
    );
    res.json({
      ...full.rows[0],
      components: comps.rows,
      active_session: session.rows[0] || null,
    });
  } catch (err) {
    console.error('POST /positions/:id/init-from-template error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;