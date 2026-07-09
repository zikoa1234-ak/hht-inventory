const { Router } = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// GET /api/sites — public (view only)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, created_by, created_at, updated_at FROM sites ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /sites error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sites — admin only
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Site name is required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO sites (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, created_at, updated_at',
      [name.trim(), req.user.id]
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
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Site name is required' });
  }
  try {
    const result = await db.query(
      'UPDATE sites SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, created_by, created_at, updated_at',
      [name.trim(), req.params.id]
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

module.exports = router;