/* ============================================================
   API Service Layer — all backend calls with auth headers
   ============================================================ */

const API_BASE = window.API_BASE || '';

const api = {
  async request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    // Attach auth token if logged in
    const token = AUTH && AUTH.getToken ? AUTH.getToken() : null;
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;

    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}/api${path}`, opts);

    // If 401, clear auth and show login
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      AUTH.clearAuth();
      AUTH.showLoginModal();
      throw new Error('Session expired. Please log in again.');
    }

    if (res.status === 403) {
      // Still throw the error so the UI can handle it
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Access denied');
    }

    if (!res.ok) {
      let msg = `API error ${res.status}`;
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    return res;
  },

  // --- Sites ---
  getSites() {
    return this.request('GET', '/sites').then(r => r.json());
  },
  createSite(name) {
    return this.request('POST', '/sites', { name }).then(r => r.json());
  },

  // --- Templates ---
  getTemplates() {
    return this.request('GET', '/templates').then(r => r.json());
  },
  getTemplate(id) {
    return this.request('GET', `/templates/${id}`).then(r => r.json());
  },
  createTemplate(name, components) {
    return this.request('POST', '/templates', { name, components }).then(r => r.json());
  },
  updateTemplate(id, data) {
    return this.request('PUT', `/templates/${id}`, data).then(r => r.json());
  },
  deleteTemplate(id) {
    return this.request('DELETE', `/templates/${id}`).then(r => r.json());
  },

  // --- Positions ---
  getPositions() {
    return this.request('GET', '/positions').then(r => r.json());
  },
  getPosition(id) {
    return this.request('GET', `/positions/${id}`).then(r => r.json());
  },
  createPosition(data) {
    return this.request('POST', '/positions', data).then(r => r.json());
  },
  updatePosition(id, data) {
    return this.request('PUT', `/positions/${id}`, data).then(r => r.json());
  },
  changePositionTemplate(id, template_id) {
    return this.request('PATCH', `/positions/${id}/template`, { template_id }).then(r => r.json());
  },
  getPositionComponents(id) {
    return this.request('GET', `/positions/${id}/components`).then(r => r.json());
  },
  addExtraComponent(positionId, component_name) {
    return this.request('POST', `/positions/${positionId}/components`, { component_name }).then(r => r.json());
  },
  initPositionFromTemplate(positionId) {
    return this.request('POST', `/positions/${positionId}/init-from-template`).then(r => r.json());
  },
  updateComponent(componentId, data) {
    return this.request('PUT', `/positions/components/${componentId}`, data).then(r => r.json());
  },
  deleteComponent(componentId) {
    return this.request('DELETE', `/positions/components/${componentId}`).then(r => r.json());
  },

  // --- Models ---
  getModels() {
    return this.request('GET', '/models').then(r => r.json());
  },
  createModel(name) {
    return this.request('POST', '/models', { name }).then(r => r.json());
  },

  // --- Sessions ---
  getSessions(positionId) {
    return this.request('GET', `/sessions/${positionId}`).then(r => r.json());
  },
  startSession(positionId) {
    return this.request('POST', '/sessions', { position_id: positionId }).then(r => r.json());
  },
  closeSession(positionId, completed_by) {
    return this.request('POST', '/sessions', { position_id: positionId, completed: true, completed_by }).then(r => r.json());
  },

  // --- Export ---
  getExportPositionCsvUrl(id) {
    return `${API_BASE}/api/export/positions/${id}.csv`;
  },
  getExportAllCsvUrl(siteId, templateId) {
    const params = new URLSearchParams();
    if (siteId) params.set('site_id', siteId);
    if (templateId) params.set('template_id', templateId);
    const qs = params.toString();
    return `${API_BASE}/api/export/positions.csv${qs ? '?' + qs : ''}`;
  },

  /**
   * Download a CSV file via fetch (includes auth token).
   * Falls back to window.open if token is missing (unauthenticated export).
   */
  async downloadCsv(url, filename) {
    const token = AUTH && AUTH.getToken ? AUTH.getToken() : null;
    if (!token) {
      // No token — fall back to direct navigation (will probably get 401)
      window.open(url);
      return;
    }
    try {
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      AppHelpers.toast(err.message, 'error');
    }
  },
};