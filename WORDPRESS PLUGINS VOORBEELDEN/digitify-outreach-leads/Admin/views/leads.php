<?php if (!defined('ABSPATH')) exit; ?>
<div class="dol-wrap" id="dol-leads">
  <div class="dol-header">
    <div>
      <h1>Leads</h1>
      <p class="dol-muted">Beheer leads, tags, status en stuur manuele mails met templates.</p>
    </div>
    <div class="dol-actions">
      <label class="dol-upload">
        <input type="file" id="dolCsv" accept=".csv">
        <span class="button">CSV import</span>
      </label>
      <button class="button button-primary" id="dolNewLead">Nieuwe lead</button>
    </div>
  </div>

  <div class="dol-card">
    <div class="dol-toolbar">
      <input class="dol-input" id="dolSearch" placeholder="Zoek op naam of e-mail…">
      <select class="dol-input" id="dolStatusFilter">
        <option value="">Alle statussen</option>
        <option value="nieuw">Nieuw</option>
        <option value="gecontacteerd">Gecontacteerd</option>
        <option value="wacht_op_antwoord">Wacht op antwoord</option>
        <option value="gereageerd">Gereageerd</option>
        <option value="gesloten">Gesloten</option>
      </select>
      <input class="dol-input" id="dolTagFilter" placeholder="Filter op tag…">
    </div>

    <div class="dol-table-wrap">
      <table class="dol-table" id="dolLeadsTable">
        <thead>
          <tr>
            <th>Naam</th>
            <th>E-mail</th>
            <th>Status</th>
            <th>Tags</th>
            <th>Contact</th>
            <th>Laatst</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="7" class="dol-muted">Laden…</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="dol-modal" id="dolLeadModal" aria-hidden="true">
    <div class="dol-modal-backdrop"></div>
    <div class="dol-modal-card">
      <div class="dol-modal-head">
        <div>
          <h2 id="dolLeadModalTitle">Lead</h2>
          <div class="dol-muted" id="dolLeadModalSubtitle"></div>
        </div>
        <button class="dol-icon-btn" data-dol-close>&times;</button>
      </div>

      <div class="dol-modal-body">
        <div class="dol-form-grid">
          <div>
            <label>Naam</label>
            <input class="dol-input" id="dolName" placeholder="Naam">
          </div>
          <div>
            <label>E-mail <span class="dol-required">*</span></label>
            <input class="dol-input" id="dolEmail" placeholder="email@bedrijf.be">
          </div>
          <div>
            <label>Telefoon</label>
            <input class="dol-input" id="dolPhone" placeholder="+32 …">
          </div>
          <div>
            <label>Status</label>
            <select class="dol-input" id="dolStatus">
              <option value="nieuw">Nieuw</option>
              <option value="gecontacteerd">Gecontacteerd</option>
              <option value="wacht_op_antwoord">Wacht op antwoord</option>
              <option value="gereageerd">Gereageerd</option>
              <option value="gesloten">Gesloten</option>
            </select>
          </div>
          <div class="dol-colspan">
            <label>Tags (comma separated)</label>
            <input class="dol-input" id="dolTags" placeholder="bv. review, warm, follow-up">
          </div>
        </div>

        <div class="dol-divider"></div>

        <div class="dol-mail">
          <div class="dol-mail-head">
            <h3>Manuele mail</h3>
            <div class="dol-muted">Kies template, schrijf je boodschap, verzend. Tracking + CRM-log inbegrepen.</div>
          </div>

          <div class="dol-form-grid">
            <div class="dol-colspan">
              <label>Template</label>
              <select class="dol-input" id="dolTemplate"></select>
            </div>
            <div class="dol-colspan">
              <label>Boodschap</label>
              <textarea class="dol-input" id="dolMessage" rows="5" placeholder="Schrijf je boodschap…"></textarea>
            </div>
            <div class="dol-colspan">
              <label>CTA URL</label>
              <input class="dol-input" id="dolCtaUrl" placeholder="https://…">
            </div>
          </div>

          <div class="dol-mail-actions">
            <button class="button" id="dolPreview">Preview</button>
            <button class="button button-primary" id="dolSend">Verstuur mail</button>
          </div>
        </div>

        <div class="dol-divider"></div>

        <div>
          <h3>Timeline</h3>
          <div id="dolTimeline" class="dol-timeline"><div class="dol-muted">Laden…</div></div>
        </div>
      </div>

      <div class="dol-modal-foot">
        <button class="button" data-dol-close>Sluiten</button>
        <button class="button button-primary" id="dolSaveLead">Opslaan</button>
      </div>
    </div>
  </div>

  <div class="dol-modal" id="dolPreviewModal" aria-hidden="true">
    <div class="dol-modal-backdrop"></div>
    <div class="dol-modal-card dol-modal-card-wide">
      <div class="dol-modal-head">
        <div>
          <h2>Preview</h2>
          <div class="dol-muted">Zo ziet je mail eruit.</div>
        </div>
        <button class="dol-icon-btn" data-dol-close>&times;</button>
      </div>
      <div class="dol-modal-body">
        <iframe id="dolPreviewFrame" style="width:100%;height:70vh;border:1px solid #e2e8f0;border-radius:12px;background:#fff;"></iframe>
      </div>
      <div class="dol-modal-foot">
        <button class="button" data-dol-close>Sluiten</button>
      </div>
    </div>
  </div>
</div>
