-- ============================================================
-- Seed data — default templates, models, and sample sites
-- ============================================================

-- Default models
INSERT INTO models (name) VALUES
  ('ecran p204v'),
  ('TK180'),
  ('IDENTY CHROME -MINI MPR'),
  ('EPSON FX 890II PRINTER'),
  ('BGR 504 pro'),
  ('CHARGER 4 SLOT BATTERY MEMOR 20'),
  ('MEMOR 20 HHT'),
  ('HP EliteDesk 800 G6'),
  ('Workstation G9'),
  ('Ecran P22 G5'),
  ('ecran v197'),
  ('printer oki ml3320'),
  ('printer hp laserjet m402n'),
  ('printer hp laserjet m507')
ON CONFLICT (name) DO NOTHING;

-- Default templates
INSERT INTO position_templates (name) VALUES
  ('Checking'),
  ('Gate'),
  ('Back Office')
ON CONFLICT (name) DO NOTHING;

-- Checking template components (ordered)
INSERT INTO template_components (template_id, component_name, sort_order)
SELECT t.id, v.name, v.ord
FROM position_templates t
CROSS JOIN (VALUES
  ('Checking', 'WKS',  1),
  ('Checking', 'ATB',  2),
  ('Checking', 'BTP',  3),
  ('Checking', 'Monitor', 4),
  ('Checking', 'Swiper', 5)
) v(tname, name, ord)
WHERE t.name = v.tname
AND NOT EXISTS (
  SELECT 1 FROM template_components tc
  WHERE tc.template_id = t.id AND tc.component_name = v.name
);

-- Gate template components
INSERT INTO template_components (template_id, component_name, sort_order)
SELECT t.id, v.name, v.ord
FROM position_templates t
CROSS JOIN (VALUES
  ('Gate', 'WKS',  1),
  ('Gate', 'Monitor', 2),
  ('Gate', 'BGR',  3),
  ('Gate', 'DCP',  4)
) v(tname, name, ord)
WHERE t.name = v.tname
AND NOT EXISTS (
  SELECT 1 FROM template_components tc
  WHERE tc.template_id = t.id AND tc.component_name = v.name
);

-- Back Office template components
INSERT INTO template_components (template_id, component_name, sort_order)
SELECT t.id, v.name, v.ord
FROM position_templates t
CROSS JOIN (VALUES
  ('Back Office', 'WKS',  1),
  ('Back Office', 'Monitor', 2),
  ('Back Office', 'DCP',  3)
) v(tname, name, ord)
WHERE t.name = v.tname
AND NOT EXISTS (
  SELECT 1 FROM template_components tc
  WHERE tc.template_id = t.id AND tc.component_name = v.name
);

-- Sample site
INSERT INTO sites (name) VALUES ('Default Site')
ON CONFLICT (name) DO NOTHING;