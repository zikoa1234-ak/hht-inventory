/**
 * Admin Routes — dashboard stats, user management, position assignment
 */
const { Router } = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/stats — dashboard overview
router.get('/stats', async (req, res) => {
  try {
    const [sites, templates, positions, components, users, sessions, models] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM sites'),
      db.query('SELECT COUNT(*)::int AS count FROM position_templates'),
      db.query('SELECT COUNT(*)::int AS count FROM positions'),
      db.query('SELECT COUNT(*)::int AS count FROM position_components'),
      db.query('SELECT COUNT(*)::int AS count FROM users'),
      db.query('SELECT COUNT(*)::int AS count FROM scan_sessions'),
      db.query('SELECT COUNT(*)::int AS count FROM models'),
    ]);

    // Get recent activity — last 10 component updates
    const recentActivity = await db.query(`
      SELECT pc.id, pc.component_name, pc.serial_number, pc.asset_tag,
             pc.updated_at, pc.updated_by, p.name AS position_name,
             s.name AS site_name
      FROM position_components pc
      JOIN positions p ON p.id = pc.position_id
      JOIN sites s ON s.id = p.site_id
      WHERE pc.updated_at IS NOT NULL
      ORDER BY pc.updated_at DESC
      LIMIT 10
    `);

    // Get component status breakdown
    const statusBreakdown = await db.query(`
      SELECT status, COUNT(*)::int AS count
      FROM position_components
      GROUP BY status
      ORDER BY status
    `);

    res.json({
      counts: {
        sites: sites.rows[0].count,
        templates: templates.rows[0].count,
        positions: positions.rows[0].count,
        components: components.rows[0].count,
        users: users.rows[0].count,
        sessions: sessions.rows[0].count,
        models: models.rows[0].count,
      },
      statusBreakdown: statusBreakdown.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    console.error('GET /admin/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, username, role, created_at, updated_at FROM users ORDER BY username'
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /admin/users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/role — change user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['admin', 'user'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Role must be one of: admin, user' });
    }

    // Prevent self-demotion from admin
    if (parseInt(req.params.id) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    const result = await db.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role, updated_at',
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /admin/users/:id/role error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id — delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent self-deletion
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: `User "${result.rows[0].username}" deleted` });
  } catch (err) {
    console.error('DELETE /admin/users/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Position assignment ──────────────────────────────────────────

// GET /api/admin/users/:id/positions — get assigned positions for a user
router.get('/users/:id/positions', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT up.id, up.position_id, up.created_at AS assigned_at,
             p.name AS position_name, s.name AS site_name, s.id AS site_id
      FROM user_positions up
      JOIN positions p ON p.id = up.position_id
      JOIN sites s ON s.id = p.site_id
      WHERE up.user_id = $1
      ORDER BY s.name, p.name
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('GET /admin/users/:id/positions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/positions — replace assigned positions for a user
router.put('/users/:id/positions', async (req, res) => {
  const { position_ids } = req.body;
  if (!Array.isArray(position_ids)) {
    return res.status(400).json({ error: 'position_ids array is required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Remove all existing assignments
    await client.query('DELETE FROM user_positions WHERE user_id = $1', [req.params.id]);
    // Insert new assignments
    for (const pid of position_ids) {
      await client.query(
        'INSERT INTO user_positions (user_id, position_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [req.params.id, pid, req.user.id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: `Assigned ${position_ids.length} position(s) to user` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /admin/users/:id/positions error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;