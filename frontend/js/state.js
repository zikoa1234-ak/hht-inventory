/* ============================================================
   App State Management
   ============================================================ */

const AppState = {
  // Cache
  sites: [],
  templates: [],
  models: [],
  positions: [],

  // Current selection
  selectedSiteId: null,
  selectedTemplateId: null,
  selectedPositionId: null,

  // Current position detail (loaded from backend)
  currentPosition: null,
  currentComponents: [],

  // Editing state
  editingComponentId: null,

  // UI helpers
  async loadSites() {
    this.sites = await api.getSites();
    return this.sites;
  },
  async loadTemplates() {
    this.templates = await api.getTemplates();
    return this.templates;
  },
  async loadModels() {
    this.models = await api.getModels();
    return this.models;
  },
  async loadPositions() {
    this.positions = await api.getPositions();
    return this.positions;
  },
  async loadPositionDetail(id) {
    const data = await api.getPosition(id);
    this.currentPosition = data;
    this.currentComponents = data.components || [];
    this.selectedPositionId = data.id;
    return data;
  },

  resetSelection() {
    this.selectedSiteId = null;
    this.selectedTemplateId = null;
    this.selectedPositionId = null;
  },

  resetPositionDetail() {
    this.currentPosition = null;
    this.currentComponents = [];
    this.editingComponentId = null;
  },

  getStatusBadge(status) {
    const labels = { complete: 'Complete', partial: 'Partial', missing: 'Missing' };
    return `<span class="status-badge status-${status}">${labels[status] || status}</span>`;
  },

  getItemStatusBadge(itemStatus) {
    const val = itemStatus || 'IN USE';
    const cssClass = val.toLowerCase().replace(/ /g, '-');
    return `<span class="item-status-badge item-status-${cssClass}">${val}</span>`;
  },

  formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  },
};