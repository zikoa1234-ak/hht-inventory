/* ============================================================
   Templates Screen
   ============================================================ */

const TemplatesScreen = {
  init() {
    this.editorOverlay = document.getElementById('templateEditorOverlay');
    this.templateNameInput = document.getElementById('templateNameInput');
    this.componentsList = document.getElementById('templateComponentsList');
    this.newComponentInput = document.getElementById('newComponentInput');
    this.addComponentBtn = document.getElementById('addComponentBtn');
    this.saveTemplateBtn = document.getElementById('saveTemplateBtn');
    this.editingTemplateId = document.getElementById('editingTemplateId');
    this.templateTableBody = document.getElementById('templateTableBody');
    this.templateEditorTitle = document.getElementById('templateEditorTitle');
    this.newTemplateBtn = document.getElementById('newTemplateBtn');

    this._tempComponents = [];

    this.newTemplateBtn.addEventListener('click', () => this._openEditor(null));
    this.addComponentBtn.addEventListener('click', () => this._addComponentFromInput());
    this.newComponentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._addComponentFromInput(); }
    });
    this.saveTemplateBtn.addEventListener('click', () => this._saveTemplate());

    // Close modal on overlay click
    this.editorOverlay.addEventListener('click', (e) => {
      if (e.target === this.editorOverlay) this._closeEditor();
    });
    this.editorOverlay.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this._closeEditor());
    });
  },

  async render() {
    const templates = await AppState.loadTemplates();
    const tbody = this.templateTableBody;
    tbody.innerHTML = '';

    if (templates.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No templates yet. Click "+ New" to create one.</td></tr>';
      return;
    }

    for (const tpl of templates) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(tpl.name)}</strong></td>
        <td>${tpl.component_count}</td>
        <td>${AppState.formatDate(tpl.updated_at)}</td>
        <td>
          <button class="action-btn edit-template-btn" data-id="${tpl.id}">Edit</button>
          <button class="action-btn danger delete-template-btn" data-id="${tpl.id}">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('.edit-template-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const tpl = await api.getTemplate(id);
        this._openEditor(tpl);
      });
    });

    tbody.querySelectorAll('.delete-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        AppHelpers.confirm('Delete Template?', 'All template data will be removed. Positions using this template will keep their components.', async () => {
          await api.deleteTemplate(id);
          this.render();
          AppHelpers.toast('Template deleted', 'success');
          await AppState.loadTemplates();
        });
      });
    });
  },

  _openEditor(template) {
    if (template) {
      this.templateEditorTitle.textContent = 'Edit Template';
      this.templateNameInput.value = template.name || '';
      this.editingTemplateId.value = template.id;
      this._tempComponents = (template.components || []).map(c => ({
        name: c.component_name || c.name || c,
      }));
    } else {
      this.templateEditorTitle.textContent = 'New Template';
      this.templateNameInput.value = '';
      this.editingTemplateId.value = '';
      this._tempComponents = [];
    }
    this._renderComponents();
    this.editorOverlay.classList.remove('hidden');
    this.templateNameInput.focus();
  },

  _closeEditor() {
    this.editorOverlay.classList.add('hidden');
  },

  _renderComponents() {
    const list = this.componentsList;
    list.innerHTML = '';
    this._tempComponents.forEach((comp, i) => {
      const div = document.createElement('div');
      div.className = 'sortable-item';
      div.innerHTML = `
        <span class="handle">&#9776;</span>
        <span class="name">${esc(comp.name)}</span>
        <button class="remove-btn" data-index="${i}">&times;</button>
      `;
      div.querySelector('.remove-btn').addEventListener('click', () => {
        this._tempComponents.splice(i, 1);
        this._renderComponents();
      });
      list.appendChild(div);
    });
  },

  _addComponentFromInput() {
    const name = this.newComponentInput.value.trim();
    if (!name) return;
    this._tempComponents.push({ name });
    this.newComponentInput.value = '';
    this._renderComponents();
  },

  async _saveTemplate() {
    const name = this.templateNameInput.value.trim();
    if (!name) {
      AppHelpers.toast('Template name is required', 'error');
      return;
    }
    if (this._tempComponents.length === 0) {
      AppHelpers.toast('Add at least one component', 'error');
      return;
    }

    const id = this.editingTemplateId.value;
    const components = this._tempComponents.map(c => ({ name: c.name }));

    try {
      if (id) {
        await api.updateTemplate(id, { name, components });
        AppHelpers.toast('Template updated', 'success');
      } else {
        await api.createTemplate(name, components);
        AppHelpers.toast('Template created', 'success');
      }
      this._closeEditor();
      await this.render();
      await AppState.loadTemplates();
    } catch (err) {
      AppHelpers.toast(err.message, 'error');
    }
  },
};