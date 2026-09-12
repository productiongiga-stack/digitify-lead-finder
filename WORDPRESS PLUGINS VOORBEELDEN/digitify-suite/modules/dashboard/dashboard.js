/**
 * Digitify Suite — Dashboard Module
 *
 * Migrated from:
 * - DashboardPage.php (CRM Core) — KPI stats, recent activity
 * - dashboard.php view (Offerte Wizard) — lead/quote overview
 * - dashboard.php view (Outreach) — lead stats
 *
 * Merged into one unified dashboard with KPIs from all modules.
 */

import { getDashboardKPIs, contacts, leads, offertes, bookings, agendaItems, timeline } from '../../data/db.js';
import { escHtml, formatDate, formatCurrency, timeAgo, avatarColor, initials } from '../../core/utils.js';
import store from '../../core/store.js';

export function renderDashboard(params, container) {
  const companyId = store.get('activeCompanyId');
  const kpi = getDashboardKPIs(companyId);
  const recentLeads = leads.getAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const recentOffertes = offertes.getAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const upcomingBookings = bookings.getAll()
    .filter(b => new Date(b.start_time) > new Date() && b.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 5);
  const upcomingAgenda = agendaItems.getAll()
    .filter(a => new Date(a.start_at) > new Date() && a.status !== 'done')
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
    .slice(0, 5);
  const recentActivity = timeline.getAll()
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
    .slice(0, 8);

  const statusBadge = (status) => {
    const map = { new: 'primary', quoted: 'warning', sent: 'warning', won: 'success', accepted: 'success', lost: 'danger', rejected: 'danger', draft: 'neutral', pending: 'info', confirmed: 'success', completed: 'success' };
    return `<span class="ds-badge ds-badge-${map[status] || 'neutral'}">${escHtml(status)}</span>`;
  };

  container.innerHTML = `
    <div class="ds-content-inner">
      <!-- KPI Stats -->
      <div class="ds-stats-grid">
        <div class="ds-stat-card">
          <div class="ds-stat-icon primary">👥</div>
          <div class="ds-stat-content">
            <div class="ds-stat-value">${kpi.totalContacts}</div>
            <div class="ds-stat-label">Contacten</div>
          </div>
        </div>
        <div class="ds-stat-card">
          <div class="ds-stat-icon info">🎯</div>
          <div class="ds-stat-content">
            <div class="ds-stat-value">${kpi.activeLeads}</div>
            <div class="ds-stat-label">Actieve Leads</div>
          </div>
        </div>
        <div class="ds-stat-card">
          <div class="ds-stat-icon warning">📄</div>
          <div class="ds-stat-content">
            <div class="ds-stat-value">${kpi.pendingOffertes}</div>
            <div class="ds-stat-label">Open Offertes</div>
            <div class="ds-stat-change">${formatCurrency(kpi.pendingValue)}</div>
          </div>
        </div>
        <div class="ds-stat-card">
          <div class="ds-stat-icon success">💰</div>
          <div class="ds-stat-content">
            <div class="ds-stat-value">${formatCurrency(kpi.totalRevenue)}</div>
            <div class="ds-stat-label">Omzet (gewonnen)</div>
            <div class="ds-stat-change up">${kpi.wonDeals} deals</div>
          </div>
        </div>
        <div class="ds-stat-card">
          <div class="ds-stat-icon info">📅</div>
          <div class="ds-stat-content">
            <div class="ds-stat-value">${kpi.upcomingBookings}</div>
            <div class="ds-stat-label">Komende Afspraken</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap;">
        <a href="#/crm/new" class="ds-btn ds-btn-primary">+ Contact toevoegen</a>
        <a href="#/leads" class="ds-btn ds-btn-secondary">Leads bekijken</a>
        <a href="#/offertes/new" class="ds-btn ds-btn-secondary">Nieuwe offerte</a>
        <a href="#/booking" class="ds-btn ds-btn-secondary">Booking beheren</a>
      </div>

      <div class="ds-grid-2" style="gap:24px;">
        <!-- Recent Leads -->
        <div class="ds-card">
          <div class="ds-card-header">
            <div>
              <div class="ds-card-title">Recente Leads</div>
              <div class="ds-card-subtitle">Laatste 5 leads</div>
            </div>
            <a href="#/leads" class="ds-btn ds-btn-ghost ds-btn-sm">Alles bekijken →</a>
          </div>
          ${recentLeads.length ? `
          <div class="ds-table-wrap" style="border:none;box-shadow:none;">
            <table class="ds-table">
              <thead><tr><th>Naam</th><th>Diensten</th><th>Status</th><th>Bedrag</th></tr></thead>
              <tbody>
                ${recentLeads.map(l => `
                  <tr style="cursor:pointer" onclick="location.hash='#/leads/${l.id}'">
                    <td>
                      <div class="ds-table-name">
                        <div class="ds-table-avatar" style="background:${avatarColor(l.name)}">${initials(l.name)}</div>
                        <div>
                          <div style="font-weight:600">${escHtml(l.name)}</div>
                          <div style="font-size:12px;color:var(--ds-text-muted)">${escHtml(l.email)}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style="font-size:12px">${escHtml(l.diensten)}</span></td>
                    <td>${statusBadge(l.status)}</td>
                    <td style="font-weight:600">${formatCurrency(l.total_price)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : '<div class="ds-empty"><p>Nog geen leads.</p></div>'}
        </div>

        <!-- Upcoming Agenda -->
        <div class="ds-card">
          <div class="ds-card-header">
            <div>
              <div class="ds-card-title">Agenda</div>
              <div class="ds-card-subtitle">Komende afspraken</div>
            </div>
            <a href="#/agenda" class="ds-btn ds-btn-ghost ds-btn-sm">Alle afspraken →</a>
          </div>
          ${upcomingAgenda.length ? upcomingAgenda.map(a => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--ds-border-light);">
              <div style="width:8px;height:8px;border-radius:50%;background:${escHtml(a.color)};flex-shrink:0"></div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:13px">${escHtml(a.title)}</div>
                <div style="font-size:12px;color:var(--ds-text-muted)">${formatDate(a.start_at)} ${new Date(a.start_at).toLocaleTimeString('nl-BE', {hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <span class="ds-badge ds-badge-${a.status === 'open' ? 'primary' : 'success'}">${escHtml(a.status)}</span>
            </div>
          `).join('') : '<div class="ds-empty"><p>Geen komende afspraken.</p></div>'}
        </div>

        <!-- Recent Offertes -->
        <div class="ds-card">
          <div class="ds-card-header">
            <div>
              <div class="ds-card-title">Recente Offertes</div>
              <div class="ds-card-subtitle">Laatste 5 offertes</div>
            </div>
            <a href="#/offertes" class="ds-btn ds-btn-ghost ds-btn-sm">Alle offertes →</a>
          </div>
          ${recentOffertes.map(o => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--ds-border-light);cursor:pointer" onclick="location.hash='#/offertes/${o.id}'">
              <div style="flex:1;">
                <div style="font-weight:600;font-size:13px">${escHtml(o.ref)} — ${escHtml(o.contact_name)}</div>
                <div style="font-size:12px;color:var(--ds-text-muted)">${formatDate(o.date)}</div>
              </div>
              ${statusBadge(o.status)}
              <span style="font-weight:700;font-size:13px">${formatCurrency(o.total)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Recent Activity Timeline -->
        <div class="ds-card">
          <div class="ds-card-header">
            <div>
              <div class="ds-card-title">Activiteit</div>
              <div class="ds-card-subtitle">Recente events</div>
            </div>
          </div>
          <div class="ds-timeline">
            ${recentActivity.map(e => {
              const contact = contacts.getById(e.contact_id);
              const typeIcons = { contact_created: '👤', quote_sent: '📤', quote_accepted: '✅', booking_created: '📅', email_sent: '📧' };
              return `
                <div class="ds-timeline-item">
                  <div class="ds-timeline-dot" style="background:${e.event_type.includes('accepted') ? 'var(--ds-success)' : e.event_type.includes('sent') ? 'var(--ds-info)' : 'var(--ds-primary)'}"></div>
                  <div class="ds-timeline-time">${timeAgo(e.occurred_at)}</div>
                  <div class="ds-timeline-text">${typeIcons[e.event_type] || '📌'} ${escHtml(e.summary)}${contact ? ` — <strong>${escHtml(contact.name)}</strong>` : ''}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}
