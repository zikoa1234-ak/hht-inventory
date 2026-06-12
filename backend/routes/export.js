const { Router } = require('express');
const db = require('../db');

const router = Router();

// Helper: escape CSV field
function csvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// GET /api/export/positions/:id.csv — export single position
router.get('/positions/:id.csv', async (req, res) => {
  try {
    const pos = await db.query(
      `SELECT p.name AS position_name, pt.name AS template_name, s.name AS site_name
       FROM positions p
       JOIN sites s ON s.id = p.site_id
       JOIN position_templates pt ON pt.id = p.template_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (pos.rows.length === 0) return res.status(404).json({ error: 'Position not found' });

    const comps = await db.query(
      `SELECT pc.component_name, pc.custom_model, pc.serial_number, pc.asset_tag,
              pc.notes, pc.status, pc.item_status, pc.assigned_person, pc.updated_at, m.name AS model_name
       FROM position_components pc
       LEFT JOIN models m ON m.id = pc.model_id
       WHERE pc.position_id = $1
       ORDER BY pc.sort_order`,
      [req.params.id]
    );

    const headers = ['site', 'position', 'template', 'component', 'model', 'customModel',
                     'serialNumber', 'assetTag', 'notes', 'status', 'itemStatus', 'assignedPerson', 'updatedAt'];
    const rows = comps.rows.map(c => [
      csvField(pos.rows[0].site_name),
      csvField(pos.rows[0].position_name),
      csvField(pos.rows[0].template_name),
      csvField(c.component_name),
      csvField(c.model_name || ''),
      csvField(c.custom_model || ''),
      csvField(c.serial_number),
      csvField(c.asset_tag),
      csvField(c.notes),
      csvField(c.status),
      csvField(c.item_status || 'IN USE'),
      csvField(c.assigned_person || ''),
      csvField(c.updated_at),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="position_${req.params.id}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /export/positions/:id.csv error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/positions.csv — export all positions
router.get('/positions.csv', async (req, res) => {
  try {
    const { site_id, template_id } = req.query;

    let whereClause = '';
    const params = [];
    if (site_id) {
      whereClause += ' AND p.site_id = $1';
      params.push(site_id);
    }
    if (template_id) {
      whereClause += `${params.length === 0 ? ' AND' : ' AND'} p.template_id = $${params.length + 1}`;
      params.push(template_id);
    }

    const query = `
      SELECT s.name AS site_name, p.name AS position_name,
             pt.name AS template_name,
             pc.component_name, m.name AS model_name, pc.custom_model,
             pc.serial_number, pc.asset_tag, pc.notes, pc.status, pc.item_status,
             pc.assigned_person, pc.updated_at
      FROM position_components pc
      JOIN positions p ON p.id = pc.position_id
      JOIN sites s ON s.id = p.site_id
      JOIN position_templates pt ON pt.id = p.template_id
      LEFT JOIN models m ON m.id = pc.model_id
      WHERE 1=1 ${whereClause}
      ORDER BY s.name, p.name, pc.sort_order
    `;

    const { rows } = await db.query(query, params);

    const headers = ['site', 'position', 'template', 'component', 'model', 'customModel',
                     'serialNumber', 'assetTag', 'notes', 'status', 'itemStatus', 'assignedPerson', 'updatedAt'];
    const csvRows = rows.map(c => [
      csvField(c.site_name),
      csvField(c.position_name),
      csvField(c.template_name),
      csvField(c.component_name),
      csvField(c.model_name || ''),
      csvField(c.custom_model || ''),
      csvField(c.serial_number),
      csvField(c.asset_tag),
      csvField(c.notes),
      csvField(c.status),
      csvField(c.item_status || 'IN USE'),
      csvField(c.assigned_person || ''),
      csvField(c.updated_at),
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="all_positions.csv"');
    res.send(csv);
  } catch (err) {
    console.error('GET /export/positions.csv error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
