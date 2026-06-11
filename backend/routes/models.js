const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/models
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, created_at FROM models ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('GET /models error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/models
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Model name is required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO models (name) VALUES ($1) RETURNING id, name, created_at',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Model already exists' });
    }
    console.error('POST /models error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/models/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM models WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json({ message: 'Model deleted' });
  } catch (err) {
    console.error('DELETE /models/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;