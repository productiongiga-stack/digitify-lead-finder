/**
 * Digitify Suite — Agenda / Planning Module
 *
 * Migrated from:
 * - digitify-agenda-pro plugin:
 *   - class-dap-ajax.php — all AJAX endpoints for CRUD
 *   - admin.js — week view, todo list, inline editing, drag&drop
 *   - class-dap-installer.php — dap_agenda_items, dap_todos, dap_types schemas
 *   - class-dap-crm.php — CRM lookup/sync
 *   - class-dap-time.php — week/date utility functions
 *   - admin.css — week planner styling
 *
 * WordPress AJAX (dap_get_week, dap_todo_list, dap_item_create etc.)
 * replaced by direct repository calls.
 */

import { agendaItems, todos, contacts } from '../../data/db.js';
import { escHtml, formatDate, formatDateTime, timeAgo, toast } from '../../core/utils.js';

const DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const TYPE_COLORS = {
  meeting: '#2563eb', confirmed: '#16a34a', followup: '#f59e0b',
  quote: '#f97316', urgent: '#dc2626', internal: '#7c3aed',
  done: '#64748b', todo: '#0f172a',
};

export function renderAgenda(params, container) {
  if (params.sub === 'todos') return renderTodoList(container);
  return renderWeekView(container);
}

function renderWeekView(container) {
  // Get current week Monday (migrated from admin.js weekKeyToMondayUTC)
  const now = new Date();
  const monday = getMonday(now);

  let currentMonday = new Date(monday);

  function render() {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayItems = agendaItems.getAll()
        .filter(a => a.start_at && a.start_at.slice(0, 10) === dateStr)
        .sort((a, b) => a.start_at.localeCompare(b.start_at));
      const dayTodos = todos.getAll()
        .filter(t => t.due_at && t.due_at.slice(0, 10) === dateStr)
        .sort((a, b) => (a.status || '').localeCompare(b.status || ''));
      days.push({ date: d, dateStr, items: dayItems, todos: dayTodos });
    }

    const weekRange = `${formatDate(days[0].date)} — ${formatDate(days[6].date)}`;

    container.innerHTML = `
      <div class="ds-content-inner">
        <div class="ds-tabs">
          <div class="ds-tab active">Weekplanner</div>
          <div class="ds-tab" onclick="location.hash='#/agenda/todos'">To-do's</div>
        </div>

        <!-- Week navigation (migrated from admin.js switchWeek) -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <button class="ds-btn ds-btn-ghost" id="ag-prev-week">← Vorige</button>
          <div style="flex:1;text-align:center">
            <div style="font-size:18px;font-weight:700">${weekRange}</div>
          </div>
          <button class="ds-btn ds-btn-ghost" id="ag-next-week">Volgende →</button>
          <button class="ds-btn ds-btn-secondary ds-btn-sm" id="ag-today">Vandaag</button>
          <button class="ds-btn ds-btn-primary ds-btn-sm" id="ag-add-item">+ Afspraak</button>
        </div>

        <!-- Week grid (migrated from admin.js renderWeek) -->
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;" id="ag-week-grid">
          ${days.map((day, idx) => {
            const isToday = day.dateStr === new Date().toISOString().slice(0, 10);
            const totalMins = day.items.reduce((s, it) => s + getDurationMinutes(it), 0)
              + day.todos.reduce((s, t) => s + (t.estimated_minutes || 0), 0);

            return `
              <div class="ds-card" style="padding:10px;${isToday ? 'border-color:var(--ds-primary);border-width:2px' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <div>
                    <div style="font-weight:700;font-size:13px">${DAYS[idx]}</div>
                    <div style="font-size:11px;color:var(--ds-text-muted)">${day.date.getDate()}/${day.date.getMonth() + 1}</div>
                  </div>
                  <span style="font-size:10px;color:var(--ds-text-muted)">${formatMinutes(totalMins)}</span>
                </div>

                <!-- Agenda items -->
                ${day.items.length ? day.items.map(item => `
                  <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--ds-border-light);font-size:12px">
                    <div style="width:6px;height:6px;border-radius:50%;background:${item.color || TYPE_COLORS[item.type_key] || '#64748b'};flex-shrink:0"></div>
                    <div style="flex:1;min-width:0">
                      <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(item.title)}</div>
                      <div style="color:var(--ds-text-muted)">${item.start_at ? item.start_at.slice(11, 16) : ''}</div>
                    </div>
                  </div>
                `).join('') : '<div style="font-size:11px;color:var(--ds-text-muted);padding:4px 0">—</div>'}

                <!-- Todos -->
                ${day.todos.length ? `
                  <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--ds-border)">
                    ${day.todos.map(todo => `
                      <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px">
                        <div style="width:6px;height:6px;border-radius:50%;background:${todo.color || '#64748b'};flex-shrink:0"></div>
                        <span style="flex:1;${todo.status === 'done' ? 'text-decoration:line-through;opacity:.5' : ''}">${escHtml(todo.title)}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Navigation handlers
    container.querySelector('#ag-prev-week').addEventListener('click', () => {
      currentMonday.setDate(currentMonday.getDate() - 7);
      render();
    });
    container.querySelector('#ag-next-week').addEventListener('click', () => {
      currentMonday.setDate(currentMonday.getDate() + 7);
      render();
    });
    container.querySelector('#ag-today').addEventListener('click', () => {
      currentMonday = getMonday(new Date());
      render();
    });
    container.querySelector('#ag-add-item').addEventListener('click', () => {
      renderAddItemForm(container, render);
    });
  }

  render();
}

