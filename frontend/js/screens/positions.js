/* ============================================================
   Positions / Scanning Screen — Defensive Rendering
   ============================================================ */

const PositionsScreen = {
  DEBUG: true,

  log(...args) {
    if (this.DEBUG) console.log('[Positions]', ...args);
  },

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

    // Guard against missing DOM elements
    if (!this.scanPanel || !this.componentTableBody) {
      console.error('[Positions] CRITICAL: missing DOM elements for position screen');
    }

    // Barcode scanner: Enter advances fields, second Enter saves
    if (this.editSerialNumber) {
      this.editSerialNumber.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.log('Serial Enter -> focus asset tag');
          if (this.editAssetTag) this.editAssetTag.focus();
        }
      });
    }
    if (this.editAssetTag) {
      this.editAssetTag.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.log('AssetTag Enter -> save component');
          this._saveComponent();
        }
      });
    }

    if (this.closeScanPanelBtn) {
      this.closeScanPanelBtn.addEventListener('click', () => this._closeScanPanel());
    }
    if (this.saveComponentBtn) {
      this.saveComponentBtn.addEventListener('click', () => this._saveComponent());
    }
    if (this.clearComponentBtn) {
      this.clearComponentBtn.addEventListener('click', () => this._clearFields());
    }
    if (this.changeTemplateBtn) {
      this.changeTemplateBtn.addEventListener('click', () => this._openChangeTemplate());
    }
    if (this.exportPositionDetailBtn) {
      this.exportPositionDetailBtn.addEventListener('click', () => this._exportPosition());
    }
    if (this.addExtraComponentBtn) {
      this.addExtraComponentBtn.addEventListener('click', () => this._addExtraComponent());
    }
  },

  // ===== MAIN ENTRY: open a position =====
  async openPosition(positionId) {
    this.log('openPosition called with id:', positionId);

    if (!positionId) {
      this.log('ERROR: no positionId provided');
      AppHelpers.toast('No position selected', 'error');
      this._renderFallback('No position selected. Go back and choose one.');
      return;
    }

    // Show screen immediately with loading state — NEVER blank
    AppHelpers.showScreen('screen-position');
    this._renderLoadingState(positionId);

    // Close any open scan panel
    if (this.scanPanel) this.scanPanel.classList.add('hidden');

    try {
      // Load models in parallel
      const modelsPromise = AppState.loadModels().catch(err => {
        this.log('Models load failed (non-fatal):', err.message);
        return [];
      });

      // Fetch position detail from backend
      this.log('Fetching position detail for id:', positionId);
      let data;
      try {
        data = await AppState.loadPositionDetail(positionId);
      } catch (fetchErr) {
        this.log('Backend fetch failed:', fetchErr.message);
        // If backend fails, still show the position with default template components
        data = await this._fallbackPositionFromTemplate(positionId);
        if (!data) {
          this._renderFallback('Could not load position data. The server may be unavailable.');
          AppHelpers.toast('Failed to load position: ' + fetchErr.message, 'error');
          return;
        }
      }

      this.log('Position data loaded:', data ? data.name : 'null', '| components:', data && data.components ? data.components.length : 0);

      // Defensive: ensure data has all expected fields
      data = data || {};
      data.name = data.name || 'Position #' + positionId;
      data.site_name = data.site_name || '';
      data.template_name = data.template_name || '';
      data.components = data.components || [];

      // Set header
      if (this.positionDetailTitle) {
        this.positionDetailTitle.textContent = data.name;
      }
      if (this.positionDetailMeta) {
        this.positionDetailMeta.textContent = (data.site_name || '') + ' — ' + (data.template_name || '');
      }

      AppState.selectedPositionId = positionId;

      // Load models into select
      await this._loadModelsIntoSelect();

      // Render components — always renders something, never blank
      this._renderComponents();

      // Update summary counts
      this._updateSummary();

      this.log('Position screen rendered successfully | components:', AppState.currentComponents.length);
    } catch (err) {
      this.log('CRITICAL error in openPosition:', err.message);
      console.error('[Positions] openPosition error:', err);
      this._renderFallback('An unexpected error occurred: ' + err.message);
      AppHelpers.toast('Error: ' + err.message, 'error');
    }
  },

  // Fallback: if backend has no record, try to initialize from template + hosts data
  async _fallbackPositionFromTemplate(positionId) {
    this.log('Attempting fallback for position id:', positionId);
    try {
      // Get template info from the position's name
      const posFromState = AppState.positions.find(p => p.id === positionId);
      if (!posFromState) {
        this.log('No position found in state for id:', positionId);
        return null;
      }

      const hostInfo = classifyHost(posFromState.name);
      const templateName = hostInfo.template || posFromState.template_name;
      this.log('Host classification:', hostInfo, '-> template:', templateName);

      // Try to create the position via API with a template
      let templateId = posFromState.template_id;
      if (!templateId && templateName) {
        const templates = await AppState.loadTemplates();
        const tpl = templates.find(t => t.name.toLowerCase() === templateName.toLowerCase());
        if (tpl) templateId = tpl.id;
      }

      if (!templateId) {
        this.log('No template found for position:', posFromState.name);
        return null;
      }

      // Try to create the position on the backend
      this.log('Creating position on backend:', posFromState.name, 'template:', templateId);
      const siteId = posFromState.site_id || 1;
      const newPos = await api.createPosition({
        site_id: siteId,
        template_id: templateId,
        name: posFromState.name,
      });
      this.log('Position created on backend:', newPos.id);
      return await AppState.loadPositionDetail(newPos.id);
    } catch (err) {
      this.log('Fallback creation failed:', err.message);
      return null;
    }
  },

  // ===== RENDER: never blank =====
  _renderComponents() {
    const tbody = this.componentTableBody;
    if (!tbody) {
      console.error('[Positions] componentTableBody DOM element missing');
      return;
    }

    const components = AppState.currentComponents || [];
    tbody.innerHTML = '';

    if (!Array.isArray(components) || components.length === 0) {
      // Show helpful empty state with instructions
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-state">
            <p><strong>No components loaded for this position.</strong></p>
            <p class="text-secondary">Possible reasons:</p>
            <ul style="text-align:left;display:inline-block;margin:4px 0;font-size:12px;color:var(--text-secondary);">
              <li>The template may not be assigned yet</li>
              <li>The position may not be created on the server yet</li>
              <li>Use "Change Template" to assign a template to this position</li>
              <li>Or click "+ Extra" to add a manual component</li>
            </ul>
          </td>
        </tr>`;
      this.log('Rendered empty state — no components');
      return;
    }

    this.log('Rendering', components.length, 'components');

    components.forEach((comp, idx) => {
      // Guard: ensure comp is an object
      if (!comp || typeof comp !== 'object') {
        this.log('Skipping invalid component at index', idx);
        return;
      }

      const tr = document.createElement('tr');
      const isExtra = comp.is_extra_component;
      const modelName = (comp.custom_model || comp.model_name || '');
      const serialNum = comp.serial_number || '';
      const assetTag = comp.asset_tag || '';
      const notes = comp.notes || '';

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${esc(comp.component_name || '?' )}${isExtra ? ' <span class="text-secondary text-sm">[extra]</span>' : ''}</td>
        <td>${esc(modelName)}</td>
        <td class="mono">${esc(serialNum)}</td>
        <td class="mono">${esc(assetTag)}</td>
        <td>${esc(notes)}</td>
        <td>${AppState.getStatusBadge(comp.status || 'missing')}</td>
        <td class="text-secondary text-sm">${AppState.formatDate(comp.updated_at)}</td>
        <td>
          <button class="action-btn edit-comp-btn" data-id="${comp.id || ''}">Edit</button>
          <button class="action-btn danger delete-comp-btn" data-id="${comp.id || ''}">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind edit buttons
    tbody.querySelectorAll('.edit-comp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (!id) {
          AppHelpers.toast('Component not saved yet — scan data first', 'warning');
          return;
        }
        const comp = (AppState.currentComponents || []).find(c => String(c.id) === String(id));
        if (comp) {
          this._openScanPanel(comp);
        } else {
          this.log('Component not found in cache for id:', id);
          AppHelpers.toast('Component data not available', 'error');
        }
      });
    });

    // Bind delete buttons
    tbody.querySelectorAll('.delete-comp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (!id) return;
        AppHelpers.confirm('Delete Component?', 'This will remove the component and its data permanently.', async () => {
          try {
            await api.deleteComponent(parseInt(id));
            AppState.currentComponents = (AppState.currentComponents || []).filter(c => String(c.id) !== String(id));
            this._renderComponents();
            this._updateSummary();
            AppHelpers.toast('Component deleted', 'success');
          } catch (err) {
            AppHelpers.toast(err.message, 'error');
          }
        });
      });
    });
  },

  _updateSummary() {
    const comps = AppState.currentComponents || [];
    const complete = comps.filter(c => c && c.status === 'complete').length;
    const partial = comps.filter(c => c && c.status === 'partial').length;
    const missing = comps.filter(c => c && c.status === 'missing').length;

    if (this.sumComplete) this.sumComplete.textContent = complete;
    if (this.sumPartial) this.sumPartial.textContent = partial;
    if (this.sumMissing) this.sumMissing.textContent = missing;

    this.log('Summary — complete:', complete, 'partial:', partial, 'missing:', missing);
  },

  _renderLoadingState(positionId) {
    if (this.positionDetailTitle) {
      this.positionDetailTitle.textContent = 'Loading position...';
    }
    if (this.positionDetailMeta) {
      this.positionDetailMeta.textContent = 'Loading...';
    }
    const tbody = this.componentTableBody;
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Loading component data...</td></tr>';
    }
    if (this.sumComplete) this.sumComplete.textContent = '-';
    if (this.sumPartial) this.sumPartial.textContent = '-';
    if (this.sumMissing) this.sumMissing.textContent = '-';
  },

  _renderFallback(message) {
    if (this.positionDetailTitle) {
      this.positionDetailTitle.textContent = 'Error Loading Position';
    }
    const tbody = this.componentTableBody;
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${esc(message)}</td></tr>`;
    }
    if (this.sumComplete) this.sumComplete.textContent = '0';
    if (this.sumPartial) this.sumPartial.textContent = '0';
    if (this.sumMissing) this.sumMissing.textContent = '0';
  },

  // ===== MODELS =====
  async _loadModelsIntoSelect(selectEl) {
    const sel = selectEl || this.editModelSelect;
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Model --</option>';
    try {
      const models = AppState.models.length ? AppState.models : await AppState.loadModels();
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        sel.appendChild(opt);
      });
    } catch (_) {
      this.log('Model load failed (non-fatal)');
    }
  },

  // ===== SCAN PANEL =====
  _openScanPanel(comp) {
    if (!this.scanPanel || !comp) return;

    this.scanPanel.classList.remove('hidden');
    this.scanPanelTitle.textContent = 'Edit: ' + (comp.component_name || 'Component');
    if (this.editComponentId) this.editComponentId.value = comp.id || '';
    if (this.editCompName) this.editCompName.value = comp.component_name || '';

    if (this.editModelSelect) {
      if (comp.model_id) {
        this.editModelSelect.value = comp.model_id;
      } else {
        this.editModelSelect.value = '';
      }
    }
    if (this.editCustomModel) this.editCustomModel.value = comp.custom_model || '';
    if (this.editSerialNumber) this.editSerialNumber.value = comp.serial_number || '';
    if (this.editAssetTag) this.editAssetTag.value = comp.asset_tag || '';
    if (this.editNotes) this.editNotes.value = comp.notes || '';
    if (this.saveStatus) {
      this.saveStatus.textContent = '';
      this.saveStatus.className = 'save-status';
    }

    // Focus for fast scanning
    setTimeout(() => {
      if (!comp.serial_number && this.editSerialNumber) {
        this.editSerialNumber.focus();
      } else if (this.editAssetTag) {
        this.editAssetTag.focus();
      }
    }, 150);

    this.scanPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  _closeScanPanel() {
    if (this.scanPanel) this.scanPanel.classList.add('hidden');
    if (this.saveStatus) {
      this.saveStatus.textContent = '';
      this.saveStatus.className = 'save-status';
    }
  },

  _clearFields() {
    if (this.editSerialNumber) this.editSerialNumber.value = '';
    if (this.editAssetTag) this.editAssetTag.value = '';
    if (this.editNotes) this.editNotes.value = '';
    if (this.editCustomModel) this.editCustomModel.value = '';
    if (this.editModelSelect) this.editModelSelect.value = '';
    if (this.saveStatus) {
      this.saveStatus.textContent = '';
      this.saveStatus.className = 'save-status';
    }
    setTimeout(() => { if (this.editSerialNumber) this.editSerialNumber.focus(); }, 50);
  },

  async _saveComponent() {
    const id = this.editComponentId ? this.editComponentId.value : '';
    if (!id) {
      AppHelpers.toast('No component selected — click Edit on a component row first', 'warning');
      return;
    }

    const data = {
      component_name: (this.editCompName ? this.editCompName.value.trim() : '') || undefined,
      serial_number: (this.editSerialNumber ? this.editSerialNumber.value.trim() : '') || null,
      asset_tag: (this.editAssetTag ? this.editAssetTag.value.trim() : '') || null,
      notes: (this.editNotes ? this.editNotes.value.trim() : '') || null,
    };

    const modelId = this.editModelSelect ? this.editModelSelect.value : '';
    const customModel = this.editCustomModel ? this.editCustomModel.value.trim() : '';

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

    this.log('Saving component', id, 'with data:', data);

    if (this.saveStatus) {
      this.saveStatus.textContent = 'Saving...';
      this.saveStatus.className = 'save-status pending';
    }
    if (this.saveComponentBtn) this.saveComponentBtn.disabled = true;

    try {
      const updated = await api.updateComponent(parseInt(id), data);
      this.log('Save response:', updated);

      // Update local cache
      const idx = (AppState.currentComponents || []).findIndex(c => String(c.id) === String(id));
      if (idx !== -1) {
        AppState.currentComponents[idx] = { ...AppState.currentComponents[idx], ...updated };
      }

      if (this.saveStatus) {
        this.saveStatus.textContent = 'Saved at ' + new Date().toLocaleTimeString();
        this.saveStatus.className = 'save-status success';
      }
      this._renderComponents();
      this._updateSummary();
      AppHelpers.toast('Component saved', 'success');
    } catch (err) {
      this.log('Save error:', err.message);
      if (this.saveStatus) {
        this.saveStatus.textContent = 'Error: ' + err.message;
        this.saveStatus.className = 'save-status error';
      }
    } finally {
      if (this.saveComponentBtn) this.saveComponentBtn.disabled = false;
    }
  },

  async _addExtraComponent() {
    const name = prompt('Enter extra component name:');
    if (!name || !name.trim()) return;
    try {
      const comp = await api.addExtraComponent(AppState.selectedPositionId, name.trim());
      if (!AppState.currentComponents) AppState.currentComponents = [];
      AppState.currentComponents.push(comp);
      this._renderComponents();
      this._updateSummary();
      AppHelpers.toast('Extra component added', 'success');
    } catch (err) {
      AppHelpers.toast(err.message, 'error');
    }
  },

  _exportPosition() {
    if (!AppState.selectedPositionId) {
      AppHelpers.toast('No position selected', 'error');
      return;
    }
    window.open(api.getExportPositionCsvUrl(AppState.selectedPositionId));
    AppHelpers.toast('Downloading CSV...', 'success');
  },

  async _openChangeTemplate() {
    const overlay = document.getElementById('changeTemplateOverlay');
    const select = document.getElementById('changeTemplateSelect');
    if (!overlay || !select) return;

    overlay.classList.remove('hidden');
    select.innerHTML = '<option value="">-- Select Template --</option>';

    try {
      const templates = await AppState.loadTemplates();
      templates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        select.appendChild(opt);
      });
    } catch (err) {
      this.log('Load templates for change failed:', err.message);
    }

    const closeFn = () => overlay.classList.add('hidden');

    document.getElementById('confirmChangeTemplateBtn').onclick = async () => {
      const newTemplateId = select.value;
      if (!newTemplateId) {
        AppHelpers.toast('Please select a template', 'error');
        return;
      }
      try {
        const result = await api.changePositionTemplate(AppState.selectedPositionId, parseInt(newTemplateId));
        AppState.currentPosition = result;
        AppState.currentComponents = (result && result.components) || [];
        overlay.classList.add('hidden');
        if (this.positionDetailMeta) {
          this.positionDetailMeta.textContent = (result.site_name || '') + ' — ' + (result.template_name || '');
        }
        this._renderComponents();
        this._updateSummary();
        AppHelpers.toast('Template changed — safe merge applied', 'success');
      } catch (err) {
        AppHelpers.toast(err.message, 'error');
      }
    };

    overlay.querySelectorAll('.modal-close-btn').forEach(btn => btn.onclick = closeFn);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });
  },
};