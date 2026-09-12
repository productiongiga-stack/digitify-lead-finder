<?php
/**
 * Template: Instellingen
 * Included from digitify_render_settings_page()
 */
defined('ABSPATH') || exit;
$ver = DIGITIFY_OFFERTE_VER;
?>
<div class="wrap digitify-settings-wrap">

<!-- ── TOPBAR ─────────────────────────────────────────── -->
<div class="da-topbar">
  <div class="da-topbar-left">
    <div class="da-topbar-logo">
      <img id="settings-logo" alt="Digitify" style="width:100%;height:100%;object-fit:contain;"/>
    </div>
    <span class="da-topbar-name">Digitify</span>
    <span class="da-topbar-sep">·</span>
    <span class="da-topbar-page">Admin</span>
    <span class="da-topbar-badge">Instellingen</span>
  </div>
  <div class="da-topbar-right">
    <a href="<?php echo esc_url(admin_url('admin.php?page=digitify-offertes-admin')); ?>" class="da-btn-top">
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Offertes Beheren
    </a>
    <a href="<?php echo esc_url(admin_url('admin.php?page=digitify-offerte')); ?>" class="da-btn-top">
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Nieuwe Offerte
    </a>
  </div>
</div>

<!-- ── PLUGIN STATUS STRIP ───────────────────────────── -->
<div class="ds-status-strip">
  <div class="ds-status-item">
    <span class="ds-status-dot ok"></span>
    <span class="ds-status-text">Plugin actief</span>
    <span class="ds-status-val">v<?php echo esc_html($ver); ?></span>
  </div>
  <div class="ds-status-sep"></div>
  <div class="ds-status-item">
    <span class="ds-status-dot" id="ss-db-dot"></span>
    <span class="ds-status-text">Database</span>
    <span class="ds-status-val" id="ss-db-val">—</span>
  </div>
  <div class="ds-status-sep"></div>
  <div class="ds-status-item">
    <span class="ds-status-dot" id="ss-smtp-dot"></span>
    <span class="ds-status-text">SMTP</span>
    <span class="ds-status-val" id="ss-smtp-val">Niet geconfigureerd</span>
  </div>
  <div class="ds-status-sep"></div>
  <div class="ds-status-item">
    <span class="ds-status-dot ok"></span>
    <span class="ds-status-text">jsPDF</span>
    <span class="ds-status-val">v2.5.1</span>
  </div>
</div>

<!-- ── SIDEBAR LAYOUT ─────────────────────────────────── -->
<div class="ds-layout">

  <!-- Sidebar navigatie -->
  <nav class="ds-sidebar">
    <div class="ds-sidebar-group">
      <div class="ds-sidebar-group-label">Bedrijf</div>
      <button class="ds-nav-item active" data-tab="bedrijf" onclick="switchTab('bedrijf',this)">
        <div class="ds-nav-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M3 17V8l7-5 7 5v9M8 17v-5h4v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span>Bedrijfsgegevens</span>
      </button>
    </div>

    <div class="ds-sidebar-group">
      <div class="ds-sidebar-group-label">Communicatie</div>
      <button class="ds-nav-item" data-tab="email" onclick="switchTab('email',this)">
        <div class="ds-nav-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 0l8 7 8-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span>E-mail &amp; SMTP</span>
        <span class="ds-nav-badge" id="smtp-tab-badge" style="display:none">!</span>
      </button>
    </div>

    <div class="ds-sidebar-group">
      <div class="ds-sidebar-group-label">Documenten</div>
      <button class="ds-nav-item" data-tab="factuur" onclick="switchTab('factuur',this)">
        <div class="ds-nav-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M6 2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm0 5h8M6 10h8M6 14h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </div>
        <span>Factuur &amp; Offerte</span>
      </button>
      <button class="ds-nav-item" data-tab="huisstijl" onclick="switchTab('huisstijl',this)">
        <div class="ds-nav-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v4M8 10h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </div>
        <span>Huisstijl &amp; PDF</span>
      </button>
    </div>

    <div class="ds-sidebar-group">
      <div class="ds-sidebar-group-label">Integratie</div>
      <button class="ds-nav-item" data-tab="embed" onclick="switchTab('embed',this)">
        <div class="ds-nav-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 7l-4 3 4 3M13 7l4 3-4 3M11 5l-2 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span>Embed &amp; Widget</span>
      </button>
      <button class="ds-nav-item" data-tab="systeem" onclick="switchTab('systeem',this)">
        <div class="ds-nav-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </div>
        <span>Systeem &amp; Debug</span>
      </button>
    </div>
  </nav>

  <!-- Content area -->
  <div class="ds-content">

