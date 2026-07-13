/* ============================================================
   HHT Inventory — Main App Entry Point (Fixed)
   ============================================================ */

// Universal helpers — esc() is defined in auth.js (loaded before app.js)

const AppHelpers = {
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
  },

  toast(message, type) {
    if (type === undefined) type = 'success';
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
  },

  confirm(title, message, onConfirm) {
    const overlay = document.getElementById('confirmOverlay');
    if (!overlay) return;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    overlay.classList.remove('hidden');

    var close = function () { overlay.classList.add('hidden'); };
    document.getElementById('confirmYesBtn').onclick = function () { close(); onConfirm(); };
    document.getElementById('confirmNoBtn').onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  },
};

// ====== Application ======
var App = {
  DEBUG: true,

  log: function () {
    if (this.DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[App]');
      console.log.apply(console, args);
    }
  },

  init: async function () {
    this.log('Initializing...');

    // ---- Force login if not authenticated ----
    if (!AUTH.isLoggedIn()) {
      this._forceLogin = true;
      // Show login modal immediately, blocking the app
      AUTH.showLoginModal(true);
      // Don't load any data — user must log in first
    } else {
      this._forceLogin = false;
    }

    // Pre-select template from URL hash if present
    this.pendingPositionId = null;

    // ---- Auth events ----
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLink = document.getElementById('adminLink');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');

    if (loginBtn) {
      loginBtn.addEventListener('click', function () { AUTH.showLoginModal(); });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () { AUTH.logout(); });
    }
    if (adminLink) {
      adminLink.addEventListener('click', function () {
        window.location.href = '/admin.html';
      });
    }
    if (loginSubmitBtn) {
      loginSubmitBtn.addEventListener('click', function () { App._handleLogin(); });
    }
    // Enter key in login form
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
      loginPassword.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); App._handleLogin(); }
      });
    }
    const loginUsername = document.getElementById('loginUsername');
    if (loginUsername) {
      loginUsername.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); loginPassword.focus(); }
      });
    }

    // Close login modal on overlay click (but not when forced)
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
      loginOverlay.addEventListener('click', function (e) {
        if (e.target === loginOverlay && !App._forceLogin) AUTH.hideLoginModal();
      });
    }

    // ---- Navigation ----
    document.querySelectorAll('[data-screen]').forEach(function (el) {
      el.addEventListener('click', function () {
        var screen = el.dataset.screen;
        if (screen === 'templates') {
          AppHelpers.showScreen('templates');
          TemplatesScreen.render();
        } else if (screen === 'selection') {
          AppHelpers.showScreen('selection');
        } else if (screen === 'dashboard') {
          AppHelpers.showScreen('dashboard');
          App.refreshDashboard();
        } else if (screen === 'settings') {
          App._openSettings();
        }
      });
    });

    // ---- Init screen modules ----
    if (typeof TemplatesScreen !== 'undefined' && TemplatesScreen.init) TemplatesScreen.init();
    if (typeof PositionsScreen !== 'undefined' && PositionsScreen.init) PositionsScreen.init();

    // Load dynamic people list from backend (only after login)
    if (AUTH.isLoggedIn()) {
      if (typeof initPeople !== 'undefined') {
        initPeople().then(function () {
          if (typeof populatePeopleDatalist !== 'undefined') {
            populatePeopleDatalist('peopleList');
            populatePeopleDatalist('sparePeopleList');
          }
        });
      }
    }

    // ---- DOM cache ----
    this.siteSelect = document.getElementById('siteSelect');
    this.templateSelect = document.getElementById('templateSelect');
    this.positionSelect = document.getElementById('positionSelect');
    this.openPositionBtn = document.getElementById('openPositionBtn');
    this.createPositionBtn = document.getElementById('createPositionBtn');
    this.addSiteBtn = document.getElementById('addSiteBtn');
    this.siteList = document.getElementById('siteList');
    this.manageTemplatesBtn = document.getElementById('manageTemplatesBtn');
    this.exportAllBtn = document.getElementById('exportAllBtn');
    this.exportPositionBtn = document.getElementById('exportPositionBtn');
    this.positionTableBody = document.getElementById('positionTableBody');
    this.templateComponentsPreview = document.getElementById('templateComponentsPreview');

    // Guard: required DOM
    if (!this.templateSelect || !this.positionSelect) {
      console.error('[App] CRITICAL: missing core DOM elements');
      AppHelpers.toast('App failed to initialize: missing DOM', 'error');
      return;
    }

    // ---- Event listeners ----
    this.siteSelect.addEventListener('change', function () { App._onFiltersChanged(); });
    this.templateSelect.addEventListener('change', function () { App._onTemplateSelect(); });
    this.positionSelect.addEventListener('change', function () { App._onPositionSelect(); });
    if (this.openPositionBtn) this.openPositionBtn.addEventListener('click', function () { App._openSelectedPosition(); });
    if (this.createPositionBtn) this.createPositionBtn.addEventListener('click', function () { App._openCreateModal(); });
    if (this.addSiteBtn) this.addSiteBtn.addEventListener('click', function () { App._addSite(); });
    if (this.manageTemplatesBtn) {
      this.manageTemplatesBtn.addEventListener('click', function () {
        AppHelpers.showScreen('templates');
        TemplatesScreen.render();
      });
    }
    if (this.exportAllBtn) this.exportAllBtn.addEventListener('click', function () { App._exportAll(); });
    if (this.exportPositionBtn) this.exportPositionBtn.addEventListener('click', function () { App._exportSelected(); });

    // ---- Create Position modal ----
    var createOverlay = document.getElementById('createPositionOverlay');
    var confirmCreateBtn = document.getElementById('confirmCreatePositionBtn');
    if (confirmCreateBtn) confirmCreateBtn.addEventListener('click', function () { App._createPosition(); });
    if (createOverlay) {
      createOverlay.querySelectorAll('.modal-close-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { createOverlay.classList.add('hidden'); });
      });
      createOverlay.addEventListener('click', function (e) {
        if (e.target === createOverlay) createOverlay.classList.add('hidden');
      });
    }

    // ---- Change Template overlay ----
    var changeOverlay = document.getElementById('changeTemplateOverlay');
    if (changeOverlay) {
      changeOverlay.addEventListener('click', function (e) {
        if (e.target === changeOverlay) changeOverlay.classList.add('hidden');
      });
    }

    // ---- Confirm overlay ----
    var confirmOverlay = document.getElementById('confirmOverlay');
    if (confirmOverlay) {
      confirmOverlay.addEventListener('click', function (e) {
        if (e.target === confirmOverlay) confirmOverlay.classList.add('hidden');
      });
    }

    // ---- Settings overlay ----
    var settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
      settingsOverlay.querySelectorAll('.settings-close').forEach(function (btn) {
        btn.addEventListener('click', function () { settingsOverlay.classList.add('hidden'); });
      });
      settingsOverlay.addEventListener('click', function (e) {
        if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
      });
    }

    // ===== 2-CARD SELECTION =====
    // Card click handlers
    document.getElementById('selectPositionCard').addEventListener('click', function () {
      AppHelpers.showScreen('dashboard');
      App.refreshDashboard();
    });
    document.getElementById('selectSpareCard').addEventListener('click', function () {
      AppHelpers.showScreen('spare-entry');
      App._initSpareForm();
    });

    // Spare back button
    document.getElementById('spareBackBtn').addEventListener('click', function () {
      AppHelpers.showScreen('selection');
    });

    // Spare "ToList" button — go to spare list
    document.getElementById('spareToListBtn').addEventListener('click', function () {
      AppHelpers.showScreen('spare-list');
      App._loadSpareList();
    });

    // Spare list back button
    document.getElementById('spareListBackBtn').addEventListener('click', function () {
      AppHelpers.showScreen('spare-entry');
    });

    // Spare export button
    document.getElementById('exportSpareBtn').addEventListener('click', function () {
      App._exportSpareList();
    });

    // Spare search input
    document.getElementById('spareSearchInput').addEventListener('input', function () {
      App._loadSpareList();
    });

    // Spare form save
    document.getElementById('saveSpareBtn').addEventListener('click', function () {
      App._saveSpareItem();
    });

    // Show/hide custom model required indicator on spare form
    document.getElementById('spareModelSelect').addEventListener('change', function () {
      // Model is optional — no required indicator needed
    });

    // Spare asset tag validation on input
    document.getElementById('spareAssetTag').addEventListener('input', function () {
      App._validateSpareAssetTag();
    });

    // Serial number Enter key advances to asset tag on spare form
    document.getElementById('spareSerialNumber').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('spareAssetTag').focus();
      }
    });

    // Asset tag Enter key saves the spare form
    document.getElementById('spareAssetTag').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        App._saveSpareItem();
      }
    });

    // ---- Load initial data (only if authenticated) ----
    if (!this._forceLogin) {
      await this.refreshDashboard();
    }
    this.log('Ready');

    // Handle pending position from URL hash
    if (!this._forceLogin) {
      var hash = window.location.hash;
      if (hash && hash.startsWith('#position-')) {
        var pid = parseInt(hash.replace('#position-', ''));
        if (pid) {
          this.log('Opening position from hash:', pid);
          if (typeof PositionsScreen !== 'undefined') {
            PositionsScreen.openPosition(pid);
          }
        }
      }
    }
  },

  // ===== AUTH =====
  _handleLogin: async function () {
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errorEl = document.getElementById('loginError');

    if (!username || !password) {
      if (errorEl) { errorEl.textContent = 'Username and password are required'; errorEl.classList.remove('hidden'); }
      return;
    }

    try {
      await AUTH.login(username, password);
      AUTH.hideLoginModal();
      document.getElementById('loginUsername').value = '';
      document.getElementById('loginPassword').value = '';
      if (errorEl) errorEl.classList.add('hidden');
      AppHelpers.toast('Logged in as ' + username, 'success');
      this._forceLogin = false;
      // Load dynamic people list now that user is logged in
      if (typeof initPeople !== 'undefined') {
        initPeople().then(function () {
          if (typeof populatePeopleDatalist !== 'undefined') {
            populatePeopleDatalist('peopleList');
            populatePeopleDatalist('sparePeopleList');
          }
        });
      }
      // Show selection screen after login
      AppHelpers.showScreen('selection');
      App.log('Redirected to selection screen');
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    }
  },

  // ===== DASHBOARD =====
  refreshDashboard: async function () {
    this.log('Refreshing dashboard...');
    try {
      var sitesP = AppState.loadSites().catch(function (e) {
        App.log('Sites load failed:', e.message);
        return [];
      });
      var templatesP = AppState.loadTemplates().catch(function (e) {
        App.log('Templates load failed:', e.message);
        return [];
      });
      var positionsP = AppState.loadPositions().catch(function (e) {
        App.log('Positions load failed:', e.message);
        return [];
      });

      var results = await Promise.all([sitesP, templatesP, positionsP]);
      var sites = results[0] || [];
      var templates = results[1] || [];
      var positions = results[2] || [];

      this._populateSelects(sites, templates, positions);
      this._renderSiteList(sites);
      this._renderPositionTable(positions);

      // Show host count
      if (typeof HOST_POSITIONS !== 'undefined') {
        this.log('Host positions available:', HOST_POSITIONS.length);
      }
    } catch (err) {
      this.log('Dashboard refresh error:', err.message);
      AppHelpers.toast('Failed to load data: ' + err.message, 'error');
    }
  },

  _populateSelects: function (sites, templates, positions) {
    // Site select
    var siteSelect = this.siteSelect;
    siteSelect.innerHTML = '<option value="">-- All Sites --</option>';
    (sites || []).forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      siteSelect.appendChild(opt);
    });

    // Template select — show ALL templates, not just filtered
    var tplSelect = this.templateSelect;
    tplSelect.innerHTML = '<option value="">-- Select Template --</option>';
    (templates || []).forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      tplSelect.appendChild(opt);
    });

    // Position select
    this._updatePositionSelect(positions || []);
  },

  _updatePositionSelect: function (positions) {
    var posSelect = this.positionSelect;
    if (!posSelect) return;

    var siteId = this.siteSelect ? this.siteSelect.value : '';
    var templateId = this.templateSelect ? this.templateSelect.value : '';

    posSelect.innerHTML = '<option value="">-- Select Position --</option>';

    var filtered = positions || [];
    if (siteId) filtered = filtered.filter(function (p) { return String(p.site_id) === String(siteId); });
    if (templateId) filtered = filtered.filter(function (p) { return String(p.template_id) === String(templateId); });

    // Also add host TXT positions that match the selected template
    if (templateId) {
      var tplName = '';
      var templates = AppState.templates || [];
      for (var i = 0; i < templates.length; i++) {
        if (String(templates[i].id) === String(templateId)) {
          tplName = templates[i].name;
          break;
        }
      }
      if (tplName && typeof getHostsForTemplate !== 'undefined') {
        var matchedHosts = getHostsForTemplate(tplName);
        this.log('Template "' + tplName + '" matches', matchedHosts.length, 'host positions');
        var existingNames = {};
        filtered.forEach(function (p) { existingNames[p.name] = true; });

        matchedHosts.forEach(function (h) {
          if (!existingNames[h.name]) {
            var opt = document.createElement('option');
            opt.value = 'host:' + h.name;
            opt.textContent = h.name + ' [from TXT]';
            posSelect.appendChild(opt);
          }
        });
      }
    }

    if (this.openPositionBtn) this.openPositionBtn.disabled = true;
    if (this.exportPositionBtn) this.exportPositionBtn.disabled = true;
  },

  _renderSiteList: function (sites) {
    var list = this.siteList;
    if (!list) return;
    list.innerHTML = '';
    (sites || []).forEach(function (s) {
      var div = document.createElement('div');
      div.className = 'compact-list-item';
      div.innerHTML = '<span>' + esc(s.name) + '</span>';
      list.appendChild(div);
    });
  },

  _renderPositionTable: function (positions) {
    var tbody = this.positionTableBody;
    if (!tbody) return;
    tbody.innerHTML = '';

    var siteId = this.siteSelect ? this.siteSelect.value : '';
    var templateId = this.templateSelect ? this.templateSelect.value : '';

    var filtered = positions || [];
    if (siteId) filtered = filtered.filter(function (p) { return String(p.site_id) === String(siteId); });
    if (templateId) filtered = filtered.filter(function (p) { return String(p.template_id) === String(templateId); });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No positions found. Select a template above to see matching host positions.</td></tr>';
      return;
    }

    filtered.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML =
        '<td>' + esc(p.site_name || '') + '</td>' +
        '<td><strong>' + esc(p.name) + '</strong></td>' +
        '<td>' + esc(p.template_name || '') + '</td>' +
        '<td>' + (p.total_components != null ? p.total_components : '-') + '</td>' +
        '<td>' + (p.completed_components != null ? p.completed_components : '-') + '</td>' +
        '<td>' + (p.partial_components != null ? p.partial_components : '-') + '</td>' +
        '<td>' + (p.missing_components != null ? p.missing_components : '-') + '</td>' +
        '<td class="text-secondary text-sm">' + AppState.formatDate(p.updated_at) + '</td>';
      tr.addEventListener('click', function () {
        if (typeof PositionsScreen !== 'undefined') {
          PositionsScreen.openPosition(p.id);
        }
      });
      tbody.appendChild(tr);
    });
  },

  // ===== TEMPLATE SELECT =====
  _onTemplateSelect: function () {
    var tplId = this.templateSelect ? this.templateSelect.value : '';
    this.log('Template selected:', tplId);

    // Show template components
    this._showTemplateComponents(tplId);

    // Update position list with TXT hosts
    this._updatePositionSelect(AppState.positions || []);
    this._renderPositionTable(AppState.positions || []);

    // Update position select event
    this._onPositionSelect();
  },

  _showTemplateComponents: async function (templateId) {
    var preview = this.templateComponentsPreview;
    if (!preview) return;

    if (!templateId) {
      preview.innerHTML = '<p class="text-secondary text-sm">Select a template to see its components</p>';
      return;
    }

    preview.innerHTML = '<p class="text-secondary text-sm">Loading components...</p>';

    try {
      var tpl;
      // Try to get detailed template with components
      try {
        tpl = await api.getTemplate(parseInt(templateId));
      } catch (e) {
        // Fallback to cached data
        var cached = (AppState.templates || []).find(function (t) { return String(t.id) === String(templateId); });
        if (cached) {
          tpl = cached;
          tpl.components = [];
        } else {
          throw e;
        }
      }

      this.log('Template loaded:', tpl.name, '| components:', tpl.components ? tpl.components.length : 0);

      if (!tpl.components || tpl.components.length === 0) {
        preview.innerHTML = '<p class="text-secondary text-sm">' + esc(tpl.name) + ' — No components defined yet. <a href="#" id="editTplFromPreview">Edit template</a></p>';
        var editLink = preview.querySelector('#editTplFromPreview');
        if (editLink) {
          editLink.addEventListener('click', function (e) {
            e.preventDefault();
            AppHelpers.showScreen('templates');
            TemplatesScreen.render();
          });
        }
        return;
      }

      var html = '<p class="text-sm mb-4"><strong>' + esc(tpl.name) + '</strong> — ' + tpl.components.length + ' component(s):</p>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
      tpl.components.forEach(function (c) {
        html += '<span class="status-badge status-missing" style="background:var(--color-secondary);color:var(--text);">' + esc(c.component_name || c.name || c) + '</span>';
      });
      html += '</div>';

      // Show host count
      if (typeof getHostsForTemplate !== 'undefined') {
        var matchedHosts = getHostsForTemplate(tpl.name);
        html += '<p class="text-secondary text-sm mt-4">' + matchedHosts.length + ' matching positions from host list</p>';
      }

      preview.innerHTML = html;
    } catch (err) {
      this.log('Failed to load template components:', err.message);
      preview.innerHTML = '<p class="text-secondary text-sm">Could not load components: ' + esc(err.message) + '</p>';
    }
  },

  _onFiltersChanged: function () {
    this._updatePositionSelect(AppState.positions || []);
    this._renderPositionTable(AppState.positions || []);
  },

  _onPositionSelect: function () {
    var val = this.positionSelect ? this.positionSelect.value : '';
    var enabled = !!val;
    if (this.openPositionBtn) this.openPositionBtn.disabled = !enabled;
    if (this.exportPositionBtn) this.exportPositionBtn.disabled = !enabled;
  },

  // ===== OPEN POSITION (handles both backend and host:TXT positions) =====
  _openSelectedPosition: async function () {
    var val = this.positionSelect ? this.positionSelect.value : '';
    if (!val) return;

    this.log('Opening selected position:', val);

    // Handle host:TXT prefixed positions
    if (val.startsWith('host:')) {
      var hostname = val.replace('host:', '');
      await this._openHostPosition(hostname);
      return;
    }

    if (typeof PositionsScreen !== 'undefined') {
      PositionsScreen.openPosition(parseInt(val));
    }
  },

  _openHostPosition: async function (hostname) {
    this.log('Opening host position:', hostname);

    // Check if it already exists in backend
    var existing = (AppState.positions || []).find(function (p) { return p.name === hostname; });
    if (existing) {
      this.log('Host position already exists in backend, opening:', existing.id);
      if (typeof PositionsScreen !== 'undefined') {
        PositionsScreen.openPosition(existing.id);
      }
      return;
    }

    // Determine template from hostname
    var templateName = typeof getTemplateForHost !== 'undefined' ? getTemplateForHost(hostname) : null;
    if (!templateName) {
      AppHelpers.toast('Could not determine template for ' + hostname, 'error');
      return;
    }

    this.log('Classified as template:', templateName);

    // Find template ID — try exact match first, then partial (handles "CMN Gate" / "gate")
    var templates = await AppState.loadTemplates();
    var tplNameLower = templateName.toLowerCase();
    var tpl = templates.find(function (t) { return t.name.toLowerCase() === tplNameLower; });
    if (!tpl) {
      tpl = templates.find(function (t) { return t.name.toLowerCase().includes(tplNameLower); });
    }
    if (!tpl) {
      AppHelpers.toast('Template "' + templateName + '" not found in system', 'error');
      return;
    }

    // Determine site from hostname
    var info = typeof classifyHost !== 'undefined' ? classifyHost(hostname) : { site: '' };
    var siteName = info.site || 'Default';
    var sites = await AppState.loadSites();
    var site = sites.find(function (s) { return s.name === siteName; });

    if (!site) {
      // Auto-create the site
      this.log('Creating site:', siteName);
      try {
        site = await api.createSite(siteName);
        sites = await AppState.loadSites();
      } catch (err) {
        this.log('Site creation failed:', err.message);
        site = sites[0]; // fallback to first site
      }
    }

    if (!site) {
      AppHelpers.toast('No site available for position', 'error');
      return;
    }

    // Create the position
    this.log('Creating position:', hostname, 'site:', site.id, 'template:', tpl.id);
    try {
      var newPos = await api.createPosition({
        site_id: site.id,
        template_id: tpl.id,
        name: hostname,
      });
      this.log('Position created:', newPos.id);
      AppHelpers.toast('Position "' + hostname + '" created!', 'success');
      await this.refreshDashboard();

      // Set URL hash
      window.location.hash = 'position-' + newPos.id;

      // Open it
      if (typeof PositionsScreen !== 'undefined') {
        PositionsScreen.openPosition(newPos.id);
      }
    } catch (err) {
      this.log('Position creation failed:', err.message);
      AppHelpers.toast('Failed to create position: ' + err.message, 'error');
    }
  },

  // ===== CREATE POSITION MODAL =====
  _openCreateModal: async function () {
    var overlay = document.getElementById('createPositionOverlay');
    var siteSelect = document.getElementById('createPositionSite');
    var templateSelect = document.getElementById('createPositionTemplate');
    if (!overlay || !siteSelect || !templateSelect) return;

    siteSelect.innerHTML = '';
    templateSelect.innerHTML = '';

    try {
      var results = await Promise.all([
        AppState.loadSites(),
        AppState.loadTemplates(),
      ]);
      var sites = results[0] || [];
      var templates = results[1] || [];

      sites.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        siteSelect.appendChild(opt);
      });

      templates.forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        templateSelect.appendChild(opt);
      });
    } catch (err) {
      this.log('Load for create modal failed:', err.message);
    }

    document.getElementById('createPositionName').value = '';
    overlay.classList.remove('hidden');
    document.getElementById('createPositionName').focus();
  },

  _createPosition: async function () {
    var siteId = document.getElementById('createPositionSite').value;
    var templateId = document.getElementById('createPositionTemplate').value;
    var name = document.getElementById('createPositionName').value.trim();

    if (!siteId || !templateId || !name) {
      AppHelpers.toast('All fields required', 'error');
      return;
    }

    try {
      var pos = await api.createPosition({
        site_id: parseInt(siteId),
        template_id: parseInt(templateId),
        name: name,
      });
      document.getElementById('createPositionOverlay').classList.add('hidden');
      AppHelpers.toast('Position "' + name + '" created!', 'success');
      await this.refreshDashboard();

      window.location.hash = 'position-' + pos.id;
      if (typeof PositionsScreen !== 'undefined') {
        PositionsScreen.openPosition(pos.id);
      }
    } catch (err) {
      AppHelpers.toast(err.message, 'error');
    }
  },

  // ===== SITE =====
  _addSite: async function () {
    var name = prompt('Enter site name:');
    if (!name || !name.trim()) return;
    try {
      await api.createSite(name.trim());
      await this.refreshDashboard();
      AppHelpers.toast('Site "' + name + '" created', 'success');
    } catch (err) {
      AppHelpers.toast(err.message, 'error');
    }
  },

  // ===== EXPORT =====
  _exportAll: function () {
    var siteId = this.siteSelect ? this.siteSelect.value : '';
    var templateId = this.templateSelect ? this.templateSelect.value : '';
    api.downloadCsv(api.getExportAllCsvUrl(siteId, templateId), 'all_positions.csv');
    AppHelpers.toast('Downloading all positions CSV...', 'success');
  },

  _exportSelected: function () {
    var id = this.positionSelect ? this.positionSelect.value : '';
    if (id) {
      if (id.startsWith('host:')) {
        AppHelpers.toast('Export not available — save position to backend first', 'warning');
        return;
      }
      window.open(api.getExportPositionCsvUrl(parseInt(id)));
      AppHelpers.toast('Downloading CSV...', 'success');
    }
  },

  // ===== SPARE FORM METHODS =====

  /** Load models into a select element */
  _loadModelsIntoSelect: function (selectId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Model (optional) --</option>';
    var models = AppState.models || [];
    if (models.length === 0) {
      AppState.loadModels().then(function (m) {
        m.forEach(function (mod) {
          var opt = document.createElement('option');
          opt.value = mod.id;
          opt.textContent = mod.name;
          sel.appendChild(opt);
        });
      }).catch(function () {});
    } else {
      models.forEach(function (mod) {
        var opt = document.createElement('option');
        opt.value = mod.id;
        opt.textContent = mod.name;
        sel.appendChild(opt);
      });
    }
  },

  /** Initialize the spare entry form */
  _initSpareForm: function () {
    this._loadModelsIntoSelect('spareModelSelect');
    document.getElementById('spareSerialNumber').value = '';
    document.getElementById('spareAssetTag').value = '';
    document.getElementById('spareCustomModel').value = '';
    document.getElementById('spareAssignedPerson').value = '';
    document.getElementById('spareNotes').value = '';
    document.getElementById('sparePositionSelect').value = '';
    document.getElementById('spareItemStatus').value = 'IN USE';
    document.getElementById('spareSaveStatus').className = 'save-status';
    document.getElementById('spareSaveStatus').textContent = '';
    document.getElementById('spareAssetTagError').classList.add('hidden');
    document.getElementById('spareSerialNumber').focus();
  },

  /** Validate spare asset tag starts with XS */
  _validateSpareAssetTag: function () {
    var tag = document.getElementById('spareAssetTag').value.trim();
    var errorEl = document.getElementById('spareAssetTagError');
    if (!tag) {
      errorEl.classList.add('hidden');
      return;
    }
    if (!/^xs/i.test(tag)) {
      errorEl.classList.remove('hidden');
    } else {
      errorEl.classList.add('hidden');
    }
  },

  /** Save a spare item */
  _saveSpareItem: async function () {
    var modelSelect = document.getElementById('spareModelSelect');
    var customModel = document.getElementById('spareCustomModel').value.trim();
    var serialNumber = document.getElementById('spareSerialNumber').value.trim();
    var assetTag = document.getElementById('spareAssetTag').value.trim();
    var assignedPerson = document.getElementById('spareAssignedPerson').value.trim();
    var position = document.getElementById('sparePositionSelect').value;
    var notes = document.getElementById('spareNotes').value.trim();
    var statusEl = document.getElementById('spareSaveStatus');
    var tagErrorEl = document.getElementById('spareAssetTagError');

    // Validation
    if (!serialNumber) {
      statusEl.className = 'save-status error';
      statusEl.textContent = 'Serial number is required';
      return;
    }

    // Validate asset tag starts with XS
    if (assetTag && !/^xs/i.test(assetTag)) {
      tagErrorEl.classList.remove('hidden');
      statusEl.className = 'save-status error';
      statusEl.textContent = 'Asset tag must start with XS (e.g., XS12345)';
      return;
    }

    var modelId = modelSelect.value || null;
    // Model is optional — no validation required

    statusEl.className = 'save-status pending';
    statusEl.textContent = 'Saving...';

    try {
      var data = {
        serial_number: serialNumber,
        model_id: modelId ? parseInt(modelId) : null,
        custom_model: customModel || null,
        asset_tag: assetTag || null,
        assigned_person: assignedPerson || null,
        position: position || null,
        notes: notes || null,
        item_status: document.getElementById('spareItemStatus').value,
      };
      await api.createSpareItem(data);
      statusEl.className = 'save-status success';
      statusEl.textContent = 'Spare item saved successfully!';
      // Clear form for next entry
      document.getElementById('spareSerialNumber').value = '';
      document.getElementById('spareAssetTag').value = '';
      document.getElementById('spareCustomModel').value = '';
      document.getElementById('spareAssignedPerson').value = '';
      document.getElementById('spareNotes').value = '';
      document.getElementById('sparePositionSelect').value = '';
      document.getElementById('spareItemStatus').value = 'IN USE';
      tagErrorEl.classList.add('hidden');
      modelSelect.value = '';
      document.getElementById('spareSerialNumber').focus();
      setTimeout(function () {
        statusEl.className = 'save-status';
        statusEl.textContent = '';
      }, 3000);
    } catch (err) {
      statusEl.className = 'save-status error';
      statusEl.textContent = err.message;
    }
  },

  // ===== SPARE LIST =====
  _spareCache: [],

  async _loadSpareList() {
    var tbody = document.getElementById('spareTableBody');
    var searchInput = document.getElementById('spareSearchInput');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Loading spare items...</td></tr>';

    try {
      var params = new URLSearchParams();
      params.set('item_category', 'spare');
      var search = searchInput ? searchInput.value.trim() : '';
      if (search) params.set('search', search);

      var res = await fetch('/api/assets?' + params.toString(), { headers: authHeaders() });
      if (!res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'Request failed (' + res.status + ')');
      }
      var items = await res.json();
      if (!Array.isArray(items)) {
        this.log('Unexpected response type:', typeof items);
        throw new Error('Invalid response from server');
      }
      this._spareCache = items;
      this._renderSpareList(items);
    } catch (err) {
      this.log('Failed to load spare list:', err.message);
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Error loading spare items: ' + esc(err.message) + '</td></tr>';
    }
  },

  _renderSpareList(items) {
    var tbody = document.getElementById('spareTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No spare items found. Register spare items from the form.</td></tr>';
      return;
    }

    items.forEach(function (item, idx) {
      var tr = document.createElement('tr');
      var modelName = item.custom_model || item.model_name || '';
      var statusClass = 'status-in-use';
      var statusLabel = item.item_status || 'IN USE';
      if (statusLabel === 'IN STOCK') statusClass = 'status-in-stock';
      else if (statusLabel === 'FAULTY') statusClass = 'status-faulty';
      tr.innerHTML =
        '<td>' + (idx + 1) + '</td>' +
        '<td>' + esc(modelName) + '</td>' +
        '<td class="mono">' + esc(item.serial_number || '') + '</td>' +
        '<td class="mono">' + esc(item.asset_tag || '') + '</td>' +
        '<td>' + esc(item.component_name || '') + '</td>' +
        '<td>' + esc(item.assigned_person || '') + '</td>' +
        '<td><span class="item-status-badge ' + statusClass + '">' + esc(statusLabel) + '</span></td>' +
        '<td class="text-sm">' + esc((item.notes || '').substring(0, 40)) + '</td>' +
        '<td class="text-secondary text-sm">' + (item.created_at ? new Date(item.created_at).toLocaleDateString() : '') + '</td>';
      tbody.appendChild(tr);
    });
  },

  _exportSpareList() {
    var items = this._spareCache || [];
    if (items.length === 0) {
      AppHelpers.toast('No spare items to export', 'warning');
      return;
    }

    // Build CSV
    var headers = ['serialNumber', 'model', 'customModel', 'assetTag', 'position', 'assignedPerson', 'itemStatus', 'notes', 'createdAt'];
    var csvRows = items.map(function (item) {
      return [
        csvField(item.serial_number || ''),
        csvField(item.model_name || ''),
        csvField(item.custom_model || ''),
        csvField(item.asset_tag || ''),
        csvField(item.component_name || ''),
        csvField(item.assigned_person || ''),
        csvField(item.item_status || 'IN USE'),
        csvField(item.notes || ''),
        csvField(item.created_at || ''),
      ].join(',');
    });
    var csv = [headers.join(','), ...csvRows].join('\n');

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'spare_items.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    AppHelpers.toast('Downloading spare CSV...', 'success');
  },

  // ===== SETTINGS =====
  _openSettings: function () {
    var overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;

    // Show mapping
    var prefixList = document.getElementById('settingsPrefixList');
    if (prefixList) {
      var html = '<table class="data-table"><thead><tr><th>Template</th><th>Prefix Codes</th></tr></thead><tbody>';
      for (var tpl in TEMPLATE_PREFIX_MAP) {
        if (TEMPLATE_PREFIX_MAP.hasOwnProperty(tpl)) {
          html += '<tr><td><strong>' + esc(tpl) + '</strong></td><td>' + (TEMPLATE_PREFIX_MAP[tpl] || []).join(', ') + '</td></tr>';
        }
      }
      html += '</tbody></table>';
      prefixList.innerHTML = html;
    }

    // Show host count
    var hostCount = document.getElementById('settingsHostCount');
    if (hostCount && typeof HOST_POSITIONS !== 'undefined') {
      hostCount.textContent = HOST_POSITIONS.length;
    }

    // Show API base
    var apiBase = document.getElementById('settingsApiBase');
    if (apiBase) {
      apiBase.value = window.API_BASE || '';
    }

    overlay.classList.remove('hidden');
  },
};

// CSV field helper for spare export
function csvField(val) {
  if (val === null || val === undefined) return '';
  var s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});