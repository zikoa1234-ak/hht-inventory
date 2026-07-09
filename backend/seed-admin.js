/**
 * Admin Seed Script — creates the initial admin user if none exists.
 *
 * SAFETY:
 * - In production (NODE_ENV=production), reads credentials from ADMIN_USERNAME / ADMIN_PASSWORD
 *   environment variables. If they're not set, the script prints a warning and skips seeding.
 * - In development, uses the hardcoded defaults below.
 * - Password is always bcrypt-hashed before storage.
 * - Skips if any admin user already exists.
 *
 * Usage: node seed-admin.js
 * Can be safely run multiple times (idempotent).
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const bcrypt = require('bcryptjs');
const db = require('./db');

const isProduction = process.env.NODE_ENV === 'production';

// ── Dev-only defaults ─────────────────────────────────────────────────
// These are NEVER used in production. Set ADMIN_USERNAME/ADMIN_PASSWORD
// env vars for production deployments.
const DEV_ADMIN_USERNAME = 'admin';
const DEV_ADMIN_PASSWORD = 'Zikoa1421887';

async function seedAdmin() {
  console.log(`[seed-admin] NODE_ENV=${process.env.NODE_ENV || 'development'}`);

  // Determine credentials
  let username, password;

  if (isProduction) {
    username = process.env.ADMIN_USERNAME;
    password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      console.warn('[seed-admin] WARNING: Running in production but ADMIN_USERNAME / ADMIN_PASSWORD not set.');
      console.warn('[seed-admin] Skipping admin seeding. Set these env vars to create the admin user.');
      process.exit(0);
    }
  } else {
    // Dev mode — use defaults
    username = process.env.ADMIN_USERNAME || DEV_ADMIN_USERNAME;
    password = process.env.ADMIN_PASSWORD || DEV_ADMIN_PASSWORD;
    console.log('[seed-admin] Dev mode — using' + (process.env.ADMIN_USERNAME ? ' env' : ' default') + ' credentials');
  }

  try {
    // Check if any admin exists
    const { rows } = await db.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);

    if (rows.length > 0) {
      console.log('[seed-admin] Admin user already exists. Skipping.');
      process.exit(0);
    }

    // Hash and insert
    const hashed = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hashed, 'admin']
    );

    console.log(`[seed-admin] Admin user created: username="${result.rows[0].username}" role="${result.rows[0].role}"`);
    process.exit(0);
  } catch (err) {
    console.error('[seed-admin] Error:', err.message);
    process.exit(1);
  }
}

seedAdmin();