/**
 * Digitify Suite — Offertes Module
 *
 * Migrated from:
 * - digitify-offerte-maker plugin:
 *   - digitify-offerte.php — quote CRUD, PDF export flow, CRM push
 *   - templates/configurator.php — offerte configurator UI
 *   - assets/js/app-wp.js — configurator JS logic
 *   - assets/js/settings-wp.js — settings management
 *   - includes/dap-agenda-pro.php — agenda integration
 * - offerte-wizard-multicompany plugin:
 *   - PricingEngine.php — pricing calculation (base + perM2 + perUnit)
 *   - BuilderPage.php + builder.php — wizard builder UI
 *   - LeadService.php — lead creation from wizard
 *   - CompanyService.php — multi-company support
 *   - AjaxController.php + RestController.php — API endpoints
 *
 * Unified: single offerte system with multi-company support,
 * line items, pricing engine, and configurator.
 */

import { offertes, companies, contacts } from '../../data/db.js';
import { escHtml, formatDate, formatCurrency, timeAgo, avatarColor, initials, toast, uid } from '../../core/utils.js';
import store from '../../core/store.js';
import router from '../../core/router.js';

export function renderOffertes(params, container) {
  if (params.sub === 'new') return renderOfferteForm(null, container);
  if (params.id && params.id !== 'new') {
    if (params.parts && params.parts[1] === 'edit') return renderOfferteForm(params.id, container);
    return renderOfferteDetail(params.id, container);
  }
  return renderOfferteList(container);
}

function renderOfferteList(container) {
  const allOffertes = offertes.getAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const companyId = store.get('activeCompanyId');

  const statusCounts = {
    all: allOffertes.length,
    draft: allOffertes.filter(o => o.status === 'draft').length,
    sent: allOffertes.filter(o => o.status === 'sent').length,
    accepted: allOffertes.filter(o => o.status === 'accepted').length,
    rejected: allOffertes.filter(o => o.status === 'rejected').length,
  };

  container.innerHTML = `
    <div class="ds-content-inner">
      <div class="ds-toolbar">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="ds-badge ds-badge-neutral off-filter active" data-status="">Alle (${statusCounts.all})</button>
          <button class="ds-badge ds-badge-info off-filter" data-status="draft">Concept (${statusCounts.draft})</button>
          <button class="ds-badge ds-badge-warning off-filter" data-status="sent">Verzonden (${statusCounts.sent})</button>
          <button class="ds-badge ds-badge-success off-filter" data-status="accepted">Goedgekeurd (${statusCounts.accepted})</button>
          <button class="ds-badge ds-badge-danger off-filter" data-status="rejected">Afgewezen (${statusCounts.rejected})</button>
        </div>
        <div style="flex:1"></div>
        <a href="#/offertes/new" class="ds-btn ds-btn-primary">+ Nieuwe offerte</a>
      </div>

      <div class="ds-table-wrap">
        <table class="ds-table">
          <thead>
            <tr><th>Referentie</th><th>Contact</th><th>Status</th><th>Subtotaal</th><th>BTW</th><th>Totaal</th><th>Datum</th><th>Geldig tot</th></tr>
          </thead>
          <tbody id="off-table-body">
            ${allOffertes.map(o => offerteRow(o)).join('')}
          </tbody>
        </table>
      </div>

      <!-- Totals summary -->
      <div style="padding:16px 0;display:flex;gap:24px;font-size:13px;color:var(--ds-text-muted)">
        <span>Totale waarde: <strong style="color:var(--ds-text)">${formatCurrency(allOffertes.reduce((s, o) => s + (o.total || 0), 0))}</strong></span>
        <span>Gewonnen: <strong style="color:var(--ds-success)">${formatCurrency(allOffertes.filter(o => o.status === 'accepted').reduce((s, o) => s + (o.total || 0), 0))}</strong></span>
        <span>Open: <strong style="color:var(--ds-warning)">${formatCurrency(allOffertes.filter(o => ['draft', 'sent'].includes(o.status)).reduce((s, o) => s + (o.total || 0), 0))}</strong></span>
      </div>
    </div>
  `;

  // Filter
  let activeStatus = '';
  container.querySelectorAll('.off-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.off-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStatus = btn.dataset.status;
      let filtered = offertes.getAll();
      if (activeStatus) filtered = filtered.filter(o => o.status === activeStatus);
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      container.querySelector('#off-table-body').innerHTML = filtered.map(o => offerteRow(o)).join('');
    });
  });
}

