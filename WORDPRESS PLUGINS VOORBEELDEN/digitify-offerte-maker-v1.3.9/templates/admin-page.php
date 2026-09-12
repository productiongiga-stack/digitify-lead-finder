<?php
/**
 * Template: Admin – Offertes Beheren
 * Included from digitify_render_admin_page()
 */
defined('ABSPATH') || exit;
?>
<div class="wrap digitify-admin-wrap">

<!-- ── TOPBAR ─────────────────────────────────────────── -->
<div class="da-topbar">
  <div class="da-topbar-left">
    <div class="da-topbar-logo">
      <img id="admin-logo" alt="Digitify" style="width:100%;height:100%;object-fit:contain;"/>
    </div>
    <span class="da-topbar-name">Digitify</span>
    <span class="da-topbar-sep">·</span>
    <span class="da-topbar-page">Admin</span>
    <span class="da-topbar-badge">Offertes</span>
  </div>
  <div class="da-topbar-right">
    <button class="da-btn-top danger" onclick="confirmClearAll()">
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Alles wissen
    </button>
    <a href="<?php echo esc_url(admin_url('admin.php?page=digitify-offerte')); ?>" class="da-btn-top">
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Nieuwe Offerte
    </a>
  </div>
</div>

<!-- ── MAIN ───────────────────────────────────────────── -->
<div class="da-main">

  <!-- Stats -->
  <div class="da-stats-row">
    <div class="da-stat-card">
      <div class="da-stat-icon">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M5 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 2v5h4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
      </div>
      <div class="da-stat-content">
        <div class="da-stat-label">Totaal offertes</div>
        <div class="da-stat-value" id="stat-count">—</div>
        <div class="da-stat-sub">opgeslagen</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon orange">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v4l2.5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </div>
      <div class="da-stat-content">
        <div class="da-stat-label">Totale waarde</div>
        <div class="da-stat-value orange" id="stat-total">—</div>
        <div class="da-stat-sub">incl. BTW</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon green">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="da-stat-content">
        <div class="da-stat-label">Aanvaard</div>
        <div class="da-stat-value green" id="stat-aanvaard">—</div>
        <div class="da-stat-sub">bevestigd</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon red">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <div class="da-stat-content">
        <div class="da-stat-label">Geweigerd</div>
        <div class="da-stat-value red" id="stat-geweigerd">—</div>
        <div class="da-stat-sub">afgewezen</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon purple">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 14h12M6 10h8M8 6h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </div>
      <div class="da-stat-content">
        <div class="da-stat-label">Gem. offertewaarde</div>
        <div class="da-stat-value purple" id="stat-avg">—</div>
        <div class="da-stat-sub">per offerte</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon teal">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 3v7l4 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.6"/></svg>
      </div>
      <div class="da-stat-content">
        <div class="da-stat-label">Open opvolging</div>
        <div class="da-stat-value teal" id="stat-open">—</div>
        <div class="da-stat-sub">geen status / opvolgen / voorstel</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon blue">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M6 2v3M14 2v3M3 8h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/></svg>
      </div>
      <div class="da-stat-content">
        <div class="da-stat-label">Deze maand</div>
        <div class="da-stat-value blue" id="stat-month">—</div>
        <div class="da-stat-sub">nieuwe offertes</div>
      </div>
    </div>
    <div class="da-stat-card">
      <div class="da-stat-icon blue">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.4 5.4L18 8.6l-4 4 .9 5.4L10 15.5l-4.9 2.5.9-5.4-4-4 5.6-.8L10 2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
      </div>
      <div class="da-stat-content">
        <div class="da-stat-label">Laatste offerte</div>
        <div class="da-stat-value" id="stat-latest" style="font-size:1rem;line-height:1.3">—</div>
      </div>
    </div>
  </div>

  <!-- Search & Filter bar -->
  <div class="da-filter-bar">
    <div class="da-search-wrap">
      <svg class="da-search-icon" width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8"/><path d="M13.5 13.5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <input type="text" id="da-search-input" class="da-search-input" placeholder="Zoek op naam, bedrijf, ref, e-mail…" oninput="onSearchInput(this.value)"/>
    </div>
    <div class="da-filter-wrap">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <select id="da-month-filter" class="da-filter-select" onchange="onMonthFilter(this.value)">
        <option value="">Alle maanden</option>
      </select>
    </div>
    <div class="da-filter-wrap">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M10 7v3l2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <select id="da-status-filter" class="da-filter-select" onchange="onStatusFilter(this.value)">
        <option value="">Alle statussen</option>
        <option value="aanvaard">✓ Aanvaard</option>
        <option value="geweigerd">✕ Geweigerd</option>
        <option value="opvolgen">⏳ Opvolgen</option>
        <option value="voorstel">📝 Voorstel</option>
        <option value="geen">Geen status</option>
      </select>
    </div>
    <button class="da-btn-filter-reset" id="da-filter-reset" onclick="resetFilters()" style="display:none">
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Wis filters
    </button>
    <span class="da-filter-count" id="da-filter-count"></span>
  </div>

  <!-- Quote list header -->
  <div class="da-section-header">
    <span class="da-section-title">Ingediende offertes</span>
    <span class="da-section-count" id="list-count"></span>
  </div>

  <!-- Quote list -->
  <div id="quote-list"></div>