<!-- ── TAB: BEDRIJFSGEGEVENS ─────────────────────────── -->
<div class="ds-tab-pane active" id="tab-bedrijf">
  <div class="ds-pane-header">
    <div class="ds-pane-icon">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 17V8l7-5 7 5v9M8 17v-5h4v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <h2 class="ds-pane-title">Bedrijfsgegevens</h2>
      <p class="ds-pane-sub">Wordt gebruikt in PDF-facturen, offertes en e-mails</p>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-grid">
      <div class="ds-field">
        <label>Bedrijfsnaam</label>
        <input type="text" id="company_name" placeholder="Digitify BV"/>
      </div>
      <div class="ds-field">
        <label>BTW-nummer</label>
        <input type="text" id="company_btw" placeholder="BE0742906469"/>
      </div>
      <div class="ds-field">
        <label>Adres</label>
        <input type="text" id="company_address" placeholder="Lokerende Steenweg 200A"/>
      </div>
      <div class="ds-field">
        <label>Stad / Postcode</label>
        <input type="text" id="company_city" placeholder="9080 Lochristi"/>
      </div>
      <div class="ds-field">
        <label>E-mailadres</label>
        <input type="email" id="company_email" placeholder="contact@digitify.be"/>
      </div>
      <div class="ds-field">
        <label>Telefoonnummer</label>
        <input type="tel" id="company_phone" placeholder="+32 (0) 465 83 72 64"/>
      </div>
      <div class="ds-field">
        <label>Website</label>
        <input type="text" id="company_website" placeholder="www.digitify.be"/>
      </div>
      <div class="ds-field">
        <label>IBAN <span>(bankrekening voor facturatie)</span></label>
        <input type="text" id="company_iban" placeholder="BE67 0682 2870 5104"/>
      </div>
    </div>
  </div>

  <div class="ds-save-bar">
    <button class="ds-btn-save" onclick="saveSettings()">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Instellingen opslaan
    </button>
    <span class="ds-save-status" id="settings-status"></span>
  </div>
</div><!-- /tab-bedrijf -->

<!-- ── TAB: E-MAIL & SMTP ─────────────────────────────── -->
<div class="ds-tab-pane" id="tab-email">
  <div class="ds-pane-header">
    <div class="ds-pane-icon">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 0l8 7 8-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <h2 class="ds-pane-title">E-mail &amp; SMTP</h2>
      <p class="ds-pane-sub">Afzender, meldingen en SMTP-configuratie</p>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-section-head">
      <div class="ds-section-icon">📬</div>
      <div>
        <div class="ds-section-title">Ontvangst &amp; Afzender</div>
        <div class="ds-section-sub">Configureer wie e-mails ontvangt en wie als afzender verschijnt</div>
      </div>
    </div>
    <div class="ds-grid">
      <div class="ds-field">
        <label>Offerte-meldingen sturen naar</label>
        <input type="email" id="notify_email" placeholder="contact@digitify.be"/>
        <div class="ds-field-hint">📥 Nieuwe offerte-meldingen komen hier binnen</div>
      </div>
      <div class="ds-field">
        <label>Afzendernaam e-mails</label>
        <input type="text" id="from_name" placeholder="Digitify Offerte Systeem"/>
      </div>
      <div class="ds-field">
        <label>Afzender e-mailadres</label>
        <input type="email" id="from_email" placeholder="contact@digitify.be"/>
        <div class="ds-field-hint">Moet overeenkomen met uw SMTP-account</div>
      </div>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-section-head">
      <div class="ds-section-icon">⚙️</div>
      <div>
        <div class="ds-section-title">SMTP Configuratie</div>
        <div class="ds-section-sub">Koppel uw eigen mailserver voor betrouwbare e-mailbezorging</div>
      </div>
      <span class="ds-smtp-status off" id="smtp-status-badge" style="margin-left:auto">Niet geconfigureerd</span>
    </div>

    <div class="ds-smtp-guide">
      <div class="ds-smtp-guide-item">
        <div class="ds-sg-icon">💡</div>
        <div>Gebruik een <strong>App-wachtwoord</strong> voor Gmail / Google Workspace, niet uw normale wachtwoord.</div>
      </div>
      <div class="ds-smtp-guide-item">
        <div class="ds-sg-icon">🔒</div>
        <div>Wachtwoord wordt <strong>versleuteld opgeslagen</strong> in de WordPress database.</div>
      </div>
    </div>

    <div class="ds-grid-3">
      <div class="ds-field">
        <label>SMTP-host</label>
        <input type="text" id="smtp_host" placeholder="smtp.gmail.com"/>
      </div>
      <div class="ds-field">
        <label>Poort</label>
        <input type="number" id="smtp_port" placeholder="587" min="1" max="65535"/>
      </div>
      <div class="ds-field">
        <label>Beveiliging</label>
        <select id="smtp_enc">
          <option value="tls">TLS (aanbevolen)</option>
          <option value="ssl">SSL</option>
          <option value="">Geen</option>
        </select>
      </div>
    </div>
    <div class="ds-grid" style="margin-top:14px">
      <div class="ds-field">
        <label>Gebruikersnaam</label>
        <input type="text" id="smtp_user" placeholder="uw@email.com"/>
      </div>
      <div class="ds-field">
        <label>Wachtwoord</label>
        <div class="ds-pw-wrap">
          <input type="password" id="smtp_pass" placeholder="••••••••" autocomplete="new-password"/>
          <button type="button" class="ds-pw-toggle" onclick="toggleSmtpPw(this)" title="Wachtwoord tonen/verbergen">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" stroke-width="1.7"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>
          </button>
        </div>
        <div class="ds-field-hint">Wordt versleuteld opgeslagen</div>
      </div>
    </div>

    <!-- Test SMTP -->
    <div class="ds-smtp-test-block">
      <div class="ds-smtp-test-title">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M3 10l14-7-7 14v-7L3 10z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Test SMTP-verbinding
      </div>
      <div class="ds-test-row">
        <input type="email" id="smtp-test-email" placeholder="test@uw-email.be"/>
        <button class="ds-btn-secondary" onclick="testSmtp()">
          Test e-mail versturen
        </button>
        <span id="smtp-test-result" style="display:none" class="ds-test-result"></span>
      </div>
    </div>
  </div>

  <div class="ds-save-bar">
    <button class="ds-btn-save" onclick="saveSettings()">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Instellingen opslaan
    </button>
    <span class="ds-save-status" id="settings-status-2"></span>
  </div>
