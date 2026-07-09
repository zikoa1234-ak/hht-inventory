/* ============================================================
   Assets Screen — Location → Area → Asset Workspace
   ============================================================ */

const LOCATIONS = [
  'CMN', 'RAK', 'AGA', 'TNG', 'FEZ', 'EUN', 'VIL', 'OZZ',
  'ESU', 'RBA', 'AHU', 'OUD', 'NDR', 'GLN', 'TTU', 'ERH',
  'BEM', 'OZG'
];

const AREAS = ['Back Office', 'Checking', 'Gate'];

const ASSET_STATUSES = ['Active', 'In Repair', 'In Stock', 'Retired'];

const AssetsScreen = {
  DEBUG: true,

  // Current context
  selectedLocation: null,
  selectedArea: null,
  assets: [],

  log() {
    if (this.DEBUG) console.log('[Assets]', ...arguments);
  },

  init() {
    this.locationGrid = document.getElementById('locationGrid');
    this.areaGrid = document.getElementById('areaGrid');
    this.assetTableBody = document.getElementById('assetTableBody');
    this.assetHeaderTitle = document.getElementById('assetHeaderTitle');
    this.assetBreadcrumb = document.getElementById('assetBreadcrumb');
    this.changeLocationBtn = document.getElementById('changeLocationBtn');
    this.changeAreaBtn = document.getElementById('changeAreaBtn');
    this.addAssetBtn = document.getElementById('addAssetBtn');
    this.assetSearch = document.getElementById('assetSearch');
    this.assetFilterPerson = document.getElementById('assetFilterPerson');
    this.assetFilterStatus = document.getElementById('assetFilterStatus');
    this.assetEmptyState = document.getElementById('assetEmptyState');

    // Asset form modal
    this.assetFormOverlay = document.getElementById('assetFormOverlay');
    this.assetFormTitle = document.getElementById('assetFormTitle');
    this.assetForm = document.getElementById('assetForm');
    this.afAssetId = document.getElementById('afAssetId');
    this.afLocation = document.getElementById('afLocation');
    this.afArea = document.getElementById('afArea');
    this.afPosition = document.getElementById('afPosition');
    this.afBox = document.getElementById('afBox');
    this.afAssetName = document.getElementById('afAssetName');
    this.afSerialNumber = document.getElementById('afSerialNumber');
    this.afAssignedPerson = document.getElementById('afAssignedPerson');
    this.afStatus = document.getElementById('afStatus');
    this.afNotes = document.getElementById('afNotes');
    this.afSerialError = document.getElementById('afSerialError');
    this.afSaveBtn = document.getElementById('afSaveBtn');
    this.afCancelBtn = document.getElementById('afCancelBtn');

    // View modal
    this.viewOverlay = document.getElementById('viewAssetOverlay');
    this.viewContent = document.getElementById('viewAssetContent');

    if (this.changeLocationBtn) {
      this.changeLocationBtn.addEventListener('click', () => this._showLocationPicker());
    }
    if (this.changeAreaBtn) {
      this.changeAreaBtn.addEventListener('click', () => this._showAreaPicker());
    }
    if (this.addAssetBtn) {
      this.addAssetBtn.addEventListener('click', () => this._openCreateForm());
    }
    if (this.assetSearch) {
      this.assetSearch.addEventListener('input', () => this._onFilterChange());
    }
    if (this.assetFilterPerson) {
      this.assetFilterPerson.addEventListener('change', () => this._onFilterChange());
    }
    if (this.assetFilterStatus) {
      this.assetFilterStatus.addEventListener('change', () => this._onFilterChange());
    }

    // Form save/cancel
    if (this.afSaveBtn) {
      this.afSaveBtn.addEventListener('click', () => this._saveAsset());
    }
    if (this.afCancelBtn) {
      this.afCancelBtn.addEventListener('click', () => this._closeForm());
    }

    // Real-time duplicate check on serial number input
    if (this.afSerialNumber) {
      this.afSerialNumber.addEventListener('input', () => this._checkSerialDuplicate());
    }

    // Close overlays on outside click
    if (this.assetFormOverlay) {
      this.assetFormOverlay.addEventListener('click', (e) => {
        if (e.target === this.assetFormOverlay) this._closeForm();
      });
    }
    if (this.viewOverlay) {
      this.viewOverlay.addEventListener('click', (e) => {
        if (e.target === this.viewOverlay) this._closeView();
      });
    }

    // Close buttons on modals
    document.querySelectorAll('#assetFormOverlay .modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this._closeForm());
    });
    document.querySelectorAll('#viewAssetOverlay .modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this._closeView());
    });
  },

  // ===== NAVIGATION =====
  showLocationPicker() {
    this._showLocationPicker();
  },

  _showLocationPicker() {
    this.selectedLocation = null;
    this.selectedArea = null;
    AppHelpers.showScreen('locations');
    this._renderLocations();
  },

  _showAreaPicker() {
    if (!this.selectedLocation) return;
    AppHelpers.showScreen('areas');
    this._renderAreas();
  },

  _showAssetWorkspace() {
    AppHelpers.showScreen('assets');
    this._updateHeader();
    this._loadAssets();
  },

  // ===== LOCATIONS =====
  _renderLocations() {
    const grid = this.locationGrid;
    if (!grid) return;
    grid.innerHTML = '';
    LOCATIONS.forEach(loc => {
      const btn = document.createElement('button');
      btn.className = 'location-card';
      btn.textContent = loc;
      btn.addEventListener('click', () => {
        this.selectedLocation = loc;
        this._showAreaPicker();
      });
      grid.appendChild(btn);
    });
  },

  // ===== AREAS =====
  _renderAreas() {
    const grid = this.areaGrid;
    if (!grid) return;
    grid.innerHTML = '';
    AREAS.forEach(area => {
      const btn = document.createElement('button');
      btn.className = 'location-card';
      btn.textContent = area;
      btn.addEventListener('click', () => {
        this.selectedArea = area;
        this._showAssetWorkspace();
      });
      grid.appendChild(btn);
    });

    // Update location context
    const locSpan = document.getElementById('areaLocationLabel');
    if (locSpan) locSpan.textContent = this.selectedLocation;
  },

  // ===== ASSET WORKSPACE =====
  _updateHeader() {
    if (this.assetHeaderTitle) {
      this.assetHeaderTitle.textContent = this.selectedLocation + ' - ' + this.selectedArea;
    }
    if (this.assetBreadcrumb) {
      this.assetBreadcrumb.innerHTML =
        '<a href="#" id="breadcrumbLocations">Locations</a>' +
        ' / ' + this.selectedLocation +
        ' / ' + this.selectedArea;
      const locLink = document.getElementById('breadcrumbLocations');
      if (locLink) {
        locLink.addEventListener('click', (e) => {
          e.preventDefault();
          this._showLocationPicker();
        });
      }
    }

    // Populate filter dropdowns
    this._populateFilterDropdowns();
  },

  _populateFilterDropdowns() {
    // Person filter
    const personSelect = this.assetFilterPerson;
    if (personSelect) {
      personSelect.innerHTML = '<option value="">All People</option>';
      ASSIGNED_PEOPLE.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        personSelect.appendChild(opt);
      });
    }

    // Status filter
    const statusSelect = this.assetFilterStatus;
    if (statusSelect) {
      statusSelect.innerHTML = '<option value="">All Statuses</option>';
      ASSET_STATUSES.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        statusSelect.appendChild(opt);
      });
    }
  },

  async _loadAssets() {
    if (!this.assetTableBody) return;
    this.assetTableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Loading...</td></tr>';
    if (this.assetEmptyState) this.assetEmptyState.classList.add('hidden');

    try {
      const params = new URLSearchParams();
      params.set('location', this.selectedLocation);
      params.set('area', this.selectedArea);

      const search = this.assetSearch ? this.assetSearch.value.trim() : '';
      if (search) params.set('search', search);

      const person = this.assetFilterPerson ? this.assetFilterPerson.value : '';
      if (person) params.set('assigned_person', person);

      const status = this.assetFilterStatus ? this.assetFilterStatus.value : '';
      if (status) params.set('asset_status', status);

      const res = await fetch('/api/assets?' + params.toString(), { headers: authHeaders() });
      this.assets = await res.json();
      this._renderAssets();
    } catch (err) {
      this.log('Failed to load assets:', err);
      this.assetTableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Error loading assets: ' + esc(err.message) + '</td></tr>';
    }
  },

  _renderAssets() {
    const tbody = this.assetTableBody;
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!this.assets || this.assets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No assets yet for this location and area</td></tr>';
      if (this.assetEmptyState) this.assetEmptyState.classList.remove('hidden');
      return;
    }

    if (this.assetEmptyState) this.assetEmptyState.classList.add('hidden');

    this.assets.forEach(asset => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Click to view details';

      const statusClass = (asset.asset_status || 'Active').toLowerCase().replace(/ /g, '-');

      tr.innerHTML = `
        <td>${esc(asset.component_name || '')}</td>
        <td>${esc(asset.box || '')}</td>
        <td><strong>${esc(asset.asset_name || '')}</strong></td>
        <td class="mono">${esc(asset.serial_number || '')}</td>
        <td>${esc(asset.assigned_person || '')}</td>
        <td><span class="asset-status-badge status-${esc(statusClass)}">${esc(asset.asset_status || 'Active')}</span></td>
        <td>
          <button class="action-btn view-asset-btn" data-id="${asset.id}">View</button>
          <button class="action-btn edit-asset-btn" data-id="${asset.id}">Edit</button>
          <button class="action-btn danger delete-asset-btn" data-id="${asset.id}">Del</button>
        </td>
      `;

      // Row click for view
      tr.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        this._viewAsset(asset);
      });

      tbody.appendChild(tr);
    });

    // Bind action buttons
    tbody.querySelectorAll('.view-asset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const asset = this.assets.find(a => String(a.id) === btn.dataset.id);
        if (asset) this._viewAsset(asset);
      });
    });

    tbody.querySelectorAll('.edit-asset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const asset = this.assets.find(a => String(a.id) === btn.dataset.id);
        if (asset) this._openEditForm(asset);
      });
    });

    tbody.querySelectorAll('.delete-asset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        AppHelpers.confirm('Delete Asset?', 'This will permanently remove this asset record.', async () => {
          try {
            await fetch('/api/assets/' + id, { method: 'DELETE', headers: authHeaders() });
            AppHelpers.toast('Asset deleted', 'success');
            this._loadAssets();
          } catch (err) {
            AppHelpers.toast(err.message, 'error');
          }
        });
      });
    });
  },

  _onFilterChange() {
    this._loadAssets();
  },

  // Real-time duplicate serial number check (assets form)
  _checkSerialDuplicateDebounceTimer: null,
  _checkSerialDuplicate() {
    const serial = (this.afSerialNumber ? this.afSerialNumber.value : '').trim();
    if (this.afSerialError) {
      this.afSerialError.classList.add('hidden');
      this.afSerialError.textContent = '';
    }
    if (!serial) return;

    if (this._checkSerialDuplicateDebounceTimer) {
      clearTimeout(this._checkSerialDuplicateDebounceTimer);
    }

    this._checkSerialDuplicateDebounceTimer = setTimeout(async () => {
      try {
        const excludeId = this.afAssetId ? this.afAssetId.value : '';
        const params = new URLSearchParams({ serial });
        if (excludeId) params.set('exclude_id', excludeId);

        const res = await fetch('/api/assets/check-serial?' + params.toString(), { headers: authHeaders() });
        const data = await res.json();

        if (data.exists && this.afSerialError) {
          this.afSerialError.textContent = 'Duplicate serial number or asset tag detected. Asset was not saved.';
          this.afSerialError.classList.remove('hidden');
        }
      } catch (_) {
        // Silent fail — backend catches duplicates on submit
      }
    }, 400);
  },

  // ===== VIEW ASSET =====
  _viewAsset(asset) {
    if (!this.viewOverlay || !this.viewContent) return;
    const statusClass = (asset.asset_status || 'Active').toLowerCase().replace(/ /g, '-');
    this.viewContent.innerHTML = `
      <div class="asset-detail-grid">
        <div class="form-group">
          <label class="form-label">Location</label>
          <p><strong>${esc(asset.location)}</strong></p>
        </div>
        <div class="form-group">
          <label class="form-label">Area</label>
          <p><strong>${esc(asset.area)}</strong></p>
        </div>
        <div class="form-group">
          <label class="form-label">Position</label>
          <p>${esc(asset.component_name || '-')}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Box</label>
          <p>${esc(asset.box || '-')}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Asset Name</label>
          <p><strong>${esc(asset.asset_name || '-')}</strong></p>
        </div>
        <div class="form-group">
          <label class="form-label">Serial Number</label>
          <p class="mono">${esc(asset.serial_number || '-')}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Assigned Person</label>
          <p>${esc(asset.assigned_person || '-')}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <p><span class="asset-status-badge status-${esc(statusClass)}">${esc(asset.asset_status || 'Active')}</span></p>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Notes</label>
          <p>${esc(asset.notes || '-')}</p>
        </div>
      </div>
    `;
    this.viewOverlay.classList.remove('hidden');
  },

  _closeView() {
    if (this.viewOverlay) this.viewOverlay.classList.add('hidden');
  },

  // ===== CREATE / EDIT FORM =====
  _openCreateForm() {
    this._openForm(null);
  },

  _openEditForm(asset) {
    this._openForm(asset);
  },

  _openForm(asset) {
    if (!this.assetFormOverlay) return;

    const isEdit = !!asset;

    this.assetFormTitle.textContent = isEdit ? 'Edit Asset' : 'Add Asset';
    this.afAssetId.value = isEdit ? asset.id : '';

    // Auto-fill location and area from workspace context
    this.afLocation.value = isEdit ? (asset.location || '') : this.selectedLocation;
    this.afArea.value = isEdit ? (asset.area || '') : this.selectedArea;
    this.afPosition.value = isEdit ? (asset.component_name || '') : '';
    this.afBox.value = isEdit ? (asset.box || '') : '';
    this.afAssetName.value = isEdit ? (asset.asset_name || '') : '';
    this.afSerialNumber.value = isEdit ? (asset.serial_number || '') : '';
    this.afAssignedPerson.value = isEdit ? (asset.assigned_person || '') : '';
    this.afStatus.value = isEdit ? (asset.asset_status || 'Active') : 'Active';
    this.afNotes.value = isEdit ? (asset.notes || '') : '';
    this.afSerialError.classList.add('hidden');
    this.afSerialError.textContent = '';

    // Populate assigned person dropdown
    this._populatePersonSelect(this.afAssignedPerson, isEdit ? asset.assigned_person : '');

    this.assetFormOverlay.classList.remove('hidden');
    if (this.afAssetName) setTimeout(() => this.afAssetName.focus(), 100);
  },

  _populatePersonSelect(selectEl, selectedValue) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">-- Assign Person --</option>';
    ASSIGNED_PEOPLE.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (selectedValue && selectedValue === name) opt.selected = true;
      selectEl.appendChild(opt);
    });
  },

  _closeForm() {
    if (this.assetFormOverlay) this.assetFormOverlay.classList.add('hidden');
    if (this.afSerialError) {
      this.afSerialError.classList.add('hidden');
      this.afSerialError.textContent = '';
    }
  },

  async _saveAsset() {
    const isEdit = !!this.afAssetId.value;

    // Required field validation
    const location = this.afLocation.value.trim();
    const area = this.afArea.value.trim();
    const position = this.afPosition.value.trim();
    const asset_name = this.afAssetName.value.trim();
    const serial_number = this.afSerialNumber.value.trim();

    if (!location || !area || !position || !asset_name || !serial_number) {
      AppHelpers.toast('Required fields: Location, Area, Position, Asset Name, Serial Number', 'error');
      return;
    }

    const data = {
      location,
      area,
      position,
      box: this.afBox.value.trim() || null,
      asset_name,
      serial_number,
      assigned_person: this.afAssignedPerson.value || null,
      asset_status: this.afStatus.value,
      notes: this.afNotes.value.trim() || null,
    };

    this.afSaveBtn.disabled = true;
    this.afSaveBtn.textContent = 'Saving...';
    this.afSerialError.classList.add('hidden');

    try {
      let res;
      const ah = authHeaders();
      if (isEdit) {
        res = await fetch('/api/assets/' + this.afAssetId.value, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...ah },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...ah },
          body: JSON.stringify(data),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        const errMsg = errData.error || 'API error ' + res.status;

        if (errMsg === 'Duplicate serial number or asset tag detected. Asset was not saved.') {
          this.afSerialError.textContent = 'Duplicate serial number or asset tag detected. Asset was not saved.';
          this.afSerialError.classList.remove('hidden');
          if (this.afSerialNumber) this.afSerialNumber.focus();
        } else {
          AppHelpers.toast(errMsg, 'error');
        }
        this.afSaveBtn.disabled = false;
        this.afSaveBtn.textContent = isEdit ? 'Save Changes' : 'Add Asset';
        return;
      }

      this._closeForm();
      AppHelpers.toast(isEdit ? 'Asset updated' : 'Asset created', 'success');
      this._loadAssets();
    } catch (err) {
      AppHelpers.toast('Network error: ' + err.message, 'error');
    } finally {
      this.afSaveBtn.disabled = false;
      this.afSaveBtn.textContent = isEdit ? 'Save Changes' : 'Add Asset';
    }
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  if (typeof AssetsScreen !== 'undefined' && AssetsScreen.init) {
    AssetsScreen.init();
  }
});