</div><!-- /da-main -->

<!-- ── EDIT MODAL ─────────────────────────────────────── -->
<div class="da-modal-overlay" id="edit-modal">
  <div class="da-modal">
    <div class="da-modal-head">
      <h3>Offerte bewerken &nbsp;<span id="edit-ref-label" style="color:#ffaf51"></span></h3>
      <button class="da-modal-close" onclick="closeEditModal()">✕</button>
    </div>
    <div class="da-modal-body">
      <p class="da-edit-section-title">Klantgegevens</p>
      <div class="da-edit-grid">
        <div class="da-edit-field"><label>Voornaam &amp; naam</label><input type="text" id="edit-name"/></div>
        <div class="da-edit-field"><label>Bedrijf</label><input type="text" id="edit-bedrijf"/></div>
        <div class="da-edit-field"><label>E-mail</label><input type="email" id="edit-email"/></div>
        <div class="da-edit-field"><label>Telefoon</label><input type="tel" id="edit-telefoon"/></div>
        <div class="da-edit-field"><label>Adres</label><input type="text" id="edit-adres"/></div>
        <div class="da-edit-field"><label>BTW-nummer</label><input type="text" id="edit-btw"/></div>
      </div>
      <p class="da-edit-section-title">Offerte</p>
      <div class="da-edit-grid">
        <div class="da-edit-field"><label>Geldig tot</label><input type="text" id="edit-expdate"/></div>
        <div class="da-edit-field"><label>Totaal incl. BTW (€)</label><input type="number" id="edit-total" step="0.01"/></div>
      </div>
      <p class="da-edit-section-title">Interne notitie</p>
      <div class="da-edit-grid da-full">
        <div class="da-edit-field"><label>Notitie (intern, niet zichtbaar in PDF)</label><textarea id="edit-note" rows="3" placeholder="Bijzonderheden, opvolging, afspraken…"></textarea></div>
      </div>
    </div>
    <div class="da-modal-foot">
      <button class="da-btn-cancel" onclick="closeEditModal()">Annuleren</button>
      <button class="da-btn-save" onclick="saveEdit()">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Opslaan
      </button>
    </div>
  </div>
</div>

