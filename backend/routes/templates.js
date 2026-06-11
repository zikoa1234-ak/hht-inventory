const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pt.id, pt.name, pt.created_at, pt.updated_at,
              COUNT(tc.id)::int AS component_count
       FROM position_templates pt
       LEFT JOIN template_components tc ON tc.template_id = pt.id
       GROUP BY pt.id
       ORDER BY pt.name`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /templates error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/templates/:id — with components
router.get('/:id', async (req, res) => {
  try {
    const tpl = await db.query(
      'SELECT id, name, created_at, updated_at FROM position_templates WHERE id = $1',
      [req.params.id]
    );
    if (tpl.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const comps = await db.query(
      'SELECT id, component_name, sort_order FROM template_components WHERE template_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ ...tpl.rows[0], components: comps.rows });
  } catch (err) {
    console.error('GET /templates/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/templates
router.post('/', async (req, res) => {
  const { name, components } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Template name is required' });
  }
  try {
    const tpl = await db.query(
      'INSERT INTO position_templates (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
      [name.trim()]
    );
    const templateId = tpl.rows[0].id;

    if (Array.isArray(components) && components.length > 0) {
      for (let i = 0; i < components.length; i++) {
        await db.query(
          'INSERT INTO template_components (template_id, component_name, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [templateId, components[i].name || components[i], i + 1]
        );
      }
    }

    // Return full template
    const comps = await db.query(
      'SELECT id, component_name, sort_order FROM template_components WHERE template_id = $1 ORDER BY sort_order',
      [templateId]
    );
    res.status(201).json({ ...tpl.rows[0], components: comps.rows });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Template name already exists' });
    }
    console.error('POST /templates error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/templates/:id — update name and/or components
router.put('/:id', async (req, res) => {
  const { name, components } = req.body;
  try {
    // Update name if provided
    if (name && name.trim()) {
      await db.query(
        'UPDATE position_templates SET name = $1, updated_at = NOW() WHERE id = $2',
        [name.trim(), req.params.id]
      );
    }

    // Replace components if provided
    if (Array.isArray(components)) {
      await db.query('DELETE FROM template_components WHERE template_id = $1', [req.params.id]);
      for (let i = 0; i < components.length; i++) {
        await db.query(
          'INSERT INTO template_components (template_id, component_name, sort_order) VALUES ($1, $2, $3)',
          [req.params.id, components[i].name || components[i], i + 1]
        );
      }
    }

    // Mark template as updated
    await db.query('UPDATE position_templates SET updated_at = NOW() WHERE id = $1', [req.params.id]);

    const tpl = await db.query(
      'SELECT id, name, created_at, updated_at FROM position_templates WHERE id = $1',
      [req.params.id]
    );
    if (tpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const comps = await db.query(
      'SELECT id, component_name, sort_order FROM template_components WHERE template_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ ...tpl.rows[0], components: comps.rows });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Template name already exists' });
    }
    console.error('PUT /templates/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM position_templates WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('DELETE /templates/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/templates/:id/components — add single component
router.post('/:id/components', async (req, res) => {
  const { component_name } = req.body;
  if (!component_name || !component_name.trim()) {
    return res.status(400).json({ error: 'Component name is required' });
  }
  try {
    // Get max sort_order
    const maxOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM template_components WHERE template_id = $1',
      [req.params.id]
    );
    const result = await db.query(
      'INSERT INTO template_components (template_id, component_name, sort_order) VALUES ($1, $2, $3) RETURNING id, component_name, sort_order',
      [req.params.id, component_name.trim(), maxOrder.rows[0].next_order]
    );
    await db.query('UPDATE position_templates SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Component already exists in this template' });
    }
    console.error('POST /templates/:id/components error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;