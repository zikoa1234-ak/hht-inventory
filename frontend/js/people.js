/* ============================================================
   People / Personnel — centralized names list
   ============================================================
   This is the single source of truth for person names used
   throughout the application. Import this file in index.html
   (before any screen modules) to make ASSIGNED_PEOPLE and
   related helpers available globally.

   The list is fetched from the backend on init. If the API
   call fails, a hardcoded fallback list is used.
   ============================================================ */

var FALLBACK_PEOPLE = [
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

// Start empty — populated by initPeople() on page load
var ASSIGNED_PEOPLE = [];

/**
 * Initialize the people list from the backend API.
 * Falls back to the hardcoded list if the API call fails.
 * Call this once on page load and await it before using ASSIGNED_PEOPLE.
 * @returns {Promise<string[]>}
 */
function initPeople() {
  return fetch('/api/people')
    .then(function (res) {
      if (!res.ok) throw new Error('API returned ' + res.status);
      return res.json();
    })
    .then(function (names) {
      ASSIGNED_PEOPLE = names;
      return ASSIGNED_PEOPLE;
    })
    .catch(function (err) {
      console.warn('Failed to load people from API, using fallback list:', err.message);
      ASSIGNED_PEOPLE = FALLBACK_PEOPLE.slice();
      return ASSIGNED_PEOPLE;
    });
}

/**
 * Populate a <datalist> element with all person names.
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