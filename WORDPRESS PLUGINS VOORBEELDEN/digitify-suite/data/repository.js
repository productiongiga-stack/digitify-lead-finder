/**
 * Digitify Suite — Base Repository
 * Abstract data access layer with localStorage persistence.
 *
 * Migrated from:
 * - DCRM\Repositories\BaseRepository (CRM Core)
 * - OWMC\Repositories\BaseRepository (Offerte Wizard)
 * - DOL\Modules\Leads\LeadRepository (Outreach)
 *
 * All WordPress $wpdb calls are replaced by this localStorage-backed
 * repository. The interface is designed to be swapped for a REST API
 * backend later (e.g. fetch('/api/contacts')).
 *
 * Future API integration points are marked with: // @API
 */

export class Repository {
  constructor(entityName) {
    this._entity = entityName;
    this._storageKey = `ds_${entityName}`;
    this._nextIdKey = `ds_${entityName}_nextId`;
  }

  // ── CRUD ────────────────────────────────────

  /** @API GET /api/{entity} */
  getAll() {
    return this._load();
  }

  /** @API GET /api/{entity}/:id */
  getById(id) {
    return this._load().find(item => item.id === Number(id)) || null;
  }

  /** @API GET /api/{entity}?q=... */
  search(query, fields = ['name', 'email']) {
    const q = String(query).toLowerCase();
    if (!q) return this.getAll();
    return this._load().filter(item =>
      fields.some(f => String(item[f] || '').toLowerCase().includes(q))
    );
  }

  /** @API GET /api/{entity}?field=value */
  findBy(field, value) {
    return this._load().filter(item => item[field] === value);
  }

  /** @API GET /api/{entity}?field=value (first match) */
  findOneBy(field, value) {
    return this._load().find(item => item[field] === value) || null;
  }

  /** @API POST /api/{entity} */
  create(data) {
    const items = this._load();
    const id = this._getNextId();
    const now = new Date().toISOString();
    const item = {
      id,
      ...data,
      created_at: data.created_at || now,
      updated_at: now,
    };
    items.push(item);
    this._save(items);
    return item;
  }

  /** @API PUT /api/{entity}/:id */
  update(id, data) {
    const items = this._load();
    const idx = items.findIndex(item => item.id === Number(id));
    if (idx === -1) return null;
    items[idx] = {
      ...items[idx],
      ...data,
      id: items[idx].id, // prevent ID change
      updated_at: new Date().toISOString(),
    };
    this._save(items);
    return items[idx];
  }

  /** @API DELETE /api/{entity}/:id */
  delete(id) {
    const items = this._load();
    const filtered = items.filter(item => item.id !== Number(id));
    if (filtered.length === items.length) return false;
    this._save(filtered);
    return true;
  }

  /** @API GET /api/{entity}/count */
  count() {
    return this._load().length;
  }

  /** @API GET /api/{entity}?status=... (count) */
  countBy(field, value) {
    return this._load().filter(item => item[field] === value).length;
  }

  // ── Upsert (key deduplication, migrated from ContactRepository.findOrCreate) ──

  /** @API PUT /api/{entity}/upsert */
  upsert(uniqueField, uniqueValue, data) {
    const existing = this.findOneBy(uniqueField, uniqueValue);
    if (existing) {
      return this.update(existing.id, data);
    }
    return this.create({ [uniqueField]: uniqueValue, ...data });
  }

  // ── Pagination ─────────────────────────────

  /** @API GET /api/{entity}?page=1&perPage=25 */
  paginate(page = 1, perPage = 25, filters = {}) {
    let items = this._load();

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      if (key === 'q') {
        const q = String(value).toLowerCase();
        items = items.filter(item =>
          Object.values(item).some(v => String(v || '').toLowerCase().includes(q))
        );
      } else {
        items = items.filter(item => item[key] === value);
      }
    });

    // Sort by updated_at desc (most recent first)
    items.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    const total = items.length;
    const pages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;

    return {
      items: items.slice(offset, offset + perPage),
      total,
      page,
      perPage,
      pages,
    };
  }

  // ── Internal storage ───────────────────────

  _load() {
    try {
      const data = localStorage.getItem(this._storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _save(items) {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(items));
    } catch (e) {
      console.warn(`Storage save failed for ${this._entity}:`, e);
    }
  }

  _getNextId() {
    let id = parseInt(localStorage.getItem(this._nextIdKey) || '1', 10);
    localStorage.setItem(this._nextIdKey, String(id + 1));
    return id;
  }

  /** Seed initial data if empty */
  seedIfEmpty(items) {
    if (this.count() === 0) {
      // Reset ID counter
      let maxId = 0;
      items.forEach(item => {
        if (item.id && item.id > maxId) maxId = item.id;
      });
      localStorage.setItem(this._nextIdKey, String(maxId + 1));
      this._save(items);
    }
  }
}