function renderTodoList(container) {
  const allTodos = todos.getAll().sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    return new Date(a.due_at || '9999') - new Date(b.due_at || '9999');
  });

  const totalOpen = allTodos.filter(t => t.status !== 'done').reduce((s, t) => s + (t.estimated_minutes || 0), 0);
  const totalAll = allTodos.reduce((s, t) => s + (t.estimated_minutes || 0), 0);

  container.innerHTML = `
    <div class="ds-content-inner">
      <div class="ds-tabs">
        <div class="ds-tab" onclick="location.hash='#/agenda'">Weekplanner</div>
        <div class="ds-tab active">To-do's</div>
      </div>

      <div class="ds-toolbar">
        <div>
          <span style="font-size:13px;color:var(--ds-text-muted)">
            Open: ${formatMinutes(totalOpen)} · Totaal: ${formatMinutes(totalAll)} · ${allTodos.length} items
          </span>
        </div>
        <div style="flex:1"></div>
        <button class="ds-btn ds-btn-primary ds-btn-sm" id="ag-add-todo">+ Nieuwe to-do</button>
      </div>

      <div class="ds-table-wrap">
        <table class="ds-table">
          <thead><tr><th></th><th>Titel</th><th>Geschat</th><th>Deadline</th><th>Contact</th><th>Status</th><th></th></tr></thead>
          <tbody id="ag-todo-body">
            ${allTodos.map(t => todoRow(t)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Toggle todo status
  container.querySelectorAll('.ag-todo-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const todo = todos.getById(id);
      if (todo) {
        const newStatus = todo.status === 'done' ? 'open' : 'done';
        todos.update(id, { status: newStatus });
        renderTodoList(container);
      }
    });
  });

  container.querySelector('#ag-add-todo')?.addEventListener('click', () => {
    renderAddTodoForm(container);
  });
}

function todoRow(t) {
  const isDone = t.status === 'done';
  return `
    <tr style="${isDone ? 'opacity:.5' : ''}">
      <td><button class="ds-btn ds-btn-ghost ds-btn-sm ag-todo-toggle" data-id="${t.id}">${isDone ? '✅' : '⬜'}</button></td>
      <td>
        <div style="font-weight:600;${isDone ? 'text-decoration:line-through' : ''}">${escHtml(t.title)}</div>
        ${t.notes ? `<div style="font-size:11px;color:var(--ds-text-muted)">${escHtml(t.notes).slice(0, 60)}</div>` : ''}
      </td>
      <td style="font-size:12px">${formatMinutes(t.estimated_minutes || 0)}</td>
      <td style="font-size:12px">${t.due_at ? formatDate(t.due_at) : '—'}</td>
      <td style="font-size:12px;color:var(--ds-text-muted)">${escHtml(t.contact_email || '—')}</td>
      <td><span class="ds-badge ds-badge-${isDone ? 'success' : 'primary'}">${isDone ? 'Afgerond' : 'Open'}</span></td>
      <td>
        <button class="ds-btn ds-btn-ghost ds-btn-sm" style="color:var(--ds-danger)" onclick="event.stopPropagation()" data-delete-todo="${t.id}">✕</button>
      </td>
    </tr>
  `;
}

function renderAddItemForm(container, onSave) {
  // Simple inline form for adding agenda items
  const overlay = document.createElement('div');
  overlay.className = 'ds-modal-overlay open';
  overlay.innerHTML = `
    <div class="ds-modal">
      <div class="ds-modal-header"><h3 class="ds-modal-title">Nieuwe afspraak</h3><button class="ds-modal-close" id="ag-close-modal">✕</button></div>
      <div class="ds-modal-body">
        <form id="ag-item-form">
          <div class="ds-form-group"><label class="ds-form-label">Titel *</label><input type="text" name="title" class="ds-input" required></div>
          <div class="ds-form-row">
            <div class="ds-form-group"><label class="ds-form-label">Start</label><input type="datetime-local" name="start_at" class="ds-input" required></div>
            <div class="ds-form-group"><label class="ds-form-label">Einde</label><input type="datetime-local" name="end_at" class="ds-input"></div>
          </div>
          <div class="ds-form-group"><label class="ds-form-label">Contact e-mail</label><input type="email" name="contact_email" class="ds-input" placeholder="optioneel"></div>
          <div class="ds-form-group"><label class="ds-form-label">Beschrijving</label><textarea name="description" class="ds-textarea" rows="2"></textarea></div>
        </form>
      </div>
      <div class="ds-modal-footer">
        <button class="ds-btn ds-btn-secondary" id="ag-cancel">Annuleren</button>
        <button class="ds-btn ds-btn-primary" id="ag-save-item">Opslaan</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#ag-close-modal').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#ag-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#ag-save-item').addEventListener('click', () => {
    const form = overlay.querySelector('#ag-item-form');
    const data = Object.fromEntries(new FormData(form));
    if (!data.title || !data.start_at) return toast('Titel en start zijn verplicht');

    agendaItems.create({
      title: data.title,
      description: data.description || '',
      start_at: data.start_at,
      end_at: data.end_at || null,
      type_key: 'meeting',
      color: '#2563eb',
      status: 'open',
      contact_email: data.contact_email || '',
      source_app: 'manual',
    });
    toast('Afspraak toegevoegd');
    overlay.remove();
    onSave();
  });
}