<!-- ── MAIL KLANT MODAL ───────────────────────────────── -->
<div class="da-modal-overlay" id="mail-modal">
  <div class="da-modal da-modal-white da-modal-xl">
    <div class="da-modal-head da-modal-head-white">
      <div class="da-mail-modal-title">
        <div class="da-mail-modal-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 0l8 7 8-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div>
          <h3>Mail Klant</h3>
          <span id="mail-modal-type-label" class="da-mail-modal-badge"></span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="da-btn-preview-mail" id="mail-preview-btn" onclick="previewMail()" title="Voorbeeld van de e-mail bekijken">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" stroke-width="1.7"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>
          Voorbeeld
        </button>
        <button class="da-modal-close da-modal-close-light" onclick="closeMailModal()">✕</button>
      </div>
    </div>
    <div class="da-modal-body">

      <!-- Template kiezen -->
      <div class="da-edit-field">
        <label>Mailtemplate</label>
        <div class="da-mail-tpl-row">
          <button type="button" class="da-tpl-btn" data-tpl="offerte" onclick="setMailTemplate('offerte',this)">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 2h8l4 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 2v5h4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            Offerte
          </button>
          <button type="button" class="da-tpl-btn" data-tpl="factuur" onclick="setMailTemplate('factuur',this)">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Factuur
          </button>
          <button type="button" class="da-tpl-btn" data-tpl="voorstel" onclick="setMailTemplate('voorstel',this)">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.6"/><path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Voorstel
          </button>
          <button type="button" class="da-tpl-btn" data-tpl="voorschot" onclick="setMailTemplate('voorschot',this)">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v4l2.5 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            Voorschotfactuur
          </button>
          <button type="button" class="da-tpl-btn active" data-tpl="geen" onclick="setMailTemplate('geen',this)">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 0l8 7 8-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Alleen bericht
          </button>
        </div>
      </div>

      <!-- Voorschot % (alleen zichtbaar bij voorschotfactuur) -->
      <div id="mail-voorschot-row" class="da-edit-field" style="margin-top:10px;display:none">
        <label>Voorschot percentage <span style="font-weight:400;color:#999">(% van totaal)</span></label>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="number" id="mail-voorschot-pct" value="50" min="1" max="100" step="1"
                 style="width:90px;padding:7px 10px;border:1.5px solid var(--dg-grey-20);border-radius:8px;font-size:.84rem;"/>
          <span style="font-size:.8rem;color:var(--dg-grey-40);">%</span>
        </div>
      </div>

      <!-- Aan -->
      <div class="da-edit-field" style="margin-top:12px">
        <label>E-mailadres ontvanger</label>
        <input type="email" id="mail-to-input" placeholder="klant@bedrijf.be"/>
      </div>

      <!-- Onderwerp -->
      <div class="da-edit-field" style="margin-top:10px">
        <label>Onderwerp</label>
        <input type="text" id="mail-subject-input" placeholder="Onderwerp van de e-mail…"/>
      </div>

      <!-- Bericht -->
      <div class="da-edit-field" style="margin-top:10px">
        <label>Uw bericht <span style="font-weight:400;color:#999">(optioneel)</span></label>
        <textarea id="mail-msg-input" rows="6"
                  placeholder="Schrijf hier uw bericht aan de klant…"
                  style="width:100%;resize:vertical;min-height:130px;box-sizing:border-box"></textarea>
      </div>

      <!-- Bijlage (optioneel – voor alle templates) -->
      <div id="mail-attachment-row" class="da-edit-field" style="margin-top:10px;display:block">
        <label>Bijlage toevoegen <span style="font-weight:400;color:#999">(optioneel – PDF, afbeelding of document, max 5 MB)</span></label>
        <div class="da-file-upload-wrap">
          <input type="file" id="mail-attachment"
                 accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                 onchange="onAttachmentChange(this)"/>
          <div class="da-file-upload-display" id="mail-attachment-display">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M6 9l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span>Klik om een bestand te kiezen</span>
          </div>
        </div>
      </div>

    </div>
    <div class="da-modal-foot">
      <button class="da-btn-cancel" onclick="closeMailModal()">Annuleren</button>
      <button class="da-btn-save" id="mail-send-btn" onclick="doSendMail()">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M3 10l14-7-7 14v-7L3 10z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Versturen
      </button>
    </div>
  </div>
</div>

<!-- ── MAIL PREVIEW MODAL ────────────────────────────── -->
<div class="da-modal-overlay" id="mail-preview-modal">
  <div class="da-modal da-modal-white da-modal-preview">
    <div class="da-modal-head da-modal-head-white">
      <h3>E-mail voorbeeld</h3>
      <button class="da-modal-close da-modal-close-light" onclick="closeMailPreview()">✕</button>
    </div>
    <div class="da-modal-body da-modal-preview-body">
      <iframe id="mail-preview-iframe" frameborder="0" style="width:100%;height:100%;min-height:520px;border-radius:8px;border:1px solid var(--dg-grey-20)"></iframe>
    </div>
    <div class="da-modal-foot">
      <button class="da-btn-cancel" onclick="closeMailPreview()">Sluiten</button>
    </div>
  </div>
</div>

<!-- ── CONFIRM OVERLAY ────────────────────────────────── -->
<div class="da-confirm-overlay" id="confirm-overlay">
  <div class="da-confirm-box">
    <h3 id="confirm-title">Bevestig actie</h3>
    <p id="confirm-msg"></p>
    <div class="da-confirm-btns">
      <button class="da-btn-confirm-no" onclick="closeConfirm()">Annuleren</button>
      <button class="da-btn-confirm-yes" id="confirm-yes-btn">Verwijderen</button>
    </div>
  </div>
</div>

<!-- ── TOAST ──────────────────────────────────────────── -->
<div class="da-admin-toast" id="admin-toast"></div>

</div><!-- /wrap -->
