/**
 * Digitify Suite — CRM Module
 *
 * Migrated from:
 * - ContactsPage.php + contact-detail.php (CRM Core) — contact list, detail, pipeline
 * - ContactsPage.php (Offerte Wizard) — similar contact management
 * - admin.js (CRM Core) — pipeline stage updates, note saving
 * - ContactRepository.php (CRM Core) — search, paginate, findOrCreate
 * - ContactService.php — deduplication, event logging
 *
 * Unified: single contact entity with email deduplication,
 * timeline, tags, pipeline stages, and cross-module linking.
 */

import { contacts, tags, getContactTags, getContactTimeline, getContactLeads, getContactOffertes, getContactBookings, getCompanyPipeline, timeline as timelineRepo } from '../../data/db.js';
import { escHtml, formatDate, timeAgo, avatarColor, initials, debounce, toast, openModal, closeModal, normalizeEmail, uid } from '../../core/utils.js';
import store from '../../core/store.js';
import router from '../../core/router.js';

export function renderCRM(params, container) {
  if (params.sub === 'new') return renderContactForm(null, container);
  if (params.id && params.id !== 'new') return renderContactDetail(params.id, container);
  return renderContactList(container);
}

function renderContactList(container) {
  const allContacts = contacts.getAll().sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const allTags = tags.getAll();

  const statusBadge = (status) => {
    const map = { active: 'success', lead: 'primary', inactive: 'neutral' };
    return `<span class="ds-badge ds-badge-${map[status] || 'neutral'}">${escHtml(status)}</span>`;
  };

  container.innerHTML = `
    <div class="ds-content-inner">
      <div class="ds-toolbar">
        <div class="ds-search">
          <span class="ds-search-icon">🔍</span>
          <input type="text" id="crm-search" placeholder="Zoek op naam, e-mail of telefoon..." class="ds-input">
        </div>
        <select id="crm-filter-status" class="ds-select" style="width:auto;min-width:140px;">
          <option value="">Alle statussen</option>
          <option value="active">Actief</option>
          <option value="lead">Lead</option>
          <option value="inactive">Inactief</option>
        </select>
        <div style="flex:1"></div>
        <a href="#/crm/new" class="ds-btn ds-btn-primary">+ Nieuw contact</a>
      </div>

      <div class="ds-table-wrap">
        <table class="ds-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Telefoon</th>
              <th>Status</th>
              <th>Pipeline</th>
              <th>Tags</th>
              <th>Laatst actief</th>
            </tr>
          </thead>
          <tbody id="crm-table-body">
            ${allContacts.map(c => contactRow(c, allTags)).join('')}
          </tbody>
        </table>
      </div>
      <div id="crm-count" style="padding:12px 0;font-size:12px;color:var(--ds-text-muted);">${allContacts.length} contacten</div>
    </div>
  `;

  // Search & filter
  const searchInput = container.querySelector('#crm-search');
  const filterStatus = container.querySelector('#crm-filter-status');

  const applyFilter = debounce(() => {
    const q = searchInput.value.toLowerCase();
    const status = filterStatus.value;
    let filtered = contacts.getAll();
    if (q) filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.tel || '').toLowerCase().includes(q)
    );
    if (status) filtered = filtered.filter(c => c.status === status);
    filtered.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    container.querySelector('#crm-table-body').innerHTML = filtered.map(c => contactRow(c, allTags)).join('');
    container.querySelector('#crm-count').textContent = `${filtered.length} contacten`;
  }, 200);

  searchInput.addEventListener('input', applyFilter);
  filterStatus.addEventListener('change', applyFilter);
}

