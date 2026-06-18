const { Router } = require('express');
const db = require('../db');

const router = Router();

// Allowed status values for the new asset workflow
const ALLOWED_ASSET_STATUSES = ['Active', 'In Repair', 'In Stock', 'Retired'];

// Helper: get or create a catch-all position for a location+area combo
async function ensurePosition(location, area) {
  // Map area name to template name (they're the same)
  const posName = location + ' - ' + area + ' - Area';
  let result = await db.query(
    'SELECT id FROM positions WHERE name = $1',
    [posName]
  );
  if (result.rows.length > 0) {
    return result.rows[0].id;
  }
  // Find site_id and template_id
  const site = await db.query('SELECT id FROM sites WHERE name = $1', [location]);
  const tpl = await db.query('SELECT id FROM position_templates WHERE name = $1', [area]);
  if (site.rows.length === 0 || tpl.rows.length === 0) {
    return null;
  }
  result = await db.query(
    'INSERT INTO positions (site_id, template_id, name) VALUES ($1, $2, $3) RETURNING id',
    [site.rows[0].id, tpl.rows[0].id, posName]
  );
  return result.rows[0].id;
}

// GET /api/assets — list assets with filtering
router.get('/', async (req, res) => {
  try {
    const { location, area, search, assigned_person, asset_status } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (location) {
      conditions.push(`pc.location = $${idx++}`);
      params.push(location);
    }
    if (area) {
      conditions.push(`pc.area = $${idx++}`);
      params.push(area);
    }
    if (search) {
      conditions.push(`(pc.asset_name ILIKE $${idx} OR pc.serial_number ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (assigned_person) {
      conditions.push(`pc.assigned_person = $${idx++}`);
      params.push(assigned_person);
    }
    if (asset_status) {
      conditions.push(`pc.asset_status = $${idx++}`);
      params.push(asset_status);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT pc.id, pc.location, pc.area, pc.asset_name, pc.box,
             pc.serial_number, pc.assigned_person, pc.asset_status,
             pc.notes, pc.created_at, pc.updated_at,
             pc.component_name
      FROM position_components pc
      ${whereClause}
      ORDER BY pc.updated_at DESC NULLS LAST, pc.id DESC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error('GET /assets error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assets/check-serial — lightweight duplicate check for real-time validation
router.get('/check-serial', async (req, res) => {
  try {
    const { serial, exclude_id } = req.query;
    if (!serial || !serial.trim()) {
      return res.json({ exists: false });
    }
    let query;
    let params;
    if (exclude_id) {
      query = 'SELECT id FROM position_components WHERE serial_number = $1 AND serial_number IS NOT NULL AND serial_number != \'\' AND id != $2 LIMIT 1';
      params = [serial.trim(), exclude_id];
    } else {
      query = 'SELECT id FROM position_components WHERE serial_number = $1 AND serial_number IS NOT NULL AND serial_number != \'\' LIMIT 1';
      params = [serial.trim()];
    }
    const { rows } = await db.query(query, params);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error('GET /assets/check-serial error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assets/check-asset-tag — lightweight duplicate check for asset tags
router.get('/check-asset-tag', async (req, res) => {
  try {
    const { tag, exclude_id } = req.query;
    if (!tag || !tag.trim()) {
      return res.json({ exists: false });
    }
    let query;
    let params;
    if (exclude_id) {
      query = 'SELECT id FROM position_components WHERE asset_tag = $1 AND asset_tag IS NOT NULL AND asset_tag != \'\' AND id != $2 LIMIT 1';
      params = [tag.trim(), exclude_id];
    } else {
      query = 'SELECT id FROM position_components WHERE asset_tag = $1 AND asset_tag IS NOT NULL AND asset_tag != \'\' LIMIT 1';
      params = [tag.trim()];
    }
    const { rows } = await db.query(query, params);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error('GET /assets/check-asset-tag error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assets — create a new asset
router.post('/', async (req, res) => {
  try {
    const { location, area, position, box, asset_name, serial_number, asset_tag, assigned_person, asset_status, notes } = req.body;

    // Validate required fields
    if (!location || !area || !position || !asset_name || !serial_number) {
      return res.status(400).json({
        error: 'Required fields: location, area, position, asset_name, serial_number'
      });
    }

    // Validate asset_status if provided
    if (asset_status && !ALLOWED_ASSET_STATUSES.includes(asset_status)) {
      return res.status(400).json({
        error: 'asset_status must be one of: ' + ALLOWED_ASSET_STATUSES.join(', ')
      });
    }

    // Duplicate serial check: global — any existing S/N blocks insert
    const dupCheck = await db.query(
      'SELECT id FROM position_components WHERE serial_number = $1 AND serial_number IS NOT NULL AND serial_number != \'\'',
      [serial_number]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This serial number is duplicated' });
    }

    // Duplicate asset tag check: global
    if (asset_tag && asset_tag.trim()) {
      const dupTagCheck = await db.query(
        'SELECT id FROM position_components WHERE asset_tag = $1 AND asset_tag IS NOT NULL AND asset_tag != \'\'',
        [asset_tag.trim()]
      );
      if (dupTagCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This asset tag is duplicated' });
      }
    }

    // Get or create the catch-all position for FK
    const positionId = await ensurePosition(location, area);
    if (!positionId) {
      return res.status(400).json({
        error: 'Invalid location or area — no matching site or template found'
      });
    }

    const result = await db.query(`
      INSERT INTO position_components
        (position_id, component_name, location, area, asset_name, box,
         serial_number, asset_tag, assigned_person, asset_status, notes, status, sort_order, item_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'complete', 0, 'IN USE')
      RETURNING id, location, area, asset_name, box, serial_number, asset_tag,
                assigned_person, asset_status, notes, updated_at
    `, [
      positionId,
      position || 'Asset',
      location,
      area,
      asset_name,
      box || null,
      serial_number,
      asset_tag || null,
      assigned_person || null,
      asset_status || 'Active',
      notes || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This serial number is duplicated' });
    }
    console.error('POST /assets error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/assets/:id — update an existing asset
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { position, box, asset_name, serial_number, asset_tag, assigned_person, asset_status, notes, location, area } = req.body;

    // Check asset exists
    const existing = await db.query('SELECT * FROM position_components WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Validate asset_status if provided
    if (asset_status && !ALLOWED_ASSET_STATUSES.includes(asset_status)) {
      return res.status(400).json({
        error: 'asset_status must be one of: ' + ALLOWED_ASSET_STATUSES.join(', ')
      });
    }

    // Duplicate serial check: global (exclude self)
    if (serial_number) {
      const dupCheck = await db.query(
        `SELECT id FROM position_components
         WHERE serial_number = $1 AND serial_number IS NOT NULL AND serial_number != '' AND id != $2`,
        [serial_number, id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This serial number is duplicated' });
      }
    }

    // Duplicate asset tag check: global (exclude self)
    if (asset_tag && asset_tag.trim()) {
      const dupTagCheck = await db.query(
        `SELECT id FROM position_components
         WHERE asset_tag = $1 AND asset_tag IS NOT NULL AND asset_tag != '' AND id != $2`,
        [asset_tag.trim(), id]
      );
      if (dupTagCheck.rows.length > 0) {
        return res.status(409).json({ error: 'This asset tag is duplicated' });
      }
    }

    const fields = {};
    if (location !== undefined) fields.location = location;
    if (area !== undefined) fields.area = area;
    if (position !== undefined) {
      fields.component_name = position;
      // Also update the component_name field
    }
    if (box !== undefined) fields.box = box || null;
    if (asset_name !== undefined) fields.asset_name = asset_name;
    if (serial_number !== undefined) fields.serial_number = serial_number;
    if (asset_tag !== undefined) fields.asset_tag = asset_tag || null;
    if (assigned_person !== undefined) fields.assigned_person = assigned_person || null;
    if (asset_status !== undefined) fields.asset_status = asset_status;
    if (notes !== undefined) fields.notes = notes || null;

    const setClauses = [];
    const params = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${paramIdx++}`);
      params.push(value);
    }
    setClauses.push('updated_at = NOW()');

    if (setClauses.length === 1) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    params.push(id);
    const result = await db.query(`
      UPDATE position_components
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING id, location, area, asset_name, box, serial_number,
                assigned_person, asset_status, notes, updated_at
    `, params);

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This serial number is duplicated' });
    }
    console.error('PUT /assets/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assets/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM position_components WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ message: 'Asset deleted' });
  } catch (err) {
    console.error('DELETE /assets/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assets/people — return the assigned people list
router.get('/people', async (req, res) => {
  // Return the known people list so the frontend can load it dynamically
  // This avoids hardcoding 44 names in both frontend and backend
  const people = [
    "AITSIAHMAD ABDELHADI", "HIZMI ABDELHAKIM", "BENKASSOU ABDELHAMID",
    "ASSOUFID ABDELLATIF", "ZOUINE ACHRAF", "MASBAHI AHMED", "ABSSA ALI",
    "CHARMOUH ALI", "BELAYACHE AMINE", "GHANAJ ANASS", "ZIZI ATMANE",
    "AITBENADDI AYMANE", "AKHSAS AYOUB", "CHELLAK AYOUB", "KACEM AYOUB",
    "AMINE BOUDLEL", "MOUHSSINE CHEHLAFI", "OUCHEN CHOUAIB",
    "MECHOUDI ELMOATASSEM", "ARBAOUI FARID", "HIBA FAYCAL",
    "HAMDANI HOSSAME", "RAJID ISSAM", "BENKADDOUR KAMAL",
    "AMDA LHOUSSAINE", "CHEGRANI MOHAMED", "CHERAKOUI MOHAMED",
    "TARBOUCHI MOHAMED", "ALICHAR MOUHCINE", "JNIAH MOUNSSIF",
    "ARFAL MUSTAPHA", "ZOUINE NABIL", "KOUTARI NOUAMANE", "KARAM OMAR",
    "GUIR RACHID", "HAMDAOUI REDOUANE", "LAASRI REDOUANE", "DARNAG SAAD",
    "TAHIRI TARIK", "ESSAIH YASSINE", "CHARMOUH YOUNESS",
    "ELHADDOUCHI ZAKARIAE", "WERARI ZAKARIAE", "JERRARI ZOUHEIR"
  ];
  res.json(people);
});

module.exports = router;