</div><!-- /tab-email -->

<!-- ── TAB: FACTUUR & OFFERTE ─────────────────────────── -->
<div class="ds-tab-pane" id="tab-factuur">
  <div class="ds-pane-header">
    <div class="ds-pane-icon">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm0 5h8M6 10h8M6 14h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
    </div>
    <div>
      <h2 class="ds-pane-title">Factuur &amp; Offerte</h2>
      <p class="ds-pane-sub">Nummering, betaaltermijn en documentinstellingen</p>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-section-head">
      <div class="ds-section-icon">📄</div>
      <div>
        <div class="ds-section-title">Nummering</div>
        <div class="ds-section-sub">Prefix voor offerte- en factuurnummers</div>
      </div>
    </div>
    <div class="ds-grid-3">
      <div class="ds-field">
        <label>Offerte prefix</label>
        <input type="text" id="offerte_prefix" placeholder="OFF" maxlength="10"/>
        <div class="ds-field-hint">Bv. OFF → OFF-AB1234-2025</div>
      </div>
      <div class="ds-field">
        <label>Factuur prefix</label>
        <input type="text" id="invoice_prefix" placeholder="FACT" maxlength="10"/>
        <div class="ds-field-hint">Bv. FACT → FACT-AB1234-2025</div>
      </div>
      <div class="ds-field">
        <label>Standaard BTW %</label>
        <select id="default_btw">
          <option value="21">21% (standaard)</option>
          <option value="6">6% (verlaagd)</option>
          <option value="0">0% (BTW verlegd)</option>
        </select>
      </div>
      <div class="ds-field">
        <label>Prijzen verbergen in configurator</label>
        <label class="ds-switch-row">
          <input type="checkbox" id="hide_prices_ui"/>
          <span>Verberg prijslabels en totalen in de offerte-configurator, maar blijf alles intern berekenen.</span>
        </label>
        <div class="ds-field-hint">Ideaal wanneer u enkel een aanvraagflow wilt tonen zonder zichtbare prijsindicaties op de website.</div>
      </div>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-section-head">
      <div class="ds-section-icon">📅</div>
      <div>
        <div class="ds-section-title">Betaling</div>
        <div class="ds-section-sub">Standaard betaaltermijn en voettekst</div>
      </div>
    </div>
    <div class="ds-grid">
      <div class="ds-field">
        <label>Betaaltermijn <span>(dagen)</span></label>
        <div class="ds-field-with-unit">
          <input type="number" id="payment_days" placeholder="30" min="1" max="365"/>
          <span class="ds-field-unit">dagen</span>
        </div>
        <div class="ds-field-hint">Standaard: 30 dagen na factuurdatum</div>
      </div>
    </div>
    <div class="ds-grid ds-full" style="margin-top:14px">
      <div class="ds-field">
        <label>Voettekst factuur <span>(optioneel)</span></label>
        <textarea id="invoice_footer" rows="3" placeholder="Extra info die onderaan de factuur verschijnt, bv. bankgegevens, disclaimers…"></textarea>
      </div>
    </div>
  </div>

  <div class="ds-save-bar">
    <button class="ds-btn-save" onclick="saveSettings()">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Instellingen opslaan
    </button>
    <span class="ds-save-status" id="settings-status-3"></span>
  </div>