function contactRow(c, allTags) {
  const cTags = getContactTags(c.id);
  const map = { active: 'success', lead: 'primary', inactive: 'neutral' };
  return `
    <tr style="cursor:pointer" onclick="location.hash='#/crm/${c.id}'">
      <td>
        <div class="ds-table-name">
          <div class="ds-table-avatar" style="background:${avatarColor(c.name)}">${initials(c.name)}</div>
          <div>
            <div style="font-weight:600">${escHtml(c.name || 'Onbekend')}</div>
            <div style="font-size:12px;color:var(--ds-text-muted)">${escHtml(c.email)}</div>
          </div>
        </div>
      </td>
      <td>${escHtml(c.tel || '—')}</td>
      <td><span class="ds-badge ds-badge-${map[c.status] || 'neutral'}">${escHtml(c.status)}</span></td>
      <td><span style="font-size:12px;font-weight:500">${escHtml(c.pipeline_stage || '—')}</span></td>
      <td>${cTags.map(t => `<span class="ds-badge" style="background:${t.color}22;color:${t.color};margin-right:4px">${escHtml(t.name)}</span>`).join('') || '<span style="color:var(--ds-text-muted);font-size:12px">—</span>'}</td>
      <td style="font-size:12px;color:var(--ds-text-muted)">${timeAgo(c.last_activity_at || c.updated_at)}</td>
    </tr>
  `;
}

