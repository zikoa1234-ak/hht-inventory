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
 * Populate a <datalist> element with all person names.
 * Call this once on page load.
 * @param {string} datalistId - The id of the <datalist> element
 */
function populatePeopleDatalist(datalistId) {
  var dl = document.getElementById(datalistId);
  if (!dl) return;
  dl.innerHTML = '';
  ASSIGNED_PEOPLE.forEach(function (name) {
    var opt = document.createElement('option');
    opt.value = name;
    dl.appendChild(opt);
  });
}

/**
 * Populate a <select> element with person options (fallback if needed).
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
 * Check if a given name is in the ASSIGNED_PEOPLE list.
 * @param {string} name
 * @returns {boolean}
 */
function isValidPerson(name) {
  if (!name || !name.trim()) return false;
  var n = name.trim().toUpperCase();
  for (var i = 0; i < ASSIGNED_PEOPLE.length; i++) {
    if (ASSIGNED_PEOPLE[i] === n) return true;
  }
  return false;
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