</div><!-- /tab-factuur -->

<!-- ── TAB: HUISSTIJL & PDF ───────────────────────────── -->
<div class="ds-tab-pane" id="tab-huisstijl">
  <div class="ds-pane-header">
    <div class="ds-pane-icon">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4h12v12H4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><path d="M4 14l4-4 3 3 2-2 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <h2 class="ds-pane-title">Huisstijl &amp; PDF</h2>
      <p class="ds-pane-sub">Accentkleur, logo en visuele instellingen</p>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-section-head">
      <div class="ds-section-icon">🎨</div>
      <div>
        <div class="ds-section-title">Accentkleur</div>
        <div class="ds-section-sub">Hoofdkleur voor knoppen, badges en PDF-accentlijn</div>
      </div>
    </div>
    <div class="ds-grid">
      <div class="ds-field">
        <label>Accentkleur</label>
        <div class="ds-color-field">
          <input type="color" id="accent_color_picker" value="#ffaf51" oninput="syncColorText(this.value)" style="width:42px;height:38px;padding:2px;border:1.5px solid var(--dg-grey-20);border-radius:8px;cursor:pointer;background:#fff"/>
          <input type="text" id="accent_color" placeholder="#ffaf51" maxlength="20" oninput="syncColorPicker(this.value)" style="flex:1"/>
        </div>
        <div class="ds-field-hint">Standaard: #ffaf51 (Digitify oranje). Slechts één kleur, geen gradient.</div>
      </div>
    </div>
  </div>

  <div class="ds-save-bar">
    <button class="ds-btn-save" onclick="saveSettings()">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Instellingen opslaan
    </button>
    <span class="ds-save-status" id="settings-status-4"></span>
  </div>
</div><!-- /tab-huisstijl -->

<!-- ── TAB: EMBED & WIDGET ────────────────────────────── -->
<div class="ds-tab-pane" id="tab-embed">
  <div class="ds-pane-header">
    <div class="ds-pane-icon">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 7l-4 3 4 3M13 7l4 3-4 3M11 5l-2 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <h2 class="ds-pane-title">Embed &amp; Widget</h2>
      <p class="ds-pane-sub">Plaats de offertecalculator op uw website</p>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-steps-list">
      <div class="ds-embed-step">
        <div class="ds-step-num">1</div>
        <div class="ds-step-text">Maak een nieuwe <strong>WordPress-pagina</strong> aan of open een bestaande pagina waar u de offertecalculator wilt plaatsen.</div>
      </div>
      <div class="ds-embed-step">
        <div class="ds-step-num">2</div>
        <div class="ds-step-text">Voeg een <strong>Shortcode-blok</strong> in en plak de shortcode hieronder:</div>
      </div>
    </div>
    <div class="ds-embed-codes">
      <div class="ds-embed-code-item">
        <div class="ds-embed-code-label">iframe-embed <span>(aanbevolen – volledig geïsoleerd)</span></div>
        <div class="ds-embed-code-row">
          <code class="ds-embed-code" id="sc-direct">[digitify_offerte height="900"]</code>
          <button class="ds-btn-copy" onclick="copyShortcode('sc-direct', this)" title="Kopiëren">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            Kopiëren
          </button>
        </div>
      </div>
      <div class="ds-embed-code-item">
        <div class="ds-embed-code-label">Inline embed <span>(zonder iframe)</span></div>
        <div class="ds-embed-code-row">
          <code class="ds-embed-code" id="sc-iframe">[digitify_offerte mode="inline"]</code>
          <button class="ds-btn-copy" onclick="copyShortcode('sc-iframe', this)" title="Kopiëren">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            Kopiëren
          </button>
        </div>
      </div>
    </div>
    <div class="ds-steps-list" style="margin-top:0">
      <div class="ds-embed-step">
        <div class="ds-step-num">3</div>
        <div class="ds-step-text"><strong>Publiceer</strong> de pagina. De offerte-configurator verschijnt automatisch.</div>
      </div>
      <div class="ds-embed-step">
        <div class="ds-step-num">4</div>
        <div class="ds-step-text">Ingediende offertes verschijnen in <strong>Offertes Beheren</strong>.</div>
      </div>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-section-head">
      <div class="ds-section-icon">🎨</div>
      <div>
        <div class="ds-section-title">Embed stijl</div>
        <div class="ds-section-sub">Achtergrondkleur voor de iframe-embed</div>
      </div>
    </div>
    <div class="ds-grid">
      <div class="ds-field">
        <label>Embed achtergrondkleur</label>
        <input type="text" id="embed_bg" placeholder="#121212"/>
        <div class="ds-field-hint">Tip: gebruik een hex-kleur zoals <strong>#121212</strong> of <strong>#ffffff</strong>.</div>
      </div>
    </div>
  </div>

  <div class="ds-save-bar">
    <button class="ds-btn-save" onclick="saveSettings()">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Instellingen opslaan
    </button>
    <span class="ds-save-status" id="settings-status-5"></span>
  </div>