function renderContactDetail(id, container) {
  const contact = contacts.getById(Number(id));
  if (!contact) {
    container.innerHTML = '<div class="ds-empty"><div class="ds-empty-icon">🔍</div><div class="ds-empty-title">Contact niet gevonden</div></div>';
    return;
  }

  const cTags = getContactTags(contact.id);
  const cTimeline = getContactTimeline(contact.id);
  const cLeads = getContactLeads(contact.id);
  const cOffertes = getContactOffertes(contact.id);
  const cBookings = getContactBookings(contact.email);
  const pipeline = getCompanyPipeline(contact.company_id || store.get('activeCompanyId'));

  const typeIcons = { contact_created: '👤', quote_sent: '📤', quote_accepted: '✅', booking_created: '📅', email_sent: '📧' };
  const statusMap = { active: 'success', lead: 'primary', inactive: 'neutral' };

  container.innerHTML = `
    <div class="ds-content-inner">
      <div style="margin-bottom:16px">
        <a href="#/crm" class="ds-btn ds-btn-ghost ds-btn-sm">← Terug naar contacten</a>
      </div>

      <div class="ds-grid-2" style="grid-template-columns:1fr 380px;gap:24px;">
        <!-- Main info -->
        <div>
          <!-- Contact header -->
          <div class="ds-card" style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
              <div class="ds-table-avatar" style="width:56px;height:56px;font-size:20px;background:${avatarColor(contact.name)}">${initials(contact.name)}</div>
              <div style="flex:1">
                <h2 style="font-size:22px;font-weight:800;margin-bottom:2px">${escHtml(contact.name || 'Onbekend')}</h2>
                <div style="color:var(--ds-text-muted);font-size:13px">${escHtml(contact.email)} · ${escHtml(contact.tel || 'Geen telefoon')}</div>
              </div>
              <span class="ds-badge ds-badge-${statusMap[contact.status] || 'neutral'}">${escHtml(contact.status)}</span>
              <button class="ds-btn ds-btn-secondary ds-btn-sm" id="crm-edit-btn">Bewerken</button>
            </div>

            <!-- Pipeline stages (migrated from CRM Core admin.js pipeline buttons) -->
            <div style="margin-bottom:12px">
              <div style="font-size:12px;font-weight:600;color:var(--ds-text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Pipeline</div>
              <div class="ds-pipeline" id="crm-pipeline">
                ${pipeline.map(s => `
                  <button class="ds-pipeline-stage ${contact.pipeline_stage === s.key ? 'active' : ''}"
                    style="${contact.pipeline_stage === s.key ? `background:${s.color};border-color:${s.color};color:#fff` : `color:${s.color}`}"
                    data-stage="${escHtml(s.key)}">${escHtml(s.label)}</button>
                `).join('')}
              </div>
            </div>

            <!-- Tags -->
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--ds-text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Tags</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${cTags.map(t => `<span class="ds-badge" style="background:${t.color}22;color:${t.color}">${escHtml(t.name)}</span>`).join('') || '<span style="color:var(--ds-text-muted);font-size:13px">Geen tags</span>'}
              </div>
            </div>
          </div>

          <!-- Notes (migrated from CRM Core dcrmSaveNote) -->
          <div class="ds-card" style="margin-bottom:16px">
            <div class="ds-card-title" style="margin-bottom:8px">Notities</div>
            <textarea id="crm-notes" class="ds-textarea" rows="3" placeholder="Notities over dit contact...">${escHtml(contact.notes || '')}</textarea>
            <button class="ds-btn ds-btn-secondary ds-btn-sm" style="margin-top:8px" id="crm-save-notes">Notitie opslaan</button>
          </div>

          <!-- Offertes for this contact -->
          ${cOffertes.length ? `
          <div class="ds-card" style="margin-bottom:16px">
            <div class="ds-card-title" style="margin-bottom:12px">Offertes (${cOffertes.length})</div>
            ${cOffertes.map(o => {
              const sMap = { draft: 'neutral', sent: 'warning', accepted: 'success', rejected: 'danger' };
              return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--ds-border-light);cursor:pointer" onclick="location.hash='#/offertes/${o.id}'">
                <div style="flex:1"><strong>${escHtml(o.ref)}</strong> <span style="color:var(--ds-text-muted);font-size:12px">— ${formatDate(o.date)}</span></div>
                <span class="ds-badge ds-badge-${sMap[o.status] || 'neutral'}">${escHtml(o.status)}</span>
                <span style="font-weight:700">${(o.total || 0).toLocaleString('nl-BE', {style:'currency',currency:'EUR'})}</span>
              </div>`;
            }).join('')}
          </div>` : ''}

          <!-- Bookings for this contact -->
          ${cBookings.length ? `
          <div class="ds-card">
            <div class="ds-card-title" style="margin-bottom:12px">Boekingen (${cBookings.length})</div>
            ${cBookings.map(b => `
              <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--ds-border-light);">
                <div style="flex:1">
                  <div style="font-weight:600;font-size:13px">${escHtml(b.event_type_title || 'Afspraak')}</div>
                  <div style="font-size:12px;color:var(--ds-text-muted)">${formatDate(b.start_time)}</div>
                </div>
                <span class="ds-badge ds-badge-${b.status === 'confirmed' ? 'success' : b.status === 'pending' ? 'warning' : 'neutral'}">${escHtml(b.status)}</span>
              </div>
            `).join('')}
          </div>` : ''}
        </div>

        <!-- Sidebar: Timeline -->
        <div>
          <div class="ds-card">
            <div class="ds-card-title" style="margin-bottom:12px">Geschiedenis</div>
            ${cTimeline.length ? `
            <div class="ds-timeline">
              ${cTimeline.map(e => `
                <div class="ds-timeline-item">
                  <div class="ds-timeline-dot" style="background:${e.event_type.includes('accepted') ? 'var(--ds-success)' : e.event_type.includes('sent') ? 'var(--ds-info)' : 'var(--ds-primary)'}"></div>
                  <div class="ds-timeline-time">${timeAgo(e.occurred_at)}</div>
                  <div class="ds-timeline-text">${typeIcons[e.event_type] || '📌'} ${escHtml(e.summary)}</div>
                </div>
              `).join('')}
            </div>` : '<div class="ds-empty" style="padding:24px"><p>Nog geen activiteiten.</p></div>'}
          </div>
        </div>
      </div>
    </div>
  `;

  // Pipeline stage click handler (migrated from CRM Core admin.js)
  container.querySelectorAll('#crm-pipeline .ds-pipeline-stage').forEach(btn => {
    btn.addEventListener('click', () => {
      const stage = btn.dataset.stage;
      contacts.update(contact.id, { pipeline_stage: stage });
      toast(`Pipeline fase gewijzigd naar "${stage}"`);
      renderContactDetail(id, container);
    });
  });

  // Save notes (migrated from CRM Core dcrmSaveNote)
  container.querySelector('#crm-save-notes').addEventListener('click', () => {
    const notes = container.querySelector('#crm-notes').value;
    contacts.update(contact.id, { notes });
    toast('Notitie opgeslagen');
  });

  // Edit button
  container.querySelector('#crm-edit-btn').addEventListener('click', () => {
    renderContactForm(contact, container);
  });
}

function renderContactForm(contact, container) {
  const isNew = !contact;

  container.innerHTML = `
    <div class="ds-content-inner" style="max-width:640px">
      <div style="margin-bottom:16px">
        <a href="#/crm${contact ? '/' + contact.id : ''}" class="ds-btn ds-btn-ghost ds-btn-sm">← Terug</a>
      </div>
      <div class="ds-card">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">${isNew ? 'Nieuw contact' : 'Contact bewerken'}</h2>
        <form id="crm-contact-form">
          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">Naam *</label>
              <input type="text" name="name" class="ds-input" required value="${escHtml(contact?.name || '')}" placeholder="Volledige naam">
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">E-mail *</label>
              <input type="email" name="email" class="ds-input" required value="${escHtml(contact?.email || '')}" placeholder="email@voorbeeld.be">
            </div>
          </div>
          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">Telefoon</label>
              <input type="tel" name="tel" class="ds-input" value="${escHtml(contact?.tel || '')}" placeholder="+32 470 12 34 56">
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">Status</label>
              <select name="status" class="ds-select">
                <option value="lead" ${contact?.status === 'lead' ? 'selected' : ''}>Lead</option>
                <option value="active" ${contact?.status === 'active' ? 'selected' : ''}>Actief</option>
                <option value="inactive" ${contact?.status === 'inactive' ? 'selected' : ''}>Inactief</option>
              </select>
            </div>
          </div>
          <div class="ds-form-group">
            <label class="ds-form-label">Bron</label>
            <select name="source" class="ds-select">
              <option value="manual" ${contact?.source === 'manual' ? 'selected' : ''}>Handmatig</option>
              <option value="website" ${contact?.source === 'website' ? 'selected' : ''}>Website</option>
              <option value="referral" ${contact?.source === 'referral' ? 'selected' : ''}>Referral</option>
              <option value="offerte-wizard" ${contact?.source === 'offerte-wizard' ? 'selected' : ''}>Offerte Wizard</option>
              <option value="booking" ${contact?.source === 'booking' ? 'selected' : ''}>Booking</option>
              <option value="outreach" ${contact?.source === 'outreach' ? 'selected' : ''}>Outreach</option>
            </select>
          </div>
          <div class="ds-form-group">
            <label class="ds-form-label">Notities</label>
            <textarea name="notes" class="ds-textarea" rows="3" placeholder="Notities...">${escHtml(contact?.notes || '')}</textarea>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            ${!isNew ? '<button type="button" class="ds-btn ds-btn-danger ds-btn-sm" id="crm-delete-btn">Verwijderen</button>' : ''}
            <button type="submit" class="ds-btn ds-btn-primary">${isNew ? 'Contact aanmaken' : 'Opslaan'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#crm-contact-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.email = normalizeEmail(data.email);

    if (isNew) {
      // Dedupe check (migrated from ContactRepository.findOrCreate)
      const existing = contacts.findOneBy('email', data.email);
      if (existing) {
        contacts.update(existing.id, data);
        toast('Bestaand contact bijgewerkt (e-mail deduplicatie)');
        router.navigate(`crm/${existing.id}`);
        return;
      }
      data.pipeline_stage = 'Nieuw';
      data.company_id = store.get('activeCompanyId');
      const created = contacts.create(data);
      // Log event in timeline
      timelineRepo.create({
        contact_id: created.id,
        event_type: 'contact_created',
        summary: 'Contact aangemaakt',
        source_app: 'manual',
        occurred_at: new Date().toISOString(),
      });
      toast('Contact aangemaakt');
      router.navigate(`crm/${created.id}`);
    } else {
      contacts.update(contact.id, data);
      toast('Contact bijgewerkt');
      router.navigate(`crm/${contact.id}`);
    }
  });

  if (!isNew) {
    container.querySelector('#crm-delete-btn')?.addEventListener('click', () => {
      if (confirm('Dit contact verwijderen?')) {
        contacts.delete(contact.id);
        toast('Contact verwijderd');
        router.navigate('crm');
      }
    });
  }
}
