/* ============================================================
   Host Positions Parser + Template-Prefix Mapping
   ============================================================ */

// --- Configurable template-to-prefix mapping ---
// Map template names (lowercase) to their matching prefix codes
// Add or modify this object to change classification rules
const TEMPLATE_PREFIX_MAP = {
  'checking':     ['CKB'],
  'gate':         ['GTT'],
  'back office':  ['TDE', 'ADM', 'BDM', 'OPM', 'BMI', 'XST'],
};

// Reverse lookup: prefix -> template name
const PREFIX_TO_TEMPLATE = {};
for (const [tpl, prefixes] of Object.entries(TEMPLATE_PREFIX_MAP)) {
  for (const prefix of prefixes) {
    PREFIX_TO_TEMPLATE[prefix] = tpl;
  }
}

// --- Host positions list (parsed from PingInfoView_hosts.txt) ---
// These are workstation hostnames imported from the TXT file
const HOST_POSITIONS = [
  "CMN1ADM001","CMN1BDM001","CMN1BDM002","CMN1BDM003","CMN1BDM004","CMN1BDM005","CMN1BDM011","CMN1BDM020",
  "CMN1CKB001","CMN1CKB002","CMN1CKB003","CMN1CKB004","CMN1CKB005","CMN1CKB006","CMN1CKB007","CMN1CKB008","CMN1CKB009","CMN1CKB010","CMN1CKB011","CMN1CKB012","CMN1CKB013","CMN1CKB014",
  "CMN1CKB025","CMN1CKB026","CMN1CKB027","CMN1CKB028","CMN1CKB029","CMN1CKB030","CMN1CKB031","CMN1CKB032","CMN1CKB033","CMN1CKB034","CMN1CKB035","CMN1CKB036","CMN1CKB037","CMN1CKB038","CMN1CKB039","CMN1CKB040",
  "CMN1CKB041","CMN1CKB042","CMN1CKB043","CMN1CKB044","CMN1CKB045","CMN1CKB046","CMN1CKB047","CMN1CKB048","CMN1CKB049","CMN1CKB050",
  "CMN1CKB051","CMN1CKB052","CMN1CKB053","CMN1CKB054","CMN1CKB055","CMN1CKB056","CMN1CKB057","CMN1CKB058","CMN1CKB059","CMN1CKB060",
  "CMN1CKB061","CMN1CKB062","CMN1CKB063","CMN1CKB064","CMN1CKB065","CMN1CKB066","CMN1CKB067","CMN1CKB068",
  "CMN1CKB075","CMN1CKB076","CMN1CKB077","CMN1CKB078","CMN1CKB079","CMN1CKB080","CMN1CKB081","CMN1CKB082","CMN1CKB083","CMN1CKB084","CMN1CKB085","CMN1CKB086",
  "CMN1GTT006","CMN1GTT007","CMN1GTT009","CMN1GTT010","CMN1GTT011","CMN1GTT012","CMN1GTT013","CMN1GTT014","CMN1GTT015","CMN1GTT016","CMN1GTT017","CMN1GTT018","CMN1GTT019","CMN1GTT020",
  "CMN1GTT021","CMN1GTT022","CMN1GTT023","CMN1GTT024","CMN1GTT025","CMN1GTT026","CMN1GTT027","CMN1GTT028","CMN1GTT029","CMN1GTT030",
  "CMN1GTT031","CMN1GTT032","CMN1GTT033","CMN1GTT034","CMN1GTT035","CMN1GTT036","CMN1GTT037","CMN1GTT038","CMN1GTT039","CMN1GTT040","CMN1GTT041","CMN1GTT042","CMN1GTT043","CMN1GTT044","CMN1GTT045",
  "CMN1TDE001","CMN1TDE002","CMN1TDE003","CMN1TDE004","CMN1TDE005","CMN1TDE006","CMN1TDE007","CMN1TDE008","CMN1TDE009","CMN1TDE010","CMN1TDE011",
  "CMN1XST041","CMN1XST042",
  "CMN2BMI001","CMN2BMI002","CMN2BMI003","CMN2BMI005","CMN2BMI006",
  "CMN2CKB001","CMN2CKB002","CMN2CKB003","CMN2CKB004","CMN2CKB005","CMN2CKB006","CMN2CKB007","CMN2CKB008","CMN2CKB009","CMN2CKB010",
  "CMN2CKB011","CMN2CKB012","CMN2CKB013","CMN2CKB014","CMN2CKB015","CMN2CKB016","CMN2CKB017","CMN2CKB018","CMN2CKB019","CMN2CKB020",
  "CMN2CKB021","CMN2CKB022","CMN2CKB023","CMN2CKB024","CMN2CKB025","CMN2CKB026","CMN2CKB027","CMN2CKB028","CMN2CKB029","CMN2CKB030",
  "CMN2CKB031","CMN2CKB032","CMN2CKB033","CMN2CKB034","CMN2CKB035","CMN2CKB036","CMN2CKB037","CMN2CKB038","CMN2CKB039","CMN2CKB040","CMN2CKB041","CMN2CKB043",
  "CMN2GTT001","CMN2GTT002","CMN2GTT003","CMN2GTT004","CMN2GTT005","CMN2GTT006","CMN2GTT007","CMN2GTT008","CMN2GTT009","CMN2GTT010",
  "CMN2GTT011","CMN2GTT012","CMN2GTT013","CMN2GTT014","CMN2GTT015","CMN2GTT016","CMN2GTT017","CMN2GTT018","CMN2GTT019","CMN2GTT020",
  "CMN2GTT021","CMN2GTT022","CMN2GTT023","CMN2GTT024","CMN2GTT025",
  "CMN2OPM001","CMN2OPM002","CMN2OPM003","CMN2OPM004","CMN2OPM007","CMN2OPM009","CMN2OPM011","CMN2OPM012","CMN2OPM013",
  "CMN2TDE001","CMN2TDE002","CMN2TDE003","CMN2TDE004","CMN2TDE005","CMN2TDE006","CMN2TDE007",
  "CMN3CKB001","CMN3CKB002","CMN3CKB003","CMN3CKB004","CMN3CKB005","CMN3CKB006","CMN3CKB007","CMN3CKB008",
  "CMN3GTT001","CMN3GTT002"
];

