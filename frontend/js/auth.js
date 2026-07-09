/* ============================================================
   Frontend Auth Module — login, token management, auth state
   ============================================================ */

const AUTH = {
  TOKEN_KEY: 'hht_auth_token',
  USER_KEY: 'hht_auth_user',

  /** Check if user is logged in */
  isLoggedIn() {
    return !!localStorage.getItem(this.TOKEN_KEY);
  },

  /** Get stored token */
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  /** Get stored user object */
  getUser() {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  /** Check if current user is admin */
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  /** Save auth data after login */
  setAuth(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this._updateUI();
  },

  /** Clear auth data on logout */
  clearAuth() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._updateUI();
  },

  /** Login via API */
  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }

    const data = await res.json();
    this.setAuth(data.token, data.user);
    return data.user;
  },

  /** Logout */
  logout() {
    this.clearAuth();
    window.location.reload();
  },

  /** Update UI elements based on auth state */
  _updateUI() {
    const loggedIn = this.isLoggedIn();
    const isAdmin = this.isAdmin();

    // Update nav
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userBadge = document.getElementById('userBadge');
    const adminLink = document.getElementById('adminLink');

    if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
    if (adminLink) adminLink.style.display = isAdmin ? '' : 'none';

    if (userBadge) {
      if (loggedIn) {
        const user = this.getUser();
        userBadge.textContent = user ? (user.username + (user.role === 'admin' ? ' [Admin]' : '')) : '';
        userBadge.style.display = '';
      } else {
        userBadge.textContent = '';
        userBadge.style.display = 'none';
      }
    }

    // Hide delete buttons for non-admin users across all screens
    document.querySelectorAll('.admin-only, .delete-asset-btn, .delete-comp-btn').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });
  },

  /** Show the login modal */
  showLoginModal(force) {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      // Hide close button when forced (can't dismiss)
      const closeBtns = overlay.querySelectorAll('.modal-close-btn');
      closeBtns.forEach(function (btn) { btn.style.display = force ? 'none' : ''; });
      const input = document.getElementById('loginUsername');
      if (input) setTimeout(() => input.focus(), 100);
    }
  },

  /** Hide the login modal */
  hideLoginModal() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.add('hidden');
  },
};

/** Get auth headers object for raw fetch calls */
function authHeaders() {
  const token = AUTH && AUTH.getToken ? AUTH.getToken() : null;
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

// HTML escaping helper (used by admin pages that don't load app.js)
const esc = (s) => {
  if (s === null || s === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', () => {
  AUTH._updateUI();
});