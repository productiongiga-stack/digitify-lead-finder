/**
 * Digitify Suite — Reactive State Store
 * Centraal state management met localStorage persistentie.
 *
 * Migrated from: WP options (wp_options), WordPress transients, and
 * various plugin-specific state scattered across 6 plugins.
 * Future: Replace localStorage with REST API calls to a backend.
 */

const STORAGE_KEY = 'digitify_suite_state';

const defaultState = {
  // Active company/workspace (migrated from OWMC multi-company)
  activeCompanyId: 1,

  // Theme preference
  theme: 'light',

  // Current view
  currentModule: 'dashboard',

  // User preferences
  preferences: {
    dateFormat: 'dd/MM/yyyy',
    language: 'nl',
    timezone: 'Europe/Brussels',
    sidebarCollapsed: false,
  },
};

class Store {
  constructor() {
    this._state = this._loadState();
    this._listeners = new Map();
    this._nextId = 1;
  }

  _loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaultState, ...JSON.parse(saved) };
      }
    } catch (e) { /* ignore parse errors */ }
    return { ...defaultState };
  }

  _saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
    } catch (e) { /* quota exceeded etc */ }
  }

  get(key) {
    return key ? this._state[key] : { ...this._state };
  }

  set(key, value) {
    const old = this._state[key];
    this._state[key] = value;
    this._saveState();
    this._notify(key, value, old);
  }

  update(partial) {
    Object.entries(partial).forEach(([k, v]) => {
      const old = this._state[k];
      this._state[k] = v;
      this._notify(k, v, old);
    });
    this._saveState();
  }

  /**
   * Subscribe to state changes.
   * @param {string|null} key - specific key to watch, or null for all
   * @param {Function} callback - fn(newValue, oldValue, key)
   * @returns {number} subscription ID (for unsubscribe)
   */
  subscribe(key, callback) {
    const id = this._nextId++;
    this._listeners.set(id, { key, callback });
    return id;
  }

  unsubscribe(id) {
    this._listeners.delete(id);
  }

  _notify(key, newVal, oldVal) {
    this._listeners.forEach(({ key: watchKey, callback }) => {
      if (!watchKey || watchKey === key) {
        callback(newVal, oldVal, key);
      }
    });
  }

  reset() {
    this._state = { ...defaultState };
    this._saveState();
    this._listeners.forEach(({ callback }) => callback(this._state, null, '*'));
  }
}

export const store = new Store();
export default store;
