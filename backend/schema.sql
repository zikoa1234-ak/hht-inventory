-- ============================================================
-- HHT Inventory — PostgreSQL Schema
-- ============================================================

-- Sites / locations
CREATE TABLE IF NOT EXISTS sites (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  assigned_person VARCHAR(255),
  created_by  INTEGER      REFERENCES users(id),
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Position templates (reusable blueprints)
CREATE TABLE IF NOT EXISTS position_templates (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Expected components inside a template
CREATE TABLE IF NOT EXISTS template_components (
  id              SERIAL PRIMARY KEY,
  template_id     INTEGER      NOT NULL REFERENCES position_templates(id) ON DELETE CASCADE,
  component_name  VARCHAR(255) NOT NULL,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, component_name)
);

-- Real physical positions / workstations
CREATE TABLE IF NOT EXISTS positions (
  id          SERIAL PRIMARY KEY,
  site_id     INTEGER      NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  template_id INTEGER      REFERENCES position_templates(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  created_by  INTEGER      REFERENCES users(id),
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, name)
);

-- Predefined models catalogue
CREATE TABLE IF NOT EXISTS models (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Actual components installed at a position (latest state)
CREATE TABLE IF NOT EXISTS position_components (
  id                  SERIAL PRIMARY KEY,
  position_id         INTEGER      NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  component_name      VARCHAR(255) NOT NULL,
  model_id            INTEGER      REFERENCES models(id),
  custom_model        VARCHAR(255),
  serial_number       VARCHAR(255),
  asset_tag           VARCHAR(255),
  notes               TEXT,
  status              VARCHAR(50)  NOT NULL DEFAULT 'missing',
  is_extra_component  BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order          INTEGER      NOT NULL DEFAULT 0,
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  assigned_person     VARCHAR(255),
  updated_by          VARCHAR(255),
  UNIQUE(position_id, component_name)
);

-- Scan sessions (track when a position was worked on)
CREATE TABLE IF NOT EXISTS scan_sessions (
  id            SERIAL PRIMARY KEY,
  position_id   INTEGER   NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMP,
  completed_by  VARCHAR(255)
);

-- Audit / change history for position components
CREATE TABLE IF NOT EXISTS component_history (
  id            SERIAL PRIMARY KEY,
  component_id  INTEGER      NOT NULL REFERENCES position_components(id) ON DELETE CASCADE,
  field_name    VARCHAR(255) NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  changed_by    VARCHAR(255)
);

-- ============================================================
-- Users / Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(100) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'user',
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- User-Site assignments (scoped access by location)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sites (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id     INTEGER      NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  assigned_by INTEGER      REFERENCES users(id),
  UNIQUE(user_id, site_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_template_components_template_id ON template_components(template_id);
CREATE INDEX IF NOT EXISTS idx_positions_site_id               ON positions(site_id);
CREATE INDEX IF NOT EXISTS idx_position_components_position_id ON position_components(position_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_position_id       ON scan_sessions(position_id);
CREATE INDEX IF NOT EXISTS idx_component_history_component_id  ON component_history(component_id);