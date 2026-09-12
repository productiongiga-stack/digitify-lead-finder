/**
 * Digitify Suite — Main Application Entry Point
 *
 * This is the central bootstrap that replaces all WordPress plugin
 * initialization hooks (plugins_loaded, admin_init, admin_menu).
 *
 * Architecture:
 * - SPA with hash-based routing (no server required)
 * - Module-based: each module registers its own routes
 * - Data layer: localStorage-backed repositories (swap for API later)
 * - State: reactive store with localStorage persistence
 */

import { initDatabase } from '../../data/db.js';
import store from '../../core/store.js';
import router from '../../core/router.js';

// Module imports
import { renderDashboard } from '../../modules/dashboard/dashboard.js';
import { renderCRM } from '../../modules/crm/crm.js';
import { renderLeads } from '../../modules/leads/leads.js';
import { renderBooking } from '../../modules/booking/booking.js';
import { renderAgenda } from '../../modules/agenda/agenda.js';
import { renderOffertes } from '../../modules/offertes/offertes.js';
import { renderCompanies } from '../../modules/companies/companies.js';
import { renderSettings } from '../../modules/settings/settings.js';

// ── Initialize ───────────────────────────────────────────

function boot() {
  // 1. Initialize data layer (seeds demo data on first load)
  initDatabase();

  // 2. Apply theme
  const theme = store.get('theme');
  if (theme) document.documentElement.setAttribute('data-theme', theme);

  // 3. Register routes
  router
    .register('dashboard', renderDashboard)
    .register('crm', renderCRM)
    .register('leads', renderLeads)
    .register('booking', renderBooking)
    .register('agenda', renderAgenda)
    .register('offertes', renderOffertes)
    .register('companies', renderCompanies)
    .register('settings', renderSettings);

  // 4. Update active nav on route change
  router.onChange((module) => {
    // Update sidebar active state
    document.querySelectorAll('.ds-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.module === module);
    });

    // Update topbar title
    const titles = {
      dashboard: 'Dashboard',
      crm: 'CRM — Contacten',
      leads: 'Leads & Outreach',
      booking: 'Booking',
      agenda: 'Agenda / Planning',
      offertes: 'Offertes',
      companies: 'Bedrijven',
      settings: 'Instellingen',
    };
    const titleEl = document.getElementById('ds-topbar-title');
    if (titleEl) titleEl.textContent = titles[module] || 'Digitify Suite';
  });

  // 5. Start router
  router.start();

  // 6. Setup sidebar navigation clicks
  document.querySelectorAll('.ds-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const module = item.dataset.module;
      if (module) router.navigate(module);
    });
  });

  // 7. Modal close handlers
  document.getElementById('ds-modal-close')?.addEventListener('click', () => {
    document.getElementById('ds-modal-overlay')?.classList.remove('open');
  });
  document.getElementById('ds-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'ds-modal-overlay') e.target.classList.remove('open');
  });

  // 8. Company switcher click → navigate to companies
  document.querySelector('.ds-company-switcher')?.addEventListener('click', () => {
    router.navigate('companies');
  });

  // 8. Update company display in sidebar
  updateCompanyDisplay();
  store.subscribe('activeCompanyId', () => updateCompanyDisplay());
}

function updateCompanyDisplay() {
  import('../../data/db.js').then(({ companies }) => {
    const company = companies.getById(store.get('activeCompanyId'));
    const nameEl = document.querySelector('.ds-company-name');
    const avatarEl = document.querySelector('.ds-company-avatar');
    if (nameEl && company) nameEl.textContent = company.name;
    if (avatarEl && company) {
      avatarEl.textContent = (company.name || '?')[0];
      avatarEl.style.background = `linear-gradient(135deg, ${company.primary_color || '#f59e0b'}, ${company.secondary_color || company.primary_color || '#f97316'})`;
    }
  });
}

// ── Boot on DOM ready ────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);
