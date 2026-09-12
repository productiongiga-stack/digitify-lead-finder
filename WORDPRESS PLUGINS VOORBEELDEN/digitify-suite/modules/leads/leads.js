/**
 * Digitify Suite — Leads & Outreach Module
 *
 * Migrated from:
 * - LeadRepository.php + LeadService.php (Outreach) — lead CRUD, status pipeline
 * - leads.php view (Outreach) — leads inbox UI
 * - templates.php view (Outreach) — email templates
 * - logs.php view (Outreach) — sent message logs
 * - LeadsPage.php (Offerte Wizard) — wizard leads
 * - CrmBridge.php (Outreach) — CRM sync
 * - MailService.php + MessageRepository.php (Outreach) — email sending/tracking
 * - ActivityLogService.php (Outreach) — activity logging
 *
 * Unified: single lead pipeline with outreach template management.
 */

import { leads, contacts, emailLogs, templates } from '../../data/db.js';
import { escHtml, formatDate, formatCurrency, timeAgo, avatarColor, initials, debounce, toast } from '../../core/utils.js';
import router from '../../core/router.js';

export function renderLeads(params, container) {
  if (params.sub === 'templates') return renderTemplates(container);
  if (params.sub === 'logs') return renderLogs(container);
  if (params.id && params.id !== 'templates' && params.id !== 'logs') return renderLeadDetail(params.id, container);
  return renderLeadList(container);
}

