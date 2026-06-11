const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/sessions/:positionId — get active session for position
router.get('/:positionId', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM scan_sessions
       WHERE position_id = $1
       ORDER BY started_at DESC
       LIMIT 20`,
      [req.params.positionId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /sessions/:positionId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions — start/update a session
router.post('/', async (req, res) => {
  const { position_id, completed, completed_by } = req.body;
  if (!position_id) {
    return res.status(400).json({ error: 'position_id is required' });
  }
  try {
    if (completed) {
      // Close active session
      const { rows } = await db.query(
        `UPDATE scan_sessions
         SET completed_at = NOW(), completed_by = $1
         WHERE position_id = $2 AND completed_at IS NULL
         RETURNING *`,
        [completed_by || null, position_id]
      );
      return res.json(rows[0] || { message: 'No active session to close' });
    }

    // Start new session
    const { rows } = await db.query(
      'INSERT INTO scan_sessions (position_id) VALUES ($1) RETURNING *',
      [position_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;