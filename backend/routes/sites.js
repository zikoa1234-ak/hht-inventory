const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/sites
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, created_at, updated_at FROM sites ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /sites error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sites
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Site name is required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO sites (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
      [name.trim()]
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

module.exports = router;