function offerteRow(o) {
  const statusMap = { draft: 'info', sent: 'warning', accepted: 'success', rejected: 'danger' };
  const statusLabels = { draft: 'Concept', sent: 'Verzonden', accepted: 'Goedgekeurd', rejected: 'Afgewezen' };
  return `
    <tr style="cursor:pointer" onclick="location.hash='#/offertes/${o.id}'">
      <td style="font-weight:700">${escHtml(o.ref)}</td>
      <td>
        <div style="font-weight:600;font-size:13px">${escHtml(o.contact_name)}</div>
        <div style="font-size:11px;color:var(--ds-text-muted)">${escHtml(o.contact_email)}</div>
      </td>
      <td><span class="ds-badge ds-badge-${statusMap[o.status] || 'neutral'}">${statusLabels[o.status] || o.status}</span></td>
      <td>${formatCurrency(o.subtotal)}</td>
      <td style="font-size:12px">${formatCurrency(o.btw)} (${o.btw_rate}%)</td>
      <td style="font-weight:700">${formatCurrency(o.total)}</td>
      <td style="font-size:12px">${formatDate(o.date)}</td>
      <td style="font-size:12px">${formatDate(o.exp_date)}</td>
    </tr>
  `;
}

function renderOfferteDetail(id, container) {
  const offerte = offertes.getById(Number(id));
  if (!offerte) {
    container.innerHTML = '<div class="ds-empty"><div class="ds-empty-icon">🔍</div><div class="ds-empty-title">Offerte niet gevonden</div></div>';
    return;
  }

  const company = companies.getById(offerte.company_id);
  const statusMap = { draft: 'info', sent: 'warning', accepted: 'success', rejected: 'danger' };
  const statusLabels = { draft: 'Concept', sent: 'Verzonden', accepted: 'Goedgekeurd', rejected: 'Afgewezen' };
  const lines = offerte.lines || [];

  container.innerHTML = `
    <div class="ds-content-inner" style="max-width:800px">
      <div style="margin-bottom:16px;display:flex;gap:8px;">
        <a href="#/offertes" class="ds-btn ds-btn-ghost ds-btn-sm">← Terug</a>
        <div style="flex:1"></div>
        <button class="ds-btn ds-btn-secondary ds-btn-sm" id="off-edit">Bewerken</button>
        <button class="ds-btn ds-btn-secondary ds-btn-sm" id="off-pdf">📄 PDF Export</button>
      </div>

      <!-- Offerte document (premium layout, migrated from configurator.php) -->
      <div class="ds-card" style="padding:32px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
          <div>
            <div style="font-size:24px;font-weight:800;color:var(--ds-primary)">${escHtml(company?.name || 'Digitify')}</div>
            <div style="font-size:12px;color:var(--ds-text-muted);margin-top:4px">${escHtml(company?.email || '')} · ${escHtml(company?.phone || '')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:28px;font-weight:800;letter-spacing:-1px">${escHtml(offerte.ref)}</div>
            <span class="ds-badge ds-badge-${statusMap[offerte.status]}" style="font-size:13px;padding:6px 14px">${statusLabels[offerte.status] || offerte.status}</span>
          </div>
        </div>

        <div class="ds-form-row" style="margin-bottom:24px">
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--ds-text-muted);font-weight:600;letter-spacing:.5px;margin-bottom:4px">Klant</div>
            <div style="font-weight:600">${escHtml(offerte.contact_name)}</div>
            <div style="font-size:13px;color:var(--ds-text-secondary)">${escHtml(offerte.contact_email)}</div>
          </div>
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--ds-text-muted);font-weight:600;letter-spacing:.5px;margin-bottom:4px">Datum</div>
            <div>${formatDate(offerte.date)}</div>
          </div>
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--ds-text-muted);font-weight:600;letter-spacing:.5px;margin-bottom:4px">Geldig tot</div>
            <div>${formatDate(offerte.exp_date)}</div>
          </div>
        </div>

        <!-- Line items (migrated from PricingEngine output) -->
        <div class="ds-table-wrap" style="margin-bottom:20px">
          <table class="ds-table">
            <thead>
              <tr><th style="width:60%">Dienst / Omschrijving</th><th style="text-align:right">Prijs</th></tr>
            </thead>
            <tbody>
              ${lines.map(line => `
                <tr>
                  <td style="font-weight:500">${escHtml(line.service)}</td>
                  <td style="text-align:right;font-weight:600">${formatCurrency(line.price)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end">
          <div style="width:280px">
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--ds-border-light)">
              <span>Subtotaal</span><span style="font-weight:600">${formatCurrency(offerte.subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--ds-border-light)">
              <span>BTW (${offerte.btw_rate}%)</span><span>${formatCurrency(offerte.btw)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:800">
              <span>Totaal</span><span>${formatCurrency(offerte.total)}</span>
            </div>
          </div>
        </div>

        ${offerte.notes ? `<div style="margin-top:20px;padding:14px;background:var(--ds-bg);border-radius:var(--ds-radius-md);font-size:13px;color:var(--ds-text-secondary)">${escHtml(offerte.notes)}</div>` : ''}

        <!-- Status actions -->
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--ds-border);display:flex;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;color:var(--ds-text-muted);align-self:center">Status wijzigen:</span>
          ${['draft', 'sent', 'accepted', 'rejected'].map(s => `
            <button class="ds-btn ds-btn-sm ${offerte.status === s ? 'ds-btn-primary' : 'ds-btn-secondary'} off-status-btn" data-status="${s}">${statusLabels[s]}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Status change handlers
  container.querySelectorAll('.off-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      offertes.update(offerte.id, { status: btn.dataset.status });
      toast(`Status gewijzigd naar "${btn.dataset.status}"`);
      renderOfferteDetail(id, container);
    });
  });

  container.querySelector('#off-edit').addEventListener('click', () => {
    renderOfferteForm(offerte.id, container);
  });

  // PDF export placeholder
  container.querySelector('#off-pdf').addEventListener('click', () => {
    toast('PDF export wordt voorbereid... (toekomstige API integratie)');
    // @API: PDF generation endpoint would be called here
    // Original: digitify-offerte-maker generated PDFs server-side via PHP
  });
}

function renderOfferteForm(id, container) {
  const offerte = id ? offertes.getById(Number(id)) : null;
  const isNew = !offerte;
  const allContacts = contacts.getAll().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const allCompanies = companies.getAll();

  // Generate next ref number
  const lastRef = offertes.getAll()
    .map(o => o.ref)
    .filter(r => r && r.startsWith('OFF-'))
    .sort()
    .pop();
  const nextNum = lastRef ? parseInt(lastRef.split('-').pop()) + 1 : 1;
  const nextRef = `OFF-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

  const lines = offerte?.lines || [{ service: '', price: 0 }];
  const btwRate = offerte?.btw_rate ?? 21;

  container.innerHTML = `
    <div class="ds-content-inner" style="max-width:800px">
      <div style="margin-bottom:16px">
        <a href="#/offertes${offerte ? '/' + offerte.id : ''}" class="ds-btn ds-btn-ghost ds-btn-sm">← Terug</a>
      </div>

      <div class="ds-card">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">${isNew ? 'Nieuwe Offerte' : `Offerte ${escHtml(offerte.ref)} bewerken`}</h2>

        <form id="off-form">
          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">Referentie</label>
              <input type="text" name="ref" class="ds-input" value="${escHtml(offerte?.ref || nextRef)}" required>
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">Bedrijf</label>
              <select name="company_id" class="ds-select">
                ${allCompanies.map(c => `<option value="${c.id}" ${(offerte?.company_id || store.get('activeCompanyId')) === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">Contact</label>
              <select name="contact_id" class="ds-select" id="off-contact-select">
                <option value="">Selecteer contact...</option>
                ${allContacts.map(c => `<option value="${c.id}" ${offerte?.contact_id === c.id ? 'selected' : ''}>${escHtml(c.name)} (${escHtml(c.email)})</option>`).join('')}
              </select>
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">BTW tarief (%)</label>
              <input type="number" name="btw_rate" class="ds-input" value="${btwRate}" min="0" max="100">
            </div>
          </div>

          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">Datum</label>
              <input type="date" name="date" class="ds-input" value="${offerte?.date ? offerte.date.slice(0, 10) : new Date().toISOString().slice(0, 10)}">
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">Geldig tot</label>
              <input type="date" name="exp_date" class="ds-input" value="${offerte?.exp_date ? offerte.exp_date.slice(0, 10) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}">
            </div>
          </div>

          <!-- Line items (migrated from offerte configurator + PricingEngine) -->
          <div style="margin:20px 0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <label class="ds-form-label" style="margin:0">Regels</label>
              <button type="button" class="ds-btn ds-btn-ghost ds-btn-sm" id="off-add-line">+ Regel toevoegen</button>
            </div>
            <div id="off-lines">
              ${lines.map((line, i) => lineItemRow(line, i)).join('')}
            </div>
          </div>

          <!-- Totals preview -->
          <div id="off-totals" style="display:flex;justify-content:flex-end;margin-bottom:16px">
            ${renderTotalsPreview(lines, btwRate)}
          </div>

          <div class="ds-form-group">
            <label class="ds-form-label">Notities</label>
            <textarea name="notes" class="ds-textarea" rows="2">${escHtml(offerte?.notes || '')}</textarea>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end">
            ${!isNew ? '<button type="button" class="ds-btn ds-btn-danger ds-btn-sm" id="off-delete">Verwijderen</button>' : ''}
            <button type="submit" class="ds-btn ds-btn-primary">${isNew ? 'Offerte aanmaken' : 'Opslaan'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Add line
  container.querySelector('#off-add-line').addEventListener('click', () => {
    const linesEl = container.querySelector('#off-lines');
    const idx = linesEl.children.length;
    const div = document.createElement('div');
    div.innerHTML = lineItemRow({ service: '', price: 0 }, idx);
    linesEl.appendChild(div.firstElementChild);
    recalcTotals();
  });

  // Recalculate on price change
  function recalcTotals() {
    const lineEls = container.querySelectorAll('.off-line-item');
    const currentLines = Array.from(lineEls).map(el => ({
      service: el.querySelector('.off-line-service').value,
      price: parseFloat(el.querySelector('.off-line-price').value) || 0,
    }));
    const rate = parseInt(container.querySelector('[name="btw_rate"]').value) || 0;
    container.querySelector('#off-totals').innerHTML = renderTotalsPreview(currentLines, rate);
  }

  container.addEventListener('input', (e) => {
    if (e.target.classList.contains('off-line-price') || e.target.name === 'btw_rate') recalcTotals();
  });

  // Remove line
  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('off-remove-line')) {
      e.target.closest('.off-line-item').remove();
      recalcTotals();
    }
  });

  // Form submit
  container.querySelector('#off-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(e.target));

    const lineEls = container.querySelectorAll('.off-line-item');
    const newLines = Array.from(lineEls).map(el => ({
      service: el.querySelector('.off-line-service').value,
      price: parseFloat(el.querySelector('.off-line-price').value) || 0,
    })).filter(l => l.service);

    const subtotal = newLines.reduce((s, l) => s + l.price, 0);
    const rate = parseInt(formData.btw_rate) || 0;
    const btw = Math.round(subtotal * rate / 100 * 100) / 100;
    const total = Math.round((subtotal + btw) * 100) / 100;

    const contact = formData.contact_id ? contacts.getById(Number(formData.contact_id)) : null;

    const data = {
      ref: formData.ref,
      company_id: Number(formData.company_id),
      contact_id: contact ? contact.id : null,
      contact_name: contact ? contact.name : '',
      contact_email: contact ? contact.email : '',
      status: offerte?.status || 'draft',
      lines: newLines,
      subtotal,
      btw_rate: rate,
      btw,
      total,
      currency: 'EUR',
      valid_days: 30,
      date: formData.date,
      exp_date: formData.exp_date,
      notes: formData.notes || '',
    };

    if (isNew) {
      const created = offertes.create(data);
      toast('Offerte aangemaakt');
      router.navigate(`offertes/${created.id}`);
    } else {
      offertes.update(offerte.id, data);
      toast('Offerte bijgewerkt');
      router.navigate(`offertes/${offerte.id}`);
    }
  });

  // Delete
  container.querySelector('#off-delete')?.addEventListener('click', () => {
    if (confirm('Deze offerte verwijderen?')) {
      offertes.delete(offerte.id);
      toast('Offerte verwijderd');
      router.navigate('offertes');
    }
  });
}

function lineItemRow(line, idx) {
  return `
    <div class="off-line-item" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input type="text" class="ds-input off-line-service" placeholder="Dienst / Omschrijving" value="${escHtml(line.service)}" style="flex:1">
      <input type="number" class="ds-input off-line-price" placeholder="Prijs" value="${line.price || ''}" style="width:140px" step="0.01" min="0">
      <button type="button" class="ds-btn ds-btn-ghost ds-btn-sm off-remove-line" style="color:var(--ds-danger)">✕</button>
    </div>
  `;
}

function renderTotalsPreview(lines, btwRate) {
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.price) || 0), 0);
  const btw = Math.round(subtotal * btwRate / 100 * 100) / 100;
  const total = Math.round((subtotal + btw) * 100) / 100;

  return `
    <div style="width:250px;font-size:13px">
      <div style="display:flex;justify-content:space-between;padding:4px 0">
        <span>Subtotaal</span><span style="font-weight:600">${formatCurrency(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0">
        <span>BTW (${btwRate}%)</span><span>${formatCurrency(btw)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-weight:800;font-size:16px;border-top:2px solid var(--ds-border)">
        <span>Totaal</span><span>${formatCurrency(total)}</span>
      </div>
    </div>
  `;
}
