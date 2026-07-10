const { Router } = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// GET /api/people — return all unique person names across all sites
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT DISTINCT person_name FROM site_people ORDER BY person_name'
    );
    res.json(rows.map(r => r.person_name));
  } catch (err) {
    console.error('GET /people error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;