/* ============================================================
   People / Personnel — centralized names list
   ============================================================
   This is the single source of truth for person names used
   throughout the application. Import this file in index.html
   (before any screen modules) to make ASSIGNED_PEOPLE and
   related helpers available globally.
   ============================================================ */

const ASSIGNED_PEOPLE = [
  'KAMAL BOURROU',
  'MOHAMED ALI KAMAL',
  'SOUFIYAN BELFAQIR',
  'ELMEHDI BELKOUCHI',
  'AHMED FARBOUSSI',
  'YOUSSEF CHARMOUH',
  'BADREDDINE BAKKALI',
  'ZAKARIA BOURKHISS',
  'AYOUB SADIKI',
  'AHMED BAHOU_AMARSAL',
  'ANAS BEN CHIKHE',
  'YOUNESS CHAFKI',
  'REDA ALLOUCH',
  'MEHDI EL_ASSKARI',
  'SEDDIK IDOUAKRIM',
  'AYOUB CHAAOUBI',
  'MOHAMED MASKAOUI',
  'AYOUB SARHANE',
  'ALI FARBOUSSI',
];

/**
 * Render an <option> list for a <select> or <datalist> element.
 * Adds a blank/default option at the top.
 * @param {HTMLSelectElement} selectEl - The select element to populate
 * @param {string} [selectedValue] - Value to pre-select
 */
function populatePeopleSelect(selectEl, selectedValue) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">-- Assign Person --</option>';
  ASSIGNED_PEOPLE.forEach(function (name) {
    var opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (selectedValue && selectedValue === name) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}

/**
 * Get a search-filtered subset of ASSIGNED_PEOPLE.
 * @param {string} query - Search text (case-insensitive)
 * @returns {string[]} Matching names
 */
function searchPeople(query) {
  if (!query || !query.trim()) return ASSIGNED_PEOPLE;
  var q = query.trim().toLowerCase();
  return ASSIGNED_PEOPLE.filter(function (name) {
    return name.toLowerCase().indexOf(q) !== -1;
  });
}