</div><!-- /tab-embed -->

<!-- ── TAB: SYSTEEM & DEBUG ───────────────────────────── -->
<div class="ds-tab-pane" id="tab-systeem">
  <div class="ds-pane-header">
    <div class="ds-pane-icon">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
    </div>
    <div>
      <h2 class="ds-pane-title">Systeem &amp; Debug</h2>
      <p class="ds-pane-sub">Technische opties en systeeminformatie</p>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-section-head">
      <div class="ds-section-icon">🛠️</div>
      <div>
        <div class="ds-section-title">Geavanceerde opties</div>
        <div class="ds-section-sub">Debug logging en opslaglimieten</div>
      </div>
    </div>
    <div class="ds-grid">
      <div class="ds-field">
        <label>Debug logging</label>
        <div class="ds-toggle-field">
          <label class="ds-toggle">
            <input type="checkbox" id="debug_mode" value="1"/>
            <span class="ds-toggle-track">
              <span class="ds-toggle-thumb"></span>
            </span>
          </label>
          <span class="ds-toggle-lbl">Schrijf debug-berichten naar WordPress error log</span>
        </div>
        <div class="ds-field-hint">Logs zijn zichtbaar via <code>wp-content/debug.log</code> (vereist WP_DEBUG_LOG)</div>
      </div>
      <div class="ds-field">
        <label>Max. offertes opslaan</label>
        <div class="ds-field-with-unit">
          <input type="number" id="quote_limit" placeholder="200" min="50" max="1000"/>
          <span class="ds-field-unit">records</span>
        </div>
        <div class="ds-field-hint">Oudste offertes worden verwijderd als het maximum bereikt is (min. 50)</div>
      </div>
    </div>
  </div>

  <div class="ds-section">
    <div class="ds-section-head">
      <div class="ds-section-icon">⚙️</div>
      <div>
        <div class="ds-section-title">Systeeminformatie</div>
        <div class="ds-section-sub">Plugin- en configuratiedetails</div>
      </div>
    </div>
    <div class="ds-tech-grid">
      <div class="ds-tech-item">
        <div class="ds-tech-label">Plugin versie</div>
        <div class="ds-tech-val ds-tech-badge orange">v<?php echo esc_html($ver); ?></div>
      </div>
      <div class="ds-tech-item">
        <div class="ds-tech-label">PDF Bibliotheek</div>
        <div class="ds-tech-val ds-tech-badge blue">jsPDF v2.5.1</div>
      </div>
      <div class="ds-tech-item ds-tech-full">
        <div class="ds-tech-label">AJAX Endpoint</div>
        <div class="ds-tech-val mono"><?php echo esc_html(admin_url('admin-ajax.php')); ?></div>
      </div>
      <div class="ds-tech-item ds-tech-full">
        <div class="ds-tech-label">PDF Opslag</div>
        <div class="ds-tech-val mono"><?php echo esc_html(wp_upload_dir()['basedir'] . '/digitify-offerte/'); ?></div>
      </div>
    </div>
  </div>

  <div class="ds-save-bar">
    <button class="ds-btn-save" onclick="saveSettings()">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Instellingen opslaan
    </button>
    <span class="ds-save-status" id="settings-status-6"></span>
  </div>
</div><!-- /tab-systeem -->

  </div><!-- /ds-content -->
</div><!-- /ds-layout -->

<!-- ── TOAST ──────────────────────────────────────────── -->
<div class="da-admin-toast" id="settings-toast"></div>

</div><!-- /wrap -->