function renderLeadList(container) {
  const allLeads = leads.getAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const pipelineCounts = {
    all: allLeads.length,
    new: allLeads.filter(l => l.status === 'new').length,
    quoted: allLeads.filter(l => l.status === 'quoted').length,
    won: allLeads.filter(l => l.status === 'won').length,
    lost: allLeads.filter(l => l.status === 'lost').length,
  };

  container.innerHTML = `
    <div class="ds-content-inner">
      <!-- Sub-navigation -->
      <div class="ds-tabs">
        <div class="ds-tab active" data-tab="leads">Leads</div>
        <div class="ds-tab" data-tab="templates" onclick="location.hash='#/leads/templates'">Templates</div>
        <div class="ds-tab" data-tab="logs" onclick="location.hash='#/leads/logs'">Verzendlogs</div>
      </div>

      <!-- Pipeline filter badges -->
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="ds-badge ds-badge-neutral lead-filter active" data-status="">Alle (${pipelineCounts.all})</button>
        <button class="ds-badge ds-badge-primary lead-filter" data-status="new">Nieuw (${pipelineCounts.new})</button>
        <button class="ds-badge ds-badge-warning lead-filter" data-status="quoted">Offerte verzonden (${pipelineCounts.quoted})</button>
        <button class="ds-badge ds-badge-success lead-filter" data-status="won">Gewonnen (${pipelineCounts.won})</button>
        <button class="ds-badge ds-badge-danger lead-filter" data-status="lost">Verloren (${pipelineCounts.lost})</button>
      </div>

      <div class="ds-toolbar">
        <div class="ds-search">
          <span class="ds-search-icon">🔍</span>
          <input type="text" id="leads-search" placeholder="Zoek leads..." class="ds-input">
        </div>
      </div>

      <div class="ds-table-wrap">
        <table class="ds-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Diensten</th>
              <th>Status</th>
              <th>Bedrag</th>
              <th>Pipeline</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody id="leads-table-body">
            ${allLeads.map(l => leadRow(l)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Filter logic
  let activeStatus = '';
  container.querySelectorAll('.lead-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.lead-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStatus = btn.dataset.status;
      applyFilter();
    });
  });

  const searchInput = container.querySelector('#leads-search');
  const applyFilter = debounce(() => {
    const q = searchInput.value.toLowerCase();
    let filtered = leads.getAll();
    if (activeStatus) filtered = filtered.filter(l => l.status === activeStatus);
    if (q) filtered = filtered.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.diensten || '').toLowerCase().includes(q)
    );
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    container.querySelector('#leads-table-body').innerHTML = filtered.map(l => leadRow(l)).join('');
  }, 200);

  searchInput.addEventListener('input', applyFilter);
}

function leadRow(l) {
  const statusMap = { new: 'primary', quoted: 'warning', won: 'success', lost: 'danger' };
  return `
    <tr style="cursor:pointer" onclick="location.hash='#/leads/${l.id}'">
      <td>
        <div class="ds-table-name">
          <div class="ds-table-avatar" style="background:${avatarColor(l.name)}">${initials(l.name)}</div>
          <div>
            <div style="font-weight:600">${escHtml(l.name || 'Onbekend')}</div>
            <div style="font-size:12px;color:var(--ds-text-muted)">${escHtml(l.email)}</div>
          </div>
        </div>
      </td>
      <td><span style="font-size:12px">${escHtml(l.diensten || '—')}</span></td>
      <td><span class="ds-badge ds-badge-${statusMap[l.status] || 'neutral'}">${escHtml(l.status)}</span></td>
      <td style="font-weight:600">${formatCurrency(l.total_price)}</td>
      <td style="font-size:12px">${escHtml(l.pipeline_stage || '—')}</td>
      <td style="font-size:12px;color:var(--ds-text-muted)">${timeAgo(l.created_at)}</td>
    </tr>
  `;
}

function renderLeadDetail(id, container) {
  const lead = leads.getById(Number(id));
  if (!lead) {
    container.innerHTML = '<div class="ds-empty"><div class="ds-empty-icon">🔍</div><div class="ds-empty-title">Lead niet gevonden</div></div>';
    return;
  }

  const contact = lead.contact_id ? contacts.getById(lead.contact_id) : null;
  const statusMap = { new: 'primary', quoted: 'warning', won: 'success', lost: 'danger' };

  container.innerHTML = `
    <div class="ds-content-inner" style="max-width:800px">
      <div style="margin-bottom:16px">
        <a href="#/leads" class="ds-btn ds-btn-ghost ds-btn-sm">← Terug naar leads</a>
      </div>

      <div class="ds-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div class="ds-table-avatar" style="width:48px;height:48px;font-size:18px;background:${avatarColor(lead.name)}">${initials(lead.name)}</div>
          <div style="flex:1">
            <h2 style="font-size:20px;font-weight:800">${escHtml(lead.name)}</h2>
            <div style="color:var(--ds-text-muted);font-size:13px">${escHtml(lead.email)} · ${escHtml(lead.tel || '')}</div>
          </div>
          <span class="ds-badge ds-badge-${statusMap[lead.status] || 'neutral'}" style="font-size:13px;padding:6px 14px">${escHtml(lead.status)}</span>
        </div>

        <div class="ds-form-row" style="margin-bottom:16px">
          <div>
            <div style="font-size:12px;color:var(--ds-text-muted);margin-bottom:4px">Diensten</div>
            <div style="font-weight:600">${escHtml(lead.diensten || '—')}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--ds-text-muted);margin-bottom:4px">Bedrag</div>
            <div style="font-weight:700;font-size:18px">${formatCurrency(lead.total_price)}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--ds-text-muted);margin-bottom:4px">Pipeline</div>
            <div style="font-weight:600">${escHtml(lead.pipeline_stage || '—')}</div>
          </div>
          <div>
            <div style="font-size:12px;color:var(--ds-text-muted);margin-bottom:4px">Datum</div>
            <div>${formatDate(lead.created_at)}</div>
          </div>
        </div>

        ${contact ? `<div style="margin-bottom:12px"><a href="#/crm/${contact.id}" class="ds-btn ds-btn-ghost ds-btn-sm">👤 Bekijk CRM contact</a></div>` : ''}

        <!-- Status update -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <span style="font-size:12px;color:var(--ds-text-muted);align-self:center">Status wijzigen:</span>
          ${['new', 'quoted', 'won', 'lost'].map(s => `
            <button class="ds-btn ds-btn-sm ${lead.status === s ? 'ds-btn-primary' : 'ds-btn-secondary'} lead-status-btn" data-status="${s}">${s}</button>
          `).join('')}
        </div>

        <div class="ds-form-group">
          <label class="ds-form-label">Notities</label>
          <textarea id="lead-notes" class="ds-textarea" rows="3">${escHtml(lead.notes || '')}</textarea>
          <button class="ds-btn ds-btn-secondary ds-btn-sm" style="margin-top:8px" id="lead-save-notes">Opslaan</button>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.lead-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      leads.update(lead.id, { status: btn.dataset.status });
      toast(`Lead status gewijzigd naar "${btn.dataset.status}"`);
      renderLeadDetail(id, container);
    });
  });

  container.querySelector('#lead-save-notes').addEventListener('click', () => {
    leads.update(lead.id, { notes: container.querySelector('#lead-notes').value });
    toast('Notities opgeslagen');
  });
}

