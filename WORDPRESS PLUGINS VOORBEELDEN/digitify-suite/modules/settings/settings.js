/**
 * Digitify Suite — Settings Module
 *
 * Migrated from:
 * - digitify-offerte-maker: settings-wp.js, settings-page.php
 * - offerte-wizard-multicompany: SettingsPage.php, settings.php view
 * - digitify-outreach-leads: settings.php view (brand, SMTP)
 * - digitify-booking: booking admin settings (branding, availability)
 *
 * Unified settings page with tabs for all modules.
 * WordPress wp_options replaced by settings repository (localStorage).
 * Future: @API REST endpoints for settings management.
 */

import { settings, availability, companies } from '../../data/db.js';
import { escHtml, toast } from '../../core/utils.js';
import store from '../../core/store.js';

export function renderSettings(params, container) {
  const currentSettings = getSettings();
  const allAvailability = availability.getAll();
  const activeCompany = companies.getById(store.get('activeCompanyId'));
  const DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

  container.innerHTML = `
    <div class="ds-content-inner" style="max-width:800px">
      <h2 style="font-size:22px;font-weight:800;margin-bottom:24px">Instellingen</h2>

      <!-- Settings tabs -->
      <div class="ds-tabs" id="settings-tabs">
        <div class="ds-tab active" data-tab="general">Algemeen</div>
        <div class="ds-tab" data-tab="branding">Branding</div>
        <div class="ds-tab" data-tab="booking">Booking</div>
        <div class="ds-tab" data-tab="email">E-mail</div>
        <div class="ds-tab" data-tab="data">Data</div>
      </div>

      <!-- General Settings -->
      <div class="settings-panel" id="panel-general">
        <div class="ds-card">
          <div class="ds-card-title" style="margin-bottom:16px">Algemene instellingen</div>
          <form id="settings-general-form">
            <div class="ds-form-row">
              <div class="ds-form-group">
                <label class="ds-form-label">Bedrijfsnaam</label>
                <input type="text" name="brand_name" class="ds-input" value="${escHtml(currentSettings.brand_name || 'Digitify')}">
              </div>
              <div class="ds-form-group">
                <label class="ds-form-label">Taal</label>
                <select name="language" class="ds-select">
                  <option value="nl" ${currentSettings.language === 'nl' ? 'selected' : ''}>Nederlands</option>
                  <option value="fr" ${currentSettings.language === 'fr' ? 'selected' : ''}>Frans</option>
                  <option value="en" ${currentSettings.language === 'en' ? 'selected' : ''}>Engels</option>
                </select>
              </div>
            </div>
            <div class="ds-form-row">
              <div class="ds-form-group">
                <label class="ds-form-label">Tijdzone</label>
                <select name="timezone" class="ds-select">
                  <option value="Europe/Brussels" ${currentSettings.timezone === 'Europe/Brussels' ? 'selected' : ''}>Europe/Brussels</option>
                  <option value="Europe/Amsterdam" ${currentSettings.timezone === 'Europe/Amsterdam' ? 'selected' : ''}>Europe/Amsterdam</option>
                  <option value="Europe/Paris" ${currentSettings.timezone === 'Europe/Paris' ? 'selected' : ''}>Europe/Paris</option>
                  <option value="Europe/London" ${currentSettings.timezone === 'Europe/London' ? 'selected' : ''}>Europe/London</option>
                </select>
              </div>
              <div class="ds-form-group">
                <label class="ds-form-label">Datumformaat</label>
                <select name="date_format" class="ds-select">
                  <option value="dd/MM/yyyy" ${currentSettings.date_format === 'dd/MM/yyyy' ? 'selected' : ''}>dd/MM/yyyy</option>
                  <option value="MM/dd/yyyy" ${currentSettings.date_format === 'MM/dd/yyyy' ? 'selected' : ''}>MM/dd/yyyy</option>
                  <option value="yyyy-MM-dd" ${currentSettings.date_format === 'yyyy-MM-dd' ? 'selected' : ''}>yyyy-MM-dd</option>
                </select>
              </div>
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">Thema</label>
              <div style="display:flex;gap:8px">
                <button type="button" class="ds-btn ${store.get('theme') !== 'dark' ? 'ds-btn-primary' : 'ds-btn-secondary'} ds-btn-sm theme-btn" data-theme="light">☀️ Licht</button>
                <button type="button" class="ds-btn ${store.get('theme') === 'dark' ? 'ds-btn-primary' : 'ds-btn-secondary'} ds-btn-sm theme-btn" data-theme="dark">🌙 Donker</button>
              </div>
            </div>
            <button type="submit" class="ds-btn ds-btn-primary" style="margin-top:8px">Opslaan</button>
          </form>
        </div>
      </div>

      <!-- Branding Settings -->
      <div class="settings-panel" id="panel-branding" style="display:none">
        <div class="ds-card">
          <div class="ds-card-title" style="margin-bottom:16px">Branding</div>
          <p style="font-size:13px;color:var(--ds-text-muted);margin-bottom:16px">
            Branding-instellingen worden per bedrijf/workspace beheerd.
            Huidig actief: <strong>${escHtml(activeCompany?.name || 'Onbekend')}</strong>
          </p>
          <div class="ds-form-row">
            <div class="ds-form-group">
              <label class="ds-form-label">Primaire kleur</label>
              <input type="color" class="ds-input" value="${activeCompany?.primary_color || '#6366f1'}" style="height:40px" disabled>
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">Logo URL</label>
              <input type="text" class="ds-input" value="${escHtml(activeCompany?.logo_url || '')}" placeholder="https://..." disabled>
            </div>
          </div>
          <a href="#/companies/${activeCompany?.id || ''}" class="ds-btn ds-btn-secondary ds-btn-sm" style="margin-top:8px">→ Bedrijfsinstellingen bewerken</a>
        </div>
      </div>

      <!-- Booking Settings -->
      <div class="settings-panel" id="panel-booking" style="display:none">
        <div class="ds-card">
          <div class="ds-card-title" style="margin-bottom:16px">Beschikbaarheid (Booking)</div>
          <p style="font-size:13px;color:var(--ds-text-muted);margin-bottom:16px">
            Stel je beschikbare uren in per weekdag. Boekingen worden alleen aangeboden binnen deze tijdsvensters.
          </p>
          <div id="avail-list">
            ${[1, 2, 3, 4, 5, 6, 0].map(dow => {
              const slot = allAvailability.find(a => a.day_of_week === dow);
              return `
                <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--ds-border-light)" data-dow="${dow}">
                  <label style="width:100px;font-weight:600;font-size:13px">${DAYS[dow]}</label>
                  <label style="display:flex;align-items:center;gap:4px;font-size:13px">
                    <input type="checkbox" class="avail-active" ${slot?.active ? 'checked' : ''}>
                    Actief
                  </label>
                  <input type="time" class="ds-input avail-start" value="${slot?.start_time || '09:00'}" style="width:120px">
                  <span style="color:var(--ds-text-muted)">tot</span>
                  <input type="time" class="ds-input avail-end" value="${slot?.end_time || '17:00'}" style="width:120px">
                </div>
              `;
            }).join('')}
          </div>
          <button class="ds-btn ds-btn-primary ds-btn-sm" style="margin-top:16px" id="save-availability">Beschikbaarheid opslaan</button>
        </div>
      </div>

      <!-- Email Settings -->
      <div class="settings-panel" id="panel-email" style="display:none">
        <div class="ds-card">
          <div class="ds-card-title" style="margin-bottom:16px">E-mail instellingen</div>
          <form id="settings-email-form">
            <div class="ds-form-row">
              <div class="ds-form-group">
                <label class="ds-form-label">Afzendernaam</label>
                <input type="text" name="from_name" class="ds-input" value="${escHtml(currentSettings.from_name || 'Digitify')}">
              </div>
              <div class="ds-form-group">
                <label class="ds-form-label">Afzender e-mail</label>
                <input type="email" name="from_email" class="ds-input" value="${escHtml(currentSettings.from_email || '')}">
              </div>
            </div>
            <div class="ds-form-group">
              <label class="ds-form-label">Notificatie e-mail</label>
              <input type="email" name="notification_email" class="ds-input" value="${escHtml(currentSettings.notification_email || '')}">
              <span style="font-size:11px;color:var(--ds-text-muted)">Ontvang notificaties voor nieuwe boekingen en leads.</span>
            </div>
            <div style="margin-top:12px;padding:12px;background:var(--ds-bg);border-radius:var(--ds-radius-md);font-size:12px;color:var(--ds-text-muted)">
              ℹ️ SMTP-instellingen per bedrijf worden beheerd in het bedrijvenoverzicht.
              <!-- @API: In productie wordt e-mail verzonden via backend SMTP service -->
            </div>
            <button type="submit" class="ds-btn ds-btn-primary" style="margin-top:12px">Opslaan</button>
          </form>
        </div>
      </div>

      <!-- Data Management -->
      <div class="settings-panel" id="panel-data" style="display:none">
        <div class="ds-card">
          <div class="ds-card-title" style="margin-bottom:16px">Data beheer</div>
          <p style="font-size:13px;color:var(--ds-text-muted);margin-bottom:16px">
            Alle data wordt momenteel opgeslagen in je browser (localStorage).
            In een productieomgeving wordt dit vervangen door een database.
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="ds-btn ds-btn-secondary ds-btn-sm" id="export-data">📥 Data exporteren (JSON)</button>
            <button class="ds-btn ds-btn-secondary ds-btn-sm" id="import-data">📤 Data importeren</button>
            <button class="ds-btn ds-btn-danger ds-btn-sm" id="reset-data">🗑️ Alle data resetten</button>
          </div>
          <input type="file" id="import-file" accept=".json" style="display:none">
        </div>
      </div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('#settings-tabs .ds-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('#settings-tabs .ds-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      container.querySelectorAll('.settings-panel').forEach(p => p.style.display = 'none');
      container.querySelector(`#panel-${tab.dataset.tab}`).style.display = '';
    });
  });

  // Theme toggle
  container.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.set('theme', btn.dataset.theme);
      document.documentElement.setAttribute('data-theme', btn.dataset.theme);
      container.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('ds-btn-primary'));
      container.querySelectorAll('.theme-btn').forEach(b => b.classList.add('ds-btn-secondary'));
      btn.classList.remove('ds-btn-secondary');
      btn.classList.add('ds-btn-primary');
      toast(`Thema: ${btn.dataset.theme}`);
    });
  });

  // General settings save
  container.querySelector('#settings-general-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    saveSettings(data);
    toast('Instellingen opgeslagen');
  });

  // Email settings save
  container.querySelector('#settings-email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    saveSettings(data);
    toast('E-mail instellingen opgeslagen');
  });

  // Availability save
  container.querySelector('#save-availability')?.addEventListener('click', () => {
    container.querySelectorAll('#avail-list > div').forEach(row => {
      const dow = Number(row.dataset.dow);
      const active = row.querySelector('.avail-active').checked;
      const start = row.querySelector('.avail-start').value;
      const end = row.querySelector('.avail-end').value;

      const existing = availability.findOneBy('day_of_week', dow);
      if (existing) {
        availability.update(existing.id, { active, start_time: start, end_time: end });
      } else {
        availability.create({ day_of_week: dow, start_time: start, end_time: end, active });
      }
    });
    toast('Beschikbaarheid opgeslagen');
  });

  // Data export
  container.querySelector('#export-data').addEventListener('click', () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('ds_') || key === 'digitify_suite_state') {
        data[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digitify-suite-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data geëxporteerd');
  });

  // Data import
  container.querySelector('#import-data').addEventListener('click', () => {
    container.querySelector('#import-file').click();
  });
  container.querySelector('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, value));
        toast('Data geïmporteerd. Pagina wordt herladen...');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        toast('Import mislukt: ongeldig JSON bestand');
      }
    };
    reader.readAsText(file);
  });

  // Reset data
  container.querySelector('#reset-data').addEventListener('click', () => {
    if (confirm('ALLE data verwijderen? Dit kan niet ongedaan worden.')) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('ds_') || key === 'digitify_suite_state') {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      toast('Data gereset. Pagina wordt herladen...');
      setTimeout(() => location.reload(), 1000);
    }
  });
}

function getSettings() {
  const settingsRecord = settings.findOneBy('key', 'general');
  if (settingsRecord && settingsRecord.value) {
    try { return JSON.parse(settingsRecord.value); } catch { return {}; }
  }
  return {};
}

function saveSettings(partial) {
  const current = getSettings();
  const merged = { ...current, ...partial };
  const existing = settings.findOneBy('key', 'general');
  if (existing) {
    settings.update(existing.id, { value: JSON.stringify(merged) });
  } else {
    settings.create({ key: 'general', value: JSON.stringify(merged) });
  }
}
