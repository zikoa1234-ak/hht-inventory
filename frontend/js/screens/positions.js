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
    this.editAssignedPerson = document.getElementById('editAssignedPerson');
    this.componentTableBody = document.getElementById('componentTableBody');
    this.positionDetailTitle = document.getElementById('positionDetailTitle');
    this.positionDetailMeta = document.getElementById('positionDetailMeta');
    this.changeTemplateBtn = document.getElementById('changeTemplateBtn');
    this.exportPositionDetailBtn = document.getElementById('exportPositionDetailBtn');
    this.addExtraComponentBtn = document.getElementById('addExtraComponentBtn');
    this.sumComplete = document.getElementById('sumComplete');
    this.sumPartial = document.getElementById('sumPartial');
    this.sumMissing = document.getElementById('sumMissing');
    this.editItemStatus = document.getElementById('editItemStatus');

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
      // Real-time duplicate check on serial number input
      this.editSerialNumber.addEventListener('input', () => {
        this._checkSerialDuplicate('edit');
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
      // Real-time duplicate check on asset tag input
      this.editAssetTag.addEventListener('input', () => {
        this._checkAssetTagDuplicate();
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
    // FIX: pass 'position' not 'screen-position' (showScreen prepends 'screen-')
    AppHelpers.showScreen('position');
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

      this.log('Position data loaded:', data ? data.name : 'null', '| template:', data ? data.template_name : 'null', '| components:', data && data.components ? data.components.length : 0);

      // Defensive: ensure data has all expected fields
      data = data || {};
      data.name = data.name || 'Position #' + positionId;
      data.site_name = data.site_name || '';
      data.template_name = data.template_name || '';
      data.components = data.components || [];

      // FIX: If position has no components but has a template, initialize from template
      if (!data.components || data.components.length === 0) {
        this.log('No components found — attempting to initialize from template');
        try {
          const initData = await api.initPositionFromTemplate(positionId);
          this.log('Init-from-template response:', initData ? initData.name : 'null', '| components:', initData && initData.components ? initData.components.length : 0);
          if (initData && initData.components && initData.components.length > 0) {
            data = initData;
            AppState.currentPosition = initData;
            AppState.currentComponents = initData.components || [];
          } else {
            this.log('Init returned no components — trying template fetch for defaults');
            // Last resort: create in-memory defaults from the template
            const tplId = data.template_id || (AppState.positions || []).find(p => p.id === positionId)?.template_id;
            if (tplId) {
              try {
                const tpl = await api.getTemplate(tplId);
                this.log('Template fetched:', tpl.name, '| components:', tpl.components ? tpl.components.length : 0);
                if (tpl.components && tpl.components.length > 0) {
                  AppState.currentComponents = tpl.components.map((c, i) => ({
                    id: null,
                    position_id: positionId,
                    component_name: c.component_name || c.name || c,
                    sort_order: c.sort_order || (i + 1),
                    status: 'missing',
                    serial_number: '',
                    asset_tag: '',
                    model_name: '',
                    custom_model: '',
                    assigned_person: '',
                    notes: '',
                    is_extra_component: false,
                    item_status: 'IN USE',
                  }));
                  data.components = AppState.currentComponents;
                  data.template_name = tpl.name;
                  this.log('Created', AppState.currentComponents.length, 'in-memory default components');
                }
              } catch (tplErr) {
                this.log('Template fetch failed:', tplErr.message);
              }
            }
          }
        } catch (initErr) {
          this.log('Init-from-template failed:', initErr.message);
        }
      }

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

      // FIX: Auto-open scan panel for first missing component
      this._autoScanFirstMissing();

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
          <td colspan="11" class="empty-state">
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
      // FIX: Make entire row clickable to open scan panel
      tr.style.cursor = 'pointer';
      tr.title = 'Click to scan/edit this component';

      const isExtra = comp.is_extra_component;
      const modelName = (comp.custom_model || comp.model_name || '');
      const serialNum = comp.serial_number || '';
      const assetTag = comp.asset_tag || '';
      const notes = comp.notes || '';
      const hasData = serialNum || assetTag;

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${esc(comp.component_name || '?')}${isExtra ? ' <span class="text-secondary text-sm">[extra]</span>' : ''}</td>
        <td>${esc(modelName)}</td>
        <td class="mono">${esc(serialNum)}</td>
        <td class="mono">${esc(assetTag)}</td>
        <td>${esc(comp.assigned_person || '')}</td>
        <td>${esc(notes)}</td>
        <td>${AppState.getItemStatusBadge(comp.item_status)}</td>
        <td>${AppState.getStatusBadge(comp.status || 'missing')}</td>
        <td class="text-secondary text-sm">${AppState.formatDate(comp.updated_at)}</td>
        <td>
          <button class="action-btn edit-comp-btn" data-id="${comp.id || ''}">Edit</button>
          <button class="action-btn danger delete-comp-btn" data-id="${comp.id || ''}">Del</button>
        </td>
      `;

      // FIX: Click on row opens scan panel for this component
      tr.addEventListener('click', (e) => {
        // Don't open if the click was on a button
        if (e.target.tagName === 'BUTTON') return;
        // If component has a saved id, open via the edit flow
        if (comp.id) {
          this._openScanPanel(comp);
        } else if (!hasData) {
          // No saved data yet — create default component first, then scan
          this._openScanPanel(comp);
        } else {
          this._openScanPanel(comp);
        }
      });

      tbody.appendChild(tr);
    });

    // Bind edit buttons
    tbody.querySelectorAll('.edit-comp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
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
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
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

  // FIX: Auto-open scan panel for the first missing/partial component
  _autoScanFirstMissing() {
    const comps = AppState.currentComponents || [];
    this.log('Auto-scan: looking for first scannable component among', comps.length, 'components');

    // Find first component that is NOT complete (missing or partial)
    const target = comps.find(c => c && (c.status === 'missing' || (c.status === 'partial' && !c.serial_number && !c.asset_tag)));
    if (target) {
      this.log('Auto-scan: opening panel for component:', target.component_name, 'status:', target.status);
      this._openScanPanel(target);
    } else if (comps.length > 0 && comps[0]) {
      // If all are complete, open the first one anyway for review
      this.log('Auto-scan: all components complete or scanned — opening first for review');
      this._openScanPanel(comps[0]);
    } else {
      this.log('Auto-scan: no components available');
    }
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
      tbody.innerHTML = '<tr><td colspan="11" class="empty-state">Loading component data...</td></tr>';
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
      tbody.innerHTML = `<tr><td colspan="11" class="empty-state">${esc(message)}</td></tr>`;
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
    this.scanPanelTitle.textContent = 'Scan: ' + (comp.component_name || 'Component');
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
    if (this.editItemStatus) this.editItemStatus.value = comp.item_status || 'IN USE';
    if (this.editAssignedPerson) {
      this.editAssignedPerson.value = comp.assigned_person || '';
    }
    if (this.saveStatus) {
      this.saveStatus.textContent = '';
      this.saveStatus.className = 'save-status';
    }

    // FIX: Update save button text for unsaved components
    if (this.saveComponentBtn) {
      this.saveComponentBtn.textContent = comp.id ? 'Save Component' : 'Create & Save';
    }

    // Clear serial and asset tag duplicate errors
    const serError = document.getElementById('editSerialError');
    if (serError) { serError.classList.add('hidden'); serError.textContent = ''; }
    const tagError = document.getElementById('editAssetTagError');
    if (tagError) { tagError.classList.add('hidden'); tagError.textContent = ''; }

    // Focus for fast scanning — focus serial number if empty, otherwise asset tag
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
    if (this.editItemStatus) this.editItemStatus.value = 'IN USE';
    if (this.editAssignedPerson) {
      this.editAssignedPerson.value = '';
    }
    if (this.saveStatus) {
      this.saveStatus.textContent = '';
      this.saveStatus.className = 'save-status';
    }
    if (this.saveComponentBtn) this.saveComponentBtn.textContent = 'Save Component';
    // Clear both error displays
    const clearSer = document.getElementById('editSerialError');
    if (clearSer) { clearSer.classList.add('hidden'); clearSer.textContent = ''; }
    const clearTag = document.getElementById('editAssetTagError');
    if (clearTag) { clearTag.classList.add('hidden'); clearTag.textContent = ''; }
    setTimeout(() => { if (this.editSerialNumber) this.editSerialNumber.focus(); }, 50);
  },

  // Real-time duplicate serial number check
  _checkSerialDuplicateDebounceTimer: null,
  _checkSerialDuplicate(source) {
    const input = source === 'edit' ? this.editSerialNumber : null;
    if (!input) return;
    const serial = input.value.trim();
    const errorEl = document.getElementById('editSerialError');

    // Clear previous state
    if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }

    if (!serial) return;

    // Clear any pending debounce
    if (this._checkSerialDuplicateDebounceTimer) {
      clearTimeout(this._checkSerialDuplicateDebounceTimer);
    }

    this._checkSerialDuplicateDebounceTimer = setTimeout(async () => {
      try {
        const excludeId = this.editComponentId ? this.editComponentId.value : '';
        const params = new URLSearchParams({ serial });
        if (excludeId) params.set('exclude_id', excludeId);

        const res = await fetch('/api/assets/check-serial?' + params.toString());
        const data = await res.json();

        if (data.exists && errorEl) {
          errorEl.textContent = 'This serial number is duplicated';
          errorEl.classList.remove('hidden');
        }
      } catch (_) {
        // Silent fail — backend validation still catches duplicates on submit
      }
    }, 400);
  },

  // Real-time duplicate asset tag check
  _checkAssetTagDuplicateDebounceTimer: null,
  _checkAssetTagDuplicate() {
    const tag = (this.editAssetTag ? this.editAssetTag.value : '').trim();
    const errorEl = document.getElementById('editAssetTagError');

    // Clear previous state
    if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }

    if (!tag) return;

    if (this._checkAssetTagDuplicateDebounceTimer) {
      clearTimeout(this._checkAssetTagDuplicateDebounceTimer);
    }

    this._checkAssetTagDuplicateDebounceTimer = setTimeout(async () => {
      try {
        const excludeId = this.editComponentId ? this.editComponentId.value : '';
        const params = new URLSearchParams({ tag });
        if (excludeId) params.set('exclude_id', excludeId);

        const res = await fetch('/api/assets/check-asset-tag?' + params.toString());
        const data = await res.json();

        if (data.exists && errorEl) {
          errorEl.textContent = 'This asset tag is duplicated';
          errorEl.classList.remove('hidden');
        }
      } catch (_) {
        // Silent fail — backend still catches duplicates on submit
      }
    }, 400);
  },

  async _saveComponent() {
    const id = this.editComponentId ? this.editComponentId.value : '';

    // Block save if duplicate error is visible
    const serError = document.getElementById('editSerialError');
    if (serError && !serError.classList.contains('hidden')) {
      AppHelpers.toast(serError.textContent || 'Serial number error', 'error');
      if (this.editSerialNumber) this.editSerialNumber.focus();
      return;
    }
    const tagError = document.getElementById('editAssetTagError');
    if (tagError && !tagError.classList.contains('hidden')) {
      AppHelpers.toast(tagError.textContent || 'Asset tag error', 'error');
      if (this.editAssetTag) this.editAssetTag.focus();
      return;
    }

    const data = {
      component_name: (this.editCompName ? this.editCompName.value.trim() : '') || undefined,
      serial_number: (this.editSerialNumber ? this.editSerialNumber.value.trim() : '') || null,
      asset_tag: (this.editAssetTag ? this.editAssetTag.value.trim() : '') || null,
      notes: (this.editNotes ? this.editNotes.value.trim() : '') || null,
      item_status: this.editItemStatus ? this.editItemStatus.value : 'IN USE',
      assigned_person: (this.editAssignedPerson ? this.editAssignedPerson.value.trim() : '') || null,
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

    this.log('Saving component id:', id || '(new)', 'with data:', data);

    // Validate: assigned person is required
    if (!data.assigned_person || !isValidPerson(data.assigned_person)) {
      if (this.saveStatus) {
        this.saveStatus.textContent = 'Error: Please select a valid assigned person';
        this.saveStatus.className = 'save-status error';
      }
      AppHelpers.toast('Please select a valid assigned person', 'error');
      if (this.editAssignedPerson) this.editAssignedPerson.focus();
      if (this.saveComponentBtn) this.saveComponentBtn.disabled = false;
      return;
    }

    if (this.saveStatus) {
      this.saveStatus.textContent = 'Saving...';
      this.saveStatus.className = 'save-status pending';
    }
    if (this.saveComponentBtn) this.saveComponentBtn.disabled = true;

    try {
      let updated;

      if (!id) {
        // FIX: No component ID yet — this is an in-memory/unsaved component.
        // Create it via addExtraComponent, then update with scanned data.
        this.log('Creating new component from scan data');
        if (!AppState.selectedPositionId) {
          throw new Error('No position selected');
        }
        const compName = data.component_name || 'Component';
        const created = await api.addExtraComponent(AppState.selectedPositionId, compName);
        this.log('Created component:', created.id);

        // Now update with the scanned data
        updated = await api.updateComponent(created.id, data);
        this.log('Updated component with scan data:', updated.id);
      } else {
        updated = await api.updateComponent(parseInt(id), data);
        this.log('Save response:', updated);
      }

      // Update local cache
      const idx = (AppState.currentComponents || []).findIndex(c => {
        // Match by id if available, otherwise by component_name (for unsaved items)
        if (c.id && String(c.id) === String(id)) return true;
        if (!c.id && c.component_name === (data.component_name || 'Component')) {
          // Migrate to the newly created id
          return true;
        }
        return false;
      });

      if (idx !== -1) {
        AppState.currentComponents[idx] = { ...AppState.currentComponents[idx], ...updated, id: updated.id || id };
        // Update the editComponentId for future saves
        if (this.editComponentId) this.editComponentId.value = updated.id || id;
      } else if (updated) {
        // Fallback: push to cache
        AppState.currentComponents.push(updated);
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
      // Show duplicate errors inline on the serial field
      if (err.message === 'This serial number is duplicated' && serError) {
        serError.textContent = 'This serial number is duplicated';
        serError.classList.remove('hidden');
        if (this.editSerialNumber) this.editSerialNumber.focus();
        // Re-enable save button (don't hide in saveStatus)
        if (this.saveComponentBtn) this.saveComponentBtn.disabled = false;
        return;
      }
      // Show duplicate errors inline on the asset tag field
      if ((err.message === 'This asset tag is duplicated') && tagError) {
        tagError.textContent = 'This asset tag is duplicated';
        tagError.classList.remove('hidden');
        if (this.editAssetTag) this.editAssetTag.focus();
        if (this.saveComponentBtn) this.saveComponentBtn.disabled = false;
        return;
      }
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