// --- Derived metadata per host ---
function classifyHost(name) {
  // Extract the type prefix (e.g., "CKB" from "CMN1CKB001")
  const match = name.match(/^([A-Z]+\d+)([A-Z]+)(\d+)$/);
  if (!match) return { site: null, type: null, number: null, template: null };
  const site = match[1];  // e.g. "CMN1"
  const type = match[2];  // e.g. "CKB"
  const num = match[3];   // e.g. "001"
  const template = PREFIX_TO_TEMPLATE[type] || null;
  return { site, type, number: num, template };
}

// Build lookup by site+type
const HOST_POSITIONS_BY_TEMPLATE = {};
for (const [tpl] of Object.entries(TEMPLATE_PREFIX_MAP)) {
  HOST_POSITIONS_BY_TEMPLATE[tpl] = [];
}
for (const host of HOST_POSITIONS) {
  const info = classifyHost(host);
  if (info.template && HOST_POSITIONS_BY_TEMPLATE[info.template]) {
    HOST_POSITIONS_BY_TEMPLATE[info.template].push({ name: host, ...info });
  }
}

// Get host positions matching a template name (case-insensitive)
// Handles both exact names ("gate") and per-location names ("CMN Gate")
function getHostsForTemplate(templateName) {
  if (!templateName) return [];
  const name = templateName.toLowerCase();
  // Try exact match first
  if (HOST_POSITIONS_BY_TEMPLATE[name]) return HOST_POSITIONS_BY_TEMPLATE[name];
  // Partial match: check if any known template key is contained in the name
  for (const [key, hosts] of Object.entries(HOST_POSITIONS_BY_TEMPLATE)) {
    if (name.includes(key)) return hosts;
  }
  return [];
}

// Derive template name from a hostname
function getTemplateForHost(hostname) {
  const info = classifyHost(hostname);
  return info.template;
}

// Debug helper
function debugHostCounts() {
  console.log('[Hosts] Total positions:', HOST_POSITIONS.length);
  for (const [tpl, hosts] of Object.entries(HOST_POSITIONS_BY_TEMPLATE)) {
    console.log(`[Hosts] ${tpl}: ${hosts.length} positions`);
  }
}