/**
 * Digitify Suite — Companies / Multi-brand Module
 *
 * Migrated from:
 * - offerte-wizard-multicompany plugin:
 *   - CompanyRepository.php — CRUD, wizard JSON, cascade delete
 *   - CompanyService.php — company management
 *   - CompaniesPage.php + companies.php view — admin UI
 *   - Installer.php — companies table schema + seed default
 *   - SettingsPage.php — per-company settings (branding, SMTP, pipeline)
 *
 * Provides workspace switching between companies/brands.
 */

import { companies, leads, offertes, contacts } from '../../data/db.js';
import { escHtml, formatDate, formatCurrency, toast, uid } from '../../core/utils.js';
import store from '../../core/store.js';
import router from '../../core/router.js';

export function renderCompanies(params, container) {
  if (params.sub === 'new') return renderCompanyForm(null, container);
  if (params.id && params.id !== 'new') return renderCompanyDetail(params.id, container);
  return renderCompanyList(container);
}

function renderCompanyList(container) {
  const allCompanies = companies.getAll();
  const activeId = store.get('activeCompanyId');

  container.innerHTML = `
    <div class="ds-content-inner">
      <div class="ds-toolbar">
        <h3 style="font-weight:700">Bedrijven / Workspaces</h3>
        <div style="flex:1"></div>
        <a href="#/companies/new" class="ds-btn ds-btn-primary">+ Nieuw bedrijf</a>
      </div>

      <div class="ds-grid-2" style="gap:16px">
        ${allCompanies.map(c => {
          const isActive = c.id === activeId;
          const companyLeads = leads.findBy('company_id', c.id).length;
          const companyOffertes = offertes.findBy('company_id', c.id);
          const revenue = companyOffertes.filter(o => o.status === 'accepted').reduce((s, o) => s + (o.total || 0), 0);

          return `
            <div class="ds-card" style="cursor:pointer;${isActive ? 'border-color:var(--ds-primary);border-width:2px' : ''}" onclick="location.hash='#/companies/${c.id}'">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
                <div style="width:48px;height:48px;border-radius:var(--ds-radius-md);background:${c.primary_color || '#6366f1'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px">
                  ${escHtml((c.name || '?')[0])}
                </div>
                <div style="flex:1">
                  <div style="font-size:16px;font-weight:700">${escHtml(c.name)}</div>
                  <div style="font-size:12px;color:var(--ds-text-muted)">${escHtml(c.email || '')} · ${escHtml(c.phone || '')}</div>
                </div>
                ${isActive ? '<span class="ds-badge ds-badge-primary">Actief</span>' : `<button class="ds-btn ds-btn-ghost ds-btn-sm switch-company-btn" data-id="${c.id}">Activeren</button>`}
              </div>
              <div style="display:flex;gap:16px">
                <div style="font-size:12px"><span style="color:var(--ds-text-muted)">Leads:</span> <strong>${companyLeads}</strong></div>
                <div style="font-size:12px"><span style="color:var(--ds-text-muted)">Offertes:</span> <strong>${companyOffertes.length}</strong></div>
                <div style="font-size:12px"><span style="color:var(--ds-text-muted)">Omzet:</span> <strong>${formatCurrency(revenue)}</strong></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Switch company
  container.querySelectorAll('.switch-company-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      store.set('activeCompanyId', id);
      toast(`Actieve workspace: ${companies.getById(id)?.name}`);
      renderCompanyList(container);
      // Update sidebar company switcher
      updateSidebarCompany();
    });
  });
}

function renderCompanyDetail(id, container) {
  const company = companies.getById(Number(id));
  if (!company) {
    container.innerHTML = '<div class="ds-empty"><div class="ds-empty-icon">🏢</div><div class="ds-empty-title">Bedrijf niet gevonden</div></div>';
    return;
  }

  let pipeline;
  try { pipeline = JSON.parse(company.pipeline_stages || '[]'); } catch { pipeline = []; }

  container.innerHTML = `
    <div class="ds-content-inner" style="max-width:800px">
      <div style="margin-bottom:16px;display:flex;gap:8px">
        <a href="#/companies" class="ds-btn ds-btn-ghost ds-btn-sm">← Terug</a>
        <div style="flex:1"></div>
        <button class="ds-btn ds-btn-secondary ds-btn-sm" id="comp-edit">Bewerken</button>
        ${store.get('activeCompanyId') !== company.id ? `<button class="ds-btn ds-btn-primary ds-btn-sm" id="comp-activate">Als actief instellen</button>` : '<span class="ds-badge ds-badge-primary">Actieve workspace</span>'}
      </div>

      <div class="ds-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div style="width:64px;height:64px;border-radius:var(--ds-radius-lg);background:${company.primary_color || '#6366f1'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:24px">
            ${escHtml((company.name || '?')[0])}
          </div>
          <div>
            <h2 style="font-size:22px;font-weight:800">${escHtml(company.name)}</h2>
            <div style="color:var(--ds-text-muted);font-size:13px">${escHtml(company.email || '')} · ${escHtml(company.phone || '')}</div>
          </div>
        </div>

        <div class="ds-form-row" style="margin-bottom:16px">
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--ds-text-muted);font-weight:600;margin-bottom:4px">Slug</div>
            <div style="font-weight:500">${escHtml(company.slug)}</div>
          </div>
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--ds-text-muted);font-weight:600;margin-bottom:4px">BTW</div>
            <div>${company.btw_rate}%${company.btw_enabled ? '' : ' (uitgeschakeld)'}</div>
          </div>
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--ds-text-muted);font-weight:600;margin-bottom:4px">Primaire kleur</div>
            <div style="display:flex;align-items:center;gap:8px"><div style="width:20px;height:20px;border-radius:4px;background:${company.primary_color}"></div> ${escHtml(company.primary_color)}</div>
          </div>
        </div>

        <div>
          <div style="font-size:11px;text-transform:uppercase;color:var(--ds-text-muted);font-weight:600;margin-bottom:8px">Pipeline Stappen</div>
          <div class="ds-pipeline">
            ${pipeline.map(s => `<span class="ds-pipeline-stage" style="background:${s.color};color:#fff">${escHtml(s.label)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#comp-activate')?.addEventListener('click', () => {
    store.set('activeCompanyId', company.id);
    toast(`Actieve workspace: ${company.name}`);
    updateSidebarCompany();
    renderCompanyDetail(id, container);
  });

  container.querySelector('#comp-edit').addEventListener('click', () => {
    renderCompanyForm(company, container);
  });
}

function renderCompanyForm(company, container) {
  const isNew = !company;

  container.innerHTML = `
    <div class="ds-content-inner" style="max-width:640px">
      <div style="margin-bottom:16px">
        <a href="#/companies${company ? '/' + company.id : ''}" class="ds-btn ds-btn-ghost ds-btn-sm">← Terug</a>
      </div>
      <div class="ds-card">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px">${isNew ? 'Nieuw bedrijf' : 'Bedrijf bewerken'}</h2>
        <form id="comp-form">
          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">Bedrijfsnaam *</label>
              <input type="text" name="name" class="ds-input" required value="${escHtml(company?.name || '')}">
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">Slug *</label>
              <input type="text" name="slug" class="ds-input" required value="${escHtml(company?.slug || '')}">
            </div>
          </div>
          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">E-mail</label>
              <input type="email" name="email" class="ds-input" value="${escHtml(company?.email || '')}">
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">Telefoon</label>
              <input type="tel" name="phone" class="ds-input" value="${escHtml(company?.phone || '')}">
            </div>
          </div>
          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">Primaire kleur</label>
              <input type="color" name="primary_color" class="ds-input" value="${company?.primary_color || '#6366f1'}" style="height:40px;padding:4px">
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">BTW tarief (%)</label>
              <input type="number" name="btw_rate" class="ds-input" value="${company?.btw_rate ?? 21}" min="0" max="100">
            </div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
            ${!isNew ? '<button type="button" class="ds-btn ds-btn-danger ds-btn-sm" id="comp-delete">Verwijderen</button>' : ''}
            <button type="submit" class="ds-btn ds-btn-primary">${isNew ? 'Bedrijf aanmaken' : 'Opslaan'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  container.querySelector('#comp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.btw_rate = parseInt(data.btw_rate) || 21;
    data.btw_enabled = true;

    if (isNew) {
      data.pipeline_stages = JSON.stringify([
        { key: 'Nieuw', label: 'Nieuw', color: '#6366f1' },
        { key: 'Gecontacteerd', label: 'Gecontacteerd', color: '#3b82f6' },
        { key: 'Offerte verzonden', label: 'Offerte verzonden', color: '#f59e0b' },
        { key: 'Gewonnen', label: 'Gewonnen', color: '#10b981' },
        { key: 'Verloren', label: 'Verloren', color: '#ef4444' },
      ]);
      const created = companies.create(data);
      toast('Bedrijf aangemaakt');
      router.navigate(`companies/${created.id}`);
    } else {
      companies.update(company.id, data);
      toast('Bedrijf bijgewerkt');
      router.navigate(`companies/${company.id}`);
    }
  });

  container.querySelector('#comp-delete')?.addEventListener('click', () => {
    if (confirm('Dit bedrijf verwijderen? Gekoppelde leads worden ook verwijderd.')) {
      // Cascade delete leads (migrated from CompanyRepository.deleteWithCascade)
      leads.findBy('company_id', company.id).forEach(l => leads.delete(l.id));
      companies.delete(company.id);
      if (store.get('activeCompanyId') === company.id) {
        const remaining = companies.getAll();
        store.set('activeCompanyId', remaining[0]?.id || 1);
      }
      toast('Bedrijf verwijderd');
      router.navigate('companies');
    }
  });
}

/** Update the sidebar company switcher display */
function updateSidebarCompany() {
  const company = companies.getById(store.get('activeCompanyId'));
  const nameEl = document.querySelector('.ds-company-name');
  const avatarEl = document.querySelector('.ds-company-avatar');
  if (nameEl && company) nameEl.textContent = company.name;
  if (avatarEl && company) {
    avatarEl.textContent = (company.name || '?')[0];
    avatarEl.style.background = `linear-gradient(135deg, ${company.primary_color || '#f59e0b'}, ${company.secondary_color || company.primary_color || '#f97316'})`;
  }
}