function renderTemplates(container) {
  const allTemplates = templates.getAll();

  container.innerHTML = `
    <div class="ds-content-inner">
      <div class="ds-tabs">
        <div class="ds-tab" onclick="location.hash='#/leads'">Leads</div>
        <div class="ds-tab active">Templates</div>
        <div class="ds-tab" onclick="location.hash='#/leads/logs'">Verzendlogs</div>
      </div>

      <div class="ds-toolbar">
        <h3 style="font-weight:700">E-mail Templates</h3>
        <div style="flex:1"></div>
        <button class="ds-btn ds-btn-primary" id="tpl-add">+ Nieuwe template</button>
      </div>

      <div class="ds-grid-2">
        ${allTemplates.map(t => `
          <div class="ds-card" style="cursor:pointer">
            <div class="ds-card-title">${escHtml(t.name)}</div>
            <div style="font-size:13px;color:var(--ds-text-muted);margin-top:4px">Subject: ${escHtml(t.subject)}</div>
            <div style="margin-top:12px;padding:12px;background:var(--ds-bg);border-radius:var(--ds-radius-md);font-size:12px;max-height:100px;overflow:hidden">${t.html || '(leeg)'}</div>
            <div style="margin-top:8px;font-size:11px;color:var(--ds-text-muted)">Bijgewerkt: ${timeAgo(t.updated_at)}</div>
          </div>
        `).join('') || '<div class="ds-empty"><p>Nog geen templates.</p></div>'}
      </div>
    </div>
  `;
}

function renderLogs(container) {
  const allLogs = emailLogs.getAll().sort((a, b) => new Date(b.sent_at || b.created_at) - new Date(a.sent_at || a.created_at));

  container.innerHTML = `
    <div class="ds-content-inner">
      <div class="ds-tabs">
        <div class="ds-tab" onclick="location.hash='#/leads'">Leads</div>
        <div class="ds-tab" onclick="location.hash='#/leads/templates'">Templates</div>
        <div class="ds-tab active">Verzendlogs</div>
      </div>

      <div class="ds-table-wrap">
        <table class="ds-table">
          <thead>
            <tr><th>Ontvanger</th><th>Onderwerp</th><th>Status</th><th>Opens</th><th>Clicks</th><th>Verzonden</th></tr>
          </thead>
          <tbody>
            ${allLogs.map(l => `
              <tr>
                <td>${escHtml(l.lead_email)}</td>
                <td>${escHtml(l.subject)}</td>
                <td><span class="ds-badge ds-badge-${l.status === 'sent' ? 'success' : 'neutral'}">${escHtml(l.status)}</span></td>
                <td>${l.open_count || 0}</td>
                <td>${l.click_count || 0}</td>
                <td style="font-size:12px;color:var(--ds-text-muted)">${timeAgo(l.sent_at)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--ds-text-muted);padding:24px">Nog geen verzonden e-mails.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
