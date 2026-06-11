/* ============================================================
   HHT Inventory — Main App Entry Point
   ============================================================ */

// Universal helpers (available before modules load)
const esc = (s) => {
  if (s === null || s === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};

const AppHelpers = {
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`screen-${name}`);
    if (el) el.classList.add('active');
  },

  toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
  },

  confirm(title, message, onConfirm) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    overlay.classList.remove('hidden');

    const close = () => overlay.classList.add('hidden');
    document.getElementById('confirmYesBtn').onclick = () => { close(); onConfirm(); };
    document.getElementById('confirmNoBtn').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  },
};

// ====== Application ======
const App = {
  async init() {
    console.log('HHT Inventory initializing...');

    // Setup navigation
    document.querySelectorAll('[data-screen]').forEach(el => {
      el.addEventListener('click', () => {
        const screen = el.dataset.screen;
        if (screen === 'templates') {
          AppHelpers.showScreen('templates');
          TemplatesScreen.render();
        } else if (screen === 'dashboard') {
          AppHelpers.showScreen('dashboard');
          this.refreshDashboard();
        }
      });
    });

    // Initialize screen modules
    TemplatesScreen.init();
    PositionsScreen.init();

    // Dashboard bindings
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

    // Create position modal
    this.createPositionOverlay = document.getElementById('createPositionOverlay');
    document.getElementById('confirmCreatePositionBtn').addEventListener('click', () => this._createPosition());
    this.createPositionOverlay.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.createPositionOverlay.classList.add('hidden'));
    });
    this.createPositionOverlay.addEventListener('click', (e) => {
      if (e.target === this.createPositionOverlay) {
        this.createPositionOverlay.classList.add('hidden');
      }
    });

    // Change template modal overlay
    document.getElementById('changeTemplateOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('changeTemplateOverlay')) {
        document.getElementById('changeTemplateOverlay').classList.add('hidden');
      }
    });

    // Confirm overlay
    document.getElementById('confirmOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('confirmOverlay')) {
        document.getElementById('confirmOverlay').classList.add('hidden');
      }
    });

    // Event listeners
    this.siteSelect.addEventListener('change', () => this._onFiltersChanged());
    this.templateSelect.addEventListener('change', () => this._onFiltersChanged());
    this.positionSelect.addEventListener('change', () => this._onPositionSelect());
    this.openPositionBtn.addEventListener('click', () => this._openSelectedPosition());
    this.createPositionBtn.addEventListener('click', () => this._openCreateModal());
    this.addSiteBtn.addEventListener('click', () => this._addSite());
    this.manageTemplatesBtn.addEventListener('click', () => {
      AppHelpers.showScreen('templates');
      TemplatesScreen.render();
    });
    this.exportAllBtn.addEventListener('click', () => this._exportAll());
    this.exportPositionBtn.addEventListener('click', () => this._exportSelected());

    // Load initial data
    await this.refreshDashboard();

    console.log('HHT Inventory ready');
  },

  async refreshDashboard() {
    try {
      const [sites, templates, positions] = await Promise.all([
        AppState.loadSites(),
        AppState.loadTemplates(),
        AppState.loadPositions(),
      ]);
      this._populateSelects(sites, templates, positions);
      this._renderSiteList(sites);
      this._renderPositionTable(positions);
    } catch (err) {
      AppHelpers.toast('Failed to load data: ' + err.message, 'error');
    }
  },

  _populateSelects(sites, templates, positions) {
    // Site select
    this.siteSelect.innerHTML = '<option value="">-- All Sites --</option>';
    sites.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      this.siteSelect.appendChild(opt);
    });

    // Template select
    this.templateSelect.innerHTML = '<option value="">-- All Templates --</option>';
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      this.templateSelect.appendChild(opt);
    });

    // Position select (filtered later)
    this._updatePositionSelect(positions);
  },

  _updatePositionSelect(positions) {
    const siteId = this.siteSelect.value;
    const templateId = this.templateSelect.value;

    this.positionSelect.innerHTML = '<option value="">-- Select Position --</option>';
    let filtered = positions;
    if (siteId) filtered = filtered.filter(p => p.site_id === parseInt(siteId));
    if (templateId) filtered = filtered.filter(p => p.template_id === parseInt(templateId));

    filtered.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.site_name})`;
      this.positionSelect.appendChild(opt);
    });

    this.openPositionBtn.disabled = true;
    this.exportPositionBtn.disabled = true;
  },

  _renderSiteList(sites) {
    const list = this.siteList;
    list.innerHTML = '';
    sites.forEach(s => {
      const div = document.createElement('div');
      div.className = 'compact-list-item';
      div.innerHTML = `
        <span>${esc(s.name)}</span>
      `;
      list.appendChild(div);
    });
  },

  _renderPositionTable(positions) {
    const tbody = this.positionTableBody;
    tbody.innerHTML = '';

    const siteId = this.siteSelect.value;
    const templateId = this.templateSelect.value;
    let filtered = positions;
    if (siteId) filtered = filtered.filter(p => p.site_id === parseInt(siteId));
    if (templateId) filtered = filtered.filter(p => p.template_id === parseInt(templateId));

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No positions found.</td></tr>';
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td>${esc(p.site_name)}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.template_name)}</td>
        <td>${p.total_components}</td>
        <td>${p.completed_components}</td>
        <td>${p.partial_components}</td>
        <td>${p.missing_components}</td>
        <td class="text-secondary text-sm">${AppState.formatDate(p.updated_at)}</td>
      `;
      tr.addEventListener('click', () => {
        PositionsScreen.openPosition(p.id);
      });
      tbody.appendChild(tr);
    });
  },

  _onFiltersChanged() {
    this._updatePositionSelect(AppState.positions);
    this._renderPositionTable(AppState.positions);
  },

  _onPositionSelect() {
    const val = this.positionSelect.value;
    this.openPositionBtn.disabled = !val;
    this.exportPositionBtn.disabled = !val;
  },

  _openSelectedPosition() {
    const id = this.positionSelect.value;
    if (id) PositionsScreen.openPosition(parseInt(id));
  },

  async _openCreateModal() {
    const overlay = this.createPositionOverlay;
    const siteSelect = document.getElementById('createPositionSite');
    const templateSelect = document.getElementById('createPositionTemplate');

    siteSelect.innerHTML = '';
    templateSelect.innerHTML = '';

    const [sites, templates] = await Promise.all([
      AppState.loadSites(),
      AppState.loadTemplates(),
    ]);

    sites.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      siteSelect.appendChild(opt);
    });

    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      templateSelect.appendChild(opt);
    });

    document.getElementById('createPositionName').value = '';
    overlay.classList.remove('hidden');
    document.getElementById('createPositionName').focus();
  },

  async _createPosition() {
    const siteId = document.getElementById('createPositionSite').value;
    const templateId = document.getElementById('createPositionTemplate').value;
    const name = document.getElementById('createPositionName').value.trim();

    if (!siteId || !templateId || !name) {
      AppHelpers.toast('All fields required', 'error');
      return;
    }

    try {
      const pos = await api.createPosition({
        site_id: parseInt(siteId),
        template_id: parseInt(templateId),
        name,
      });
      this.createPositionOverlay.classList.add('hidden');
      AppHelpers.toast(`Position "${name}" created!`, 'success');
      await this.refreshDashboard();
      // Open the new position
      PositionsScreen.openPosition(pos.id);
    } catch (err) {
      AppHelpers.toast(err.message, 'error');
    }
  },

  async _addSite() {
    const name = prompt('Enter site name:');
    if (!name || !name.trim()) return;
    try {
      await api.createSite(name.trim());
      await this.refreshDashboard();
      AppHelpers.toast(`Site "${name}" created`, 'success');
    } catch (err) {
      AppHelpers.toast(err.message, 'error');
    }
  },

  _exportAll() {
    const siteId = this.siteSelect.value || '';
    const templateId = this.templateSelect.value || '';
    window.open(api.getExportAllCsvUrl(siteId, templateId));
    AppHelpers.toast('Downloading all positions CSV...', 'success');
  },

  _exportSelected() {
    const id = this.positionSelect.value;
    if (id) {
      window.open(api.getExportPositionCsvUrl(parseInt(id)));
      AppHelpers.toast('Downloading CSV...', 'success');
    }
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());