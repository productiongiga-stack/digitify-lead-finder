/**
 * Digitify Suite — SPA Router
 * Hash-based routing for standalone deployment.
 *
 * Replaces: WordPress admin pages (add_menu_page, add_submenu_page)
 * from all 6 plugins. Single entry point via index.html.
 */

class Router {
  constructor() {
    this._routes = new Map();
    this._current = null;
    this._onChangeCallbacks = [];

    window.addEventListener('hashchange', () => this._handleRoute());
  }

  /**
   * Register a route.
   * @param {string} path - e.g. 'dashboard', 'crm/contacts', 'offertes/123'
   * @param {Function} handler - async fn(params) that returns HTML or renders into container
   */
  register(path, handler) {
    this._routes.set(path, handler);
    return this;
  }

  onChange(callback) {
    this._onChangeCallbacks.push(callback);
    return this;
  }

  navigate(path) {
    window.location.hash = '#/' + path;
  }

  getCurrentPath() {
    return this._parsePath();
  }

  start() {
    this._handleRoute();
  }

  _parsePath() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return hash || 'dashboard';
  }

  _handleRoute() {
    const fullPath = this._parsePath();
    const parts = fullPath.split('/');
    const moduleKey = parts[0];
    const subPath = parts.slice(1).join('/');

    // Find exact match first, then module match
    let handler = this._routes.get(fullPath);
    let params = {};

    if (!handler) {
      handler = this._routes.get(moduleKey);
      params = { sub: subPath, parts: parts.slice(1), id: parts[1] };
    }

    if (!handler) {
      handler = this._routes.get('dashboard');
    }

    this._current = { path: fullPath, module: moduleKey, params };

    this._onChangeCallbacks.forEach(cb => cb(moduleKey, fullPath, params));

    if (handler) {
      const container = document.getElementById('ds-module-content');
      if (container) {
        const result = handler(params, container);
        if (result instanceof Promise) {
          result.catch(err => {
            console.error('Route handler error:', err);
            container.innerHTML = `<div class="ds-empty"><div class="ds-empty-icon">⚠️</div><div class="ds-empty-title">Er ging iets mis</div><p>${err.message}</p></div>`;
          });
        }
      }
    }
  }
}

export const router = new Router();
export default router;