function renderAddTodoForm(container) {
  const overlay = document.createElement('div');
  overlay.className = 'ds-modal-overlay open';
  overlay.innerHTML = `
    <div class="ds-modal">
      <div class="ds-modal-header"><h3 class="ds-modal-title">Nieuwe to-do</h3><button class="ds-modal-close" id="td-close">✕</button></div>
      <div class="ds-modal-body">
        <form id="td-form">
          <div class="ds-form-group"><label class="ds-form-label">Titel *</label><input type="text" name="title" class="ds-input" required></div>
          <div class="ds-form-row">
            <div class="ds-form-group"><label class="ds-form-label">Geschatte minuten</label><input type="number" name="estimated_minutes" class="ds-input" min="0" value="30"></div>
            <div class="ds-form-group"><label class="ds-form-label">Deadline</label><input type="datetime-local" name="due_at" class="ds-input"></div>
          </div>
          <div class="ds-form-group"><label class="ds-form-label">Contact e-mail</label><input type="email" name="contact_email" class="ds-input" placeholder="optioneel"></div>
          <div class="ds-form-group"><label class="ds-form-label">Notities</label><textarea name="notes" class="ds-textarea" rows="2"></textarea></div>
        </form>
      </div>
      <div class="ds-modal-footer">
        <button class="ds-btn ds-btn-secondary" id="td-cancel">Annuleren</button>
        <button class="ds-btn ds-btn-primary" id="td-save">Opslaan</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#td-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#td-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#td-save').addEventListener('click', () => {
    const data = Object.fromEntries(new FormData(overlay.querySelector('#td-form')));
    if (!data.title) return toast('Titel is verplicht');
    todos.create({
      title: data.title,
      estimated_minutes: parseInt(data.estimated_minutes) || 0,
      notes: data.notes || '',
      due_at: data.due_at || null,
      priority: 'normal',
      status: 'open',
      color: '#6366f1',
      contact_email: data.contact_email || '',
    });
    toast('To-do toegevoegd');
    overlay.remove();
    renderTodoList(container);
  });
}

// ── Helpers ───────────────────────────────────────────────

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function getDurationMinutes(item) {
  if (!item.start_at || !item.end_at) return 0;
  const s = new Date(item.start_at);
  const e = new Date(item.end_at);
  return Math.max(0, Math.round((e - s) / 60000));
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}u ${String(m).padStart(2, '0')}m`;
}
