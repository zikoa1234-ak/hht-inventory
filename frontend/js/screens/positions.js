/* ============================================================
   Positions / Scanning Screen
   ============================================================ */

const PositionsScreen = {
  init() {
    this.scanPanel = document.getElementById('scanPanel');
    this.closeScanPanelBtn = document.getElementById('closeScanPanelBtn');
    this.editComponentId = document.getElementById('editComponentId');
    this.editCompName = document.getElementById('editCompName');
    this.editModelSelect = document.getElementById('editModelSelect');
    this.editCustomModel = document.getElementById('editCustomModel');
    this.editSerialNumber = document.getElementById('editSerialNumber');
    this.editAssetTag = document.getElementById('editAssetTag');
    this.editNotes = document.getElementById('editNotes');
    this.saveComponentBtn = document.getElementById('saveComponentBtn');
    this.clearComponentBtn = document.getElementById('clearComponentBtn');
    this.saveStatus = document.getElementById('saveStatus');
    this.scanPanelTitle = document.getElementById('scanPanelTitle');
    this.componentTableBody = document.getElementById('componentTableBody');
    this.positionDetailTitle = document.getElementById('positionDetailTitle');
    this.positionDetailMeta = document.getElementById('positionDetailMeta');
    this.changeTemplateBtn = document.getElementById('changeTemplateBtn');
    this.exportPositionDetailBtn = document.getElementById('exportPositionDetailBtn');
    this.addExtraComponentBtn = document.getElementById('addExtraComponentBtn');
    this.sumComplete = document.getElementById('sumComplete');
    this.sumPartial = document.getElementById('sumPartial');
    this.sumMissing = document.getElementById('sumMissing');

    // Barcode scanner: Enter on serial/asset triggers save
    this.editSerialNumber.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Auto-advance to asset tag
        this.editAssetTag.focus();
      }
    });
    this.editAssetTag.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._saveComponent();
      }
    });

    this.closeScanPanelBtn.addEventListener('click', () => this._closeScanPanel());
    this.saveComponentBtn.addEventListener('click', () => this._saveComponent());
    this.clearComponentBtn.addEventListener('click', () => this._clearFields());
    this.changeTemplateBtn.addEventListener('click', () => this._openChangeTemplate());
    this.exportPositionDetailBtn.addEventListener('click', () => this._exportPosition());
    this.addExtraComponentBtn.addEventListener('click', () => this._addExtraComponent());
  },

  async openPosition(positionId) {
    AppHelpers.showScreen('screen-position');
    this.positionDetailTitle.textContent = 'Loading...';
    this.scanPanel.classList.add('hidden');

    try {
      const data = await AppState.loadPositionDetail(positionId);
      this.positionDetailTitle.textContent = data.name || 'Position';
      this.positionDetailMeta.textContent = `${data.site_name || ''} — ${data.template_name || ''}`;
      await this._loadModelsIntoSelect();
      this._renderComponents();
      this._updateSummary();
      AppState.selectedPositionId = positionId;
    } catch (err) {
      AppHelpers.toast('Failed to load position: ' + err.message, 'error');
    }
  },

  async _loadModelsIntoSelect(selectEl) {
    const sel = selectEl || this.editModelSelect;
    sel.innerHTML = '<option value="">-- Select Model --</option>';
    try {
      const models = await AppState.loadModels();
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        sel.appendChild(opt);
      });
    } catch (_) {}
  },

  _renderComponents() {
    const tbody = this.componentTableBody;
    const components = AppState.currentComponents;
    tbody.innerHTML = '';

    if (components.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No components. Add an extra component or check the position.</td></tr>';
      return;
    }

    components.forEach((comp, idx) => {
      const tr = document.createElement('tr');
      const isExtra = comp.is_extra_component;
      const modelName = comp.custom_model || comp.model_name || '';
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${esc(comp.component_name)}${isExtra ? ' <span class="text-secondary text-sm">[extra]</span>' : ''}</td>
        <td>${esc(modelName)}</td>
        <td class="mono">${esc(comp.serial_number || '')}</td>
        <td class="mono">${esc(comp.asset_tag || '')}</td>
        <td>${esc(comp.notes || '')}</td>
        <td>${AppState.getStatusBadge(comp.status)}</td>
        <td class="text-secondary text-sm">${AppState.formatDate(comp.updated_at)}</td>
        <td>
          <button class="action-btn edit-comp-btn" data-id="${comp.id}">Edit</button>
          <button class="action-btn danger delete-comp-btn" data-id="${comp.id}">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-comp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const comp = AppState.currentComponents.find(c => c.id === id);
        if (comp) this._openScanPanel(comp);
      });
    });

    tbody.querySelectorAll('.delete-comp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        AppHelpers.confirm('Delete Component?', 'This will remove the component and its data permanently.', async () => {
          await api.deleteComponent(id);
          AppState.currentComponents = AppState.currentComponents.filter(c => c.id !== id);
          this._renderComponents();
          this._updateSummary();
          AppHelpers.toast('Component deleted', 'success');
        });
      });
    });
  },

  _updateSummary() {
    const comps = AppState.currentComponents;
    const complete = comps.filter(c => c.status === 'complete').length;
    const partial = comps.filter(c => c.status === 'partial').length;
    const missing = comps.filter(c => c.status === 'missing').length;
    this.sumComplete.textContent = complete;
    this.sumPartial.textContent = partial;
    this.sumMissing.textContent = missing;
  },

  _openScanPanel(comp) {
    this.scanPanel.classList.remove('hidden');
    this.scanPanelTitle.textContent = `Edit: ${comp.component_name}`;
    this.editComponentId.value = comp.id;
    this.editCompName.value = comp.component_name || '';

    // Set model
    if (comp.model_id) {
      this.editModelSelect.value = comp.model_id;
    } else {
      this.editModelSelect.value = '';
    }
    this.editCustomModel.value = comp.custom_model || '';
    this.editSerialNumber.value = comp.serial_number || '';
    this.editAssetTag.value = comp.asset_tag || '';
    this.editNotes.value = comp.notes || '';
    this.saveStatus.textContent = '';
    this.saveStatus.className = 'save-status';

    // Focus on serial for fast scanning
    if (!comp.serial_number) {
      setTimeout(() => this.editSerialNumber.focus(), 100);
    } else if (!comp.asset_tag) {
      setTimeout(() => this.editAssetTag.focus(), 100);
    } else {
      setTimeout(() => this.editSerialNumber.focus(), 100);
    }

    // Scroll to panel
    this.scanPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  _closeScanPanel() {
    this.scanPanel.classList.add('hidden');
    this.saveStatus.textContent = '';
    this.saveStatus.className = 'save-status';
  },

  _clearFields() {
    this.editSerialNumber.value = '';
    this.editAssetTag.value = '';
    this.editNotes.value = '';
    this.editCustomModel.value = '';
    this.editModelSelect.value = '';
    this.saveStatus.textContent = '';
    this.saveStatus.className = 'save-status';
    this.editSerialNumber.focus();
  },

  async _saveComponent() {
    const id = this.editComponentId.value;
    if (!id) {
      AppHelpers.toast('No component selected', 'error');
      return;
    }

    const data = {
      component_name: this.editCompName.value.trim(),
      serial_number: this.editSerialNumber.value.trim(),
      asset_tag: this.editAssetTag.value.trim(),
      notes: this.editNotes.value.trim(),
    };

    const modelId = this.editModelSelect.value;
    const customModel = this.editCustomModel.value.trim();

    if (modelId) {
      data.model_id = parseInt(modelId);
      data.custom_model = null;
    } else if (customModel) {
      data.model_id = null;
      data.custom_model = customModel;
    } else {
      data.model_id = null;
      data.custom_model = null;
    }

    // Show pending
    this.saveStatus.textContent = 'Saving...';
    this.saveStatus.className = 'save-status pending';
    this.saveComponentBtn.disabled = true;

    try {
      const updated = await api.updateComponent(parseInt(id), data);
      // Update local cache
      const idx = AppState.currentComponents.findIndex(c => c.id === parseInt(id));
      if (idx !== -1) {
        AppState.currentComponents[idx] = {
          ...AppState.currentComponents[idx],
          ...updated,
        };
      }
      this.saveStatus.textContent = 'Saved at ' + new Date().toLocaleTimeString();
      this.saveStatus.className = 'save-status success';
      this._renderComponents();
      this._updateSummary();
    } catch (err) {
      this.saveStatus.textContent = 'Error: ' + err.message;
      this.saveStatus.className = 'save-status error';
    } finally {
      this.saveComponentBtn.disabled = false;
    }
  },

  async _addExtraComponent() {
    const name = prompt('Enter extra component name:');
    if (!name || !name.trim()) return;
    try {
      const comp = await api.addExtraComponent(AppState.selectedPositionId, name.trim());
      AppState.currentComponents.push(comp);
      this._renderComponents();
      this._updateSummary();
      AppHelpers.toast('Extra component added', 'success');
    } catch (err) {
      AppHelpers.toast(err.message, 'error');
    }
  },

  _exportPosition() {
    if (!AppState.selectedPositionId) return;
    window.open(api.getExportPositionCsvUrl(AppState.selectedPositionId));
    AppHelpers.toast('Downloading CSV...', 'success');
  },

  async _openChangeTemplate() {
    const overlay = document.getElementById('changeTemplateOverlay');
    const select = document.getElementById('changeTemplateSelect');
    overlay.classList.remove('hidden');

    select.innerHTML = '<option value="">-- Select Template --</option>';
    const templates = await AppState.loadTemplates();
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      select.appendChild(opt);
    });

    const closeFns = () => {
      overlay.classList.add('hidden');
    };

    const handleConfirm = async () => {
      const newTemplateId = select.value;
      if (!newTemplateId) {
        AppHelpers.toast('Please select a template', 'error');
        return;
      }

      try {
        const result = await api.changePositionTemplate(AppState.selectedPositionId, parseInt(newTemplateId));
        AppState.currentPosition = result;
        AppState.currentComponents = result.components || [];
        overlay.classList.add('hidden');
        this.positionDetailMeta.textContent = `${result.site_name || ''} — ${result.template_name || ''}`;
        this._renderComponents();
        this._updateSummary();
        AppHelpers.toast('Template changed — safe merge applied', 'success');
      } catch (err) {
        AppHelpers.toast(err.message, 'error');
      }
    };

    document.getElementById('confirmChangeTemplateBtn').onclick = handleConfirm;
    overlay.querySelectorAll('.modal-close-btn').forEach(btn => btn.onclick = closeFns);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeFns();
    });
  },
};