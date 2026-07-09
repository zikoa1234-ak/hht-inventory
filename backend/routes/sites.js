const { Router } = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// GET /api/sites — public (view only)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, assigned_person, created_by, created_at, updated_at FROM sites ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /sites error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sites — admin only
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, assigned_person } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Site name is required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO sites (name, assigned_person, created_by) VALUES ($1, $2, $3) RETURNING id, name, assigned_person, created_by, created_at, updated_at',
      [name.trim(), assigned_person || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Site already exists' });
    }
    console.error('POST /sites error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sites/:id — admin only
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, assigned_person } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Site name is required' });
  }
  try {
    const result = await db.query(
      'UPDATE sites SET name = $1, assigned_person = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, assigned_person, created_by, created_at, updated_at',
      [name.trim(), assigned_person || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Site name already exists' });
    }
    console.error('PUT /sites/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sites/:id — admin only (safe check: no positions)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Check for existing positions
    const count = await db.query(
      'SELECT COUNT(*)::int AS count FROM positions WHERE site_id = $1',
      [req.params.id]
    );
    if (count.rows[0].count > 0) {
      return res.status(400).json({
        error: `Cannot delete site with ${count.rows[0].count} existing position(s). Remove positions first.`
      });
    }
    const result = await db.query(
      'DELETE FROM sites WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json({ message: `Site "${result.rows[0].name}" deleted` });
  } catch (err) {
    console.error('DELETE /sites/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Site user assignment ─────────────────────────────────────

// GET /api/sites/:id/users — list users assigned to this site
router.get('/:id/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT user_id FROM user_sites WHERE site_id = $1',
      [req.params.id]
    );
    res.json(rows.map(r => r.user_id));
  } catch (err) {
    console.error('GET /sites/:id/users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sites/:id/users — add or remove a user from this site
router.post('/:id/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { user_id, action } = req.body;
  if (!user_id || !['add', 'remove'].includes(action)) {
    return res.status(400).json({ error: 'user_id and action ("add"/"remove") are required' });
  }
  try {
    if (action === 'add') {
      await db.query(
        'INSERT INTO user_sites (user_id, site_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [user_id, req.params.id, req.user.id]
      );
    } else {
      await db.query(
        'DELETE FROM user_sites WHERE user_id = $1 AND site_id = $2',
        [user_id, req.params.id]
      );
    }
    res.json({ message: `User ${action === 'add' ? 'added to' : 'removed from'} site` });
  } catch (err) {
    console.error('POST /sites/:id/users error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;