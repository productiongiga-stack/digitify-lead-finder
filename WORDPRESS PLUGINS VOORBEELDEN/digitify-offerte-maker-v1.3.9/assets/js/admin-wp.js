/* ═══════════════════════════════════════════════════════
   Digitify – Admin WP (offertes beheren)
   Leest quotes van digitifyAdmin.quotes (PHP-gelokaliseerd)
   Bewerken / verwijderen / Offerte downloaden (client-side PDF) / factuur maken
════════════════════════════════════════════════════════ */
'use strict';

// ── HELPERS ─────────────────────────────────────────────
const f2 = v => parseFloat(v||0).toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2});
const fE = v => `€ ${f2(v)}`;
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;'); }

function showToast(msg) {
  const t = document.getElementById('admin-toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 2800);
}

// Quotes komen van PHP via wp_localize_script (digitifyAdmin.quotes)
let QUOTES = [];
try { QUOTES = (window.digitifyAdmin && Array.isArray(window.digitifyAdmin.quotes)) ? window.digitifyAdmin.quotes : []; } catch(e) { QUOTES = []; }

// ── FILTER STATE ─────────────────────────────────────────
let _filterQ = '';
let _filterMonth = '';
let _filterStatus = '';

// ── INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Logo via LOGO_B64 (logo-b64.js)
  const img = document.getElementById('admin-logo');
  if (img && typeof LOGO_B64 !== 'undefined') img.src = LOGO_B64;

  // Vul maand-filter dropdown met beschikbare maanden
  buildMonthFilter();
  render();

  // Overlay backdrop sluit modals
  document.getElementById('confirm-overlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeConfirm(); });
  document.getElementById('edit-modal')?.addEventListener('click',    e => { if (e.target === e.currentTarget) closeEditModal(); });
  document.getElementById('mail-modal')?.addEventListener('click',    e => { if (e.target === e.currentTarget) closeMailModal(); });
  document.getElementById('mail-preview-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeMailPreview(); });

  // Placeholders (kopieer naar klembord)
  document.querySelectorAll('.da-ph').forEach(btn => {
    btn.addEventListener('click', () => {
      const ph = btn.getAttribute('data-ph') || btn.textContent || '';
      copyToClipboard(ph);
    });
  });
});

function copyToClipboard(text) {
  const t = String(text || '').trim();
  if (!t) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => showToast('✓ Gekopieerd: ' + t)).catch(() => fallbackCopy(t));
  } else {
    fallbackCopy(t);
  }
}

function fallbackCopy(t) {
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('✓ Gekopieerd: ' + t); } catch(e) { showToast('⚠️ Kopiëren mislukt'); }
  document.body.removeChild(ta);
}

// ── RENDER ──────────────────────────────────────────────
function render() {
  updateStats(QUOTES);
  renderList(getFilteredQuotes());
}

function getFilteredQuotes() {
  let res = QUOTES;
  if (_filterQ) {
    const q = _filterQ.toLowerCase();
    res = res.filter(quote => {
      const c = quote.client || {};
      return (quote.ref||'').toLowerCase().includes(q)
          || (c.name||'').toLowerCase().includes(q)
          || (c.bedrijf||'').toLowerCase().includes(q)
          || (c.email||'').toLowerCase().includes(q);
    });
  }
  if (_filterMonth) {
    res = res.filter(quote => (quote.date||'').startsWith(_filterMonth) || (quote.savedAt||'').startsWith(_filterMonth));
  }
  if (_filterStatus) {
    if (_filterStatus === 'geen') {
      res = res.filter(q => !q.status || q.status === '');
    } else {
      res = res.filter(q => q.status === _filterStatus);
    }
  }
  return res;
}

// ── SEARCH & FILTER ─────────────────────────────────────
function onSearchInput(val) {
  _filterQ = val.trim();
  updateFilterUI();
  renderList(getFilteredQuotes());
}
function onMonthFilter(val) {
  _filterMonth = val;
  updateFilterUI();
  renderList(getFilteredQuotes());
}
function onStatusFilter(val) {
  _filterStatus = val;
  updateFilterUI();
  renderList(getFilteredQuotes());
}
function resetFilters() {
  _filterQ = ''; _filterMonth = ''; _filterStatus = '';
  const si = document.getElementById('da-search-input');
  const mf = document.getElementById('da-month-filter');
  const sf = document.getElementById('da-status-filter');
  if (si) si.value = '';
  if (mf) mf.value = '';
  if (sf) sf.value = '';
  updateFilterUI();
  renderList(getFilteredQuotes());
}
function updateFilterUI() {
  const hasFilter = _filterQ || _filterMonth || _filterStatus;
  const resetBtn = document.getElementById('da-filter-reset');
  const countEl  = document.getElementById('da-filter-count');
  if (resetBtn) resetBtn.style.display = hasFilter ? 'inline-flex' : 'none';
  const filtered = getFilteredQuotes();
  if (countEl) countEl.textContent = hasFilter ? `${filtered.length} resultaat${filtered.length!==1?'en':''}` : '';
}

function buildMonthFilter() {
  const sel = document.getElementById('da-month-filter');
  if (!sel || !QUOTES.length) return;
  const months = new Set();
  QUOTES.forEach(q => {
    // savedAt is MySQL datetime: "2025-01-15 10:30:00"
    const raw = q.savedAt || q.date || '';
    const m = raw.substring(0,7); // "2025-01"
    if (m && m.length === 7) months.add(m);
  });
  // Sort descending
  const sorted = Array.from(months).sort().reverse();
  sorted.forEach(m => {
    const [yr, mo] = m.split('-');
    const label = new Date(`${yr}-${mo}-01`).toLocaleDateString('nl-BE',{month:'long',year:'numeric'});
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = label.charAt(0).toUpperCase()+label.slice(1);
    sel.appendChild(opt);
  });
}

function updateStats(quotes) {
  const countEl     = document.getElementById('stat-count');
  const totalEl     = document.getElementById('stat-total');
  const aanvaardEl  = document.getElementById('stat-aanvaard');
  const geweigerdEl = document.getElementById('stat-geweigerd');
  const avgEl       = document.getElementById('stat-avg');
  const openEl      = document.getElementById('stat-open');
  const monthEl     = document.getElementById('stat-month');
  const latestEl    = document.getElementById('stat-latest');
  const countLbl    = document.getElementById('list-count');

  if (countEl) countEl.textContent = quotes.length || '0';
  const total = quotes.reduce((s,q)=>s+(parseFloat(q.grandTotal)||0),0);
  if (totalEl) totalEl.textContent = quotes.length ? fE(total) : '—';

  const aanvaard  = quotes.filter(q => q.status === 'aanvaard').length;
  const geweigerd = quotes.filter(q => q.status === 'geweigerd').length;
  const open      = quotes.filter(q => !q.status || q.status === '' || q.status === 'opvolgen' || q.status === 'voorstel').length;
  const avg       = quotes.length ? total / quotes.length : 0;
  const thisMonth = new Date().toISOString().slice(0,7);
  const monthCount = quotes.filter(q => String(q.savedAt || q.date || '').slice(0,7) === thisMonth).length;

  if (aanvaardEl)  aanvaardEl.textContent  = quotes.length ? String(aanvaard)  : '—';
  if (geweigerdEl) geweigerdEl.textContent = quotes.length ? String(geweigerd) : '—';
  if (avgEl)       avgEl.textContent       = quotes.length ? fE(avg) : '—';
  if (openEl)      openEl.textContent      = quotes.length ? String(open) : '—';
  if (monthEl)     monthEl.textContent     = quotes.length ? String(monthCount) : '—';

  const latest = quotes[0];
  if (latestEl) latestEl.innerHTML = latest ? `<strong>${esc(latest.ref||'—')}</strong><br><small style="color:#777">${esc(latest.date||'')}</small>` : '—';
  const filtered = getFilteredQuotes();
  if (countLbl) countLbl.textContent = filtered.length ? `${filtered.length} record${filtered.length!==1?'s':''}` : '';
}

function renderList(quotes) {
  const el = document.getElementById('quote-list');
  if (!el) return;
  // Update count label to show filtered count
  const countLbl = document.getElementById('list-count');
  if (countLbl) countLbl.textContent = quotes.length ? `${quotes.length} record${quotes.length!==1?'s':''}` : '';
  if (!quotes.length) {
    el.innerHTML = `<div class="da-empty-state"><div class="da-empty-icon">📋</div><div class="da-empty-title">${_filterQ||_filterMonth?'Geen resultaten gevonden':'Geen offertes gevonden'}</div><div class="da-empty-sub">${_filterQ||_filterMonth?'Pas uw zoekopdracht of filter aan.':'Offertes die via de configurator worden verstuurd, verschijnen hier automatisch.'}</div></div>`;
    return;
  }
  // Find QUOTES index for each filtered quote (needed for edit/delete by idx)
  el.innerHTML = quotes.map((q)=>{
    const realIdx = QUOTES.indexOf(q);
    return quoteCard(q, realIdx);
  }).join('');
}

function quoteCard(q, idx) {
  const c = q.client || {};
  const name = c.bedrijf || c.name || '—';
  const items = q.items || [];
  const rows = items.map(it=>`<tr><td class="svc-name">${esc(it.prodLabel||'—')}</td><td>${esc(it.catLabel||'—')}</td><td>${fE(it.excl)}</td><td>${fE(it.btwAmt)}</td><td>${fE(it.total)}</td></tr>`).join('');
  const note = q.note ? `<div style="background:rgba(255,175,81,.06);border:1px solid rgba(255,175,81,.15);border-radius:8px;padding:10px 12px;font-size:.78rem;color:#aaa;margin-bottom:12px;"><strong style="color:#ffaf51;font-size:.7rem;text-transform:uppercase;letter-spacing:.5px">Notitie</strong><br>${esc(q.note)}</div>` : '';

  // Status helpers
  const st = q.status || '';
  const stClass = st === 'aanvaard' ? 'qa-dot-aanvaard' : st === 'geweigerd' ? 'qa-dot-geweigerd' : st === 'opvolgen' ? 'qa-dot-opvolgen' : st === 'voorstel' ? 'da-qa-dot-voorstel' : 'qa-dot-none';
  const stTitle = st === 'aanvaard' ? 'Aanvaard' : st === 'geweigerd' ? 'Geweigerd' : st === 'opvolgen' ? 'Opvolgen' : st === 'voorstel' ? 'Voorstel' : 'Geen status';

  return `<div class="da-quote-card" id="qcard-${idx}">
    <!-- ── Kaartkop ──────────────────────────────────────── -->
    <div class="da-quote-card-header" onclick="toggleCard(${idx})">
      <div class="da-qa-status-dot ${stClass}" title="${stTitle}" style="margin-bottom:0;flex-shrink:0"></div>
      <span class="da-quote-ref-badge">${esc(q.ref||'REF')}</span>
      <div class="da-quote-meta">
        <div class="da-quote-client">${esc(name)}</div>
        <div class="da-quote-sub">${esc(q.date||'')}${c.email?' · '+esc(c.email):''}</div>
      </div>
      ${st ? `<span class="da-status-badge da-status-${st}">${st==='aanvaard'?'✓ Aanvaard':st==='geweigerd'?'✕ Geweigerd':st==='opvolgen'?'⏳ Opvolgen':'📝 Voorstel'}</span>` : ''}
      <div class="da-sent-badges">
        ${q.offerte_verstuurd ? `<span class="da-sent-badge da-sent-offerte" title="Offerte verstuurd"><svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Offerte</span>` : ''}
        ${q.voorstel_verstuurd ? `<span class="da-sent-badge da-sent-voorstel" title="Voorstel verstuurd"><svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Voorstel</span>` : ''}
        ${q.voorschot_verstuurd ? `<span class="da-sent-badge da-sent-voorschot" title="Voorschotfactuur verstuurd"><svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Voorschot</span>` : ''}
        ${q.factuur_verstuurd ? `<span class="da-sent-badge da-sent-factuur" title="Factuur verstuurd"><svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Factuur</span>` : ''}
      </div>
      <span class="da-quote-total">${fE(q.grandTotal)}</span>
      <svg class="da-quote-chevron" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>

    <div class="da-quote-body">
      <!-- Status & verzend-sectie -->
      <div class="da-status-section">
        <div class="da-status-pills-row">
          <span class="da-status-section-lbl">Status:</span>
          <button class="da-status-pill ${st==='aanvaard'?'active aanvaard':''}" onclick="updateStatus(${idx},'status','aanvaard')">✓ Aanvaard</button>
          <button class="da-status-pill ${st==='geweigerd'?'active geweigerd':''}" onclick="updateStatus(${idx},'status','geweigerd')">✕ Geweigerd</button>
          <button class="da-status-pill ${st==='opvolgen'?'active opvolgen':''}" onclick="updateStatus(${idx},'status','opvolgen')">⏳ Opvolgen</button>
          <button class="da-status-pill ${st==='voorstel'?'active voorstel':''}" onclick="updateStatus(${idx},'status','voorstel')">📝 Voorstel</button>
          ${st ? `<button class="da-status-pill reset" onclick="updateStatus(${idx},'status','')">× Wis status</button>` : ''}
        </div>
        <div class="da-verstuurd-row">
          <span class="da-status-section-lbl">Verzonden:</span>
          <label class="da-toggle-verstuurd type-offerte ${q.offerte_verstuurd?'is-checked':''}" onclick="event.stopPropagation()">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 0l8 7 8-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="da-toggle-lbl">Offerte verstuurd</span>
            <input type="checkbox" class="da-toggle-input" ${q.offerte_verstuurd?'checked':''} onchange="updateStatus(${idx},'offerte_verstuurd',this.checked)">
            <span class="da-toggle-slider"></span>
          </label>
          <label class="da-toggle-verstuurd type-voorstel ${q.voorstel_verstuurd?'is-checked':''}" onclick="event.stopPropagation()">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.8"/><path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            <span class="da-toggle-lbl">Voorstel verstuurd</span>
            <input type="checkbox" class="da-toggle-input" ${q.voorstel_verstuurd?'checked':''} onchange="updateStatus(${idx},'voorstel_verstuurd',this.checked)">
            <span class="da-toggle-slider"></span>
          </label>
          <label class="da-toggle-verstuurd type-factuur ${q.factuur_verstuurd?'is-checked':''}" onclick="event.stopPropagation()">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            <span class="da-toggle-lbl">Factuur verstuurd</span>
            <input type="checkbox" class="da-toggle-input" ${q.factuur_verstuurd?'checked':''} onchange="updateStatus(${idx},'factuur_verstuurd',this.checked)">
            <span class="da-toggle-slider"></span>
          </label>
          <label class="da-toggle-verstuurd type-voorschot ${q.voorschot_verstuurd?'is-checked':''}" onclick="event.stopPropagation()">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M10 3v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6 11h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            <span class="da-toggle-lbl">Voorschotfactuur verstuurd</span>
            <input type="checkbox" class="da-toggle-input" ${q.voorschot_verstuurd?'checked':''} onchange="updateStatus(${idx},'voorschot_verstuurd',this.checked)">
            <span class="da-toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="da-detail-grid">
        <div><div class="da-detail-label">Naam</div><div class="da-detail-value">${esc(c.name||'—')}</div></div>
        <div><div class="da-detail-label">Bedrijf</div><div class="da-detail-value">${esc(c.bedrijf||'—')}</div></div>
        <div><div class="da-detail-label">E-mail</div><div class="da-detail-value">${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:'—'}</div></div>
        <div><div class="da-detail-label">Telefoon</div><div class="da-detail-value">${esc(c.telefoon||'—')}</div></div>
        <div><div class="da-detail-label">BTW</div><div class="da-detail-value">${esc(c.btw||'—')}</div></div>
        <div><div class="da-detail-label">Geldig tot</div><div class="da-detail-value">${esc(q.expDate||'—')}</div></div>
        <div><div class="da-detail-label">Opgeslagen op</div><div class="da-detail-value">${esc(q.savedAt||'—')}</div></div>
      </div>
      ${note}
      <div class="da-services-table-wrap">
      <table class="da-services-table">
        <thead><tr><th>Dienst</th><th>Categorie</th><th>Excl. BTW</th><th>BTW</th><th>Totaal</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="5" style="color:#777;padding:10px">—</td></tr>'}</tbody>
        <tfoot><tr class="da-tfoot-row"><td colspan="4">Totaal incl. BTW</td><td>${fE(q.grandTotal)}</td></tr></tfoot>
      </table>
      </div>
      <div class="da-quote-actions">
        <button class="da-btn-duplicate" onclick="duplicateQuote(${idx})"><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="11" rx="1.5" stroke="currentColor" stroke-width="1.7"/><path d="M3 13V5a2 2 0 012-2h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg> Dupliceren</button>
        <button class="da-btn-email-action" onclick="openMailModal(${idx},'offerte')"><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm0 0l8 7 8-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg> Mail Klant</button>
        <button class="da-btn-pdf-dl" onclick="downloadQuotePdf(${idx})"><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 16h12M10 4v9m-4-4l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg> Offerte PDF</button>
        <button class="da-btn-invoice" onclick="downloadInvoicePdf(${idx})"><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 16h12M10 4v9m-4-4l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg> Factuur PDF</button>
        <button class="da-btn-invoice da-btn-voorschot" onclick="generateVoorschotfactuur(${idx})"><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 8h12M6 12h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg> Voorschotfactuur</button>
        <button class="da-btn-edit-q" onclick="editInConfigurator(${idx})"><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M14.5 2.5l3 3L6 17H3v-3L14.5 2.5z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg> Bewerken</button>
        <button class="da-btn-del-q" onclick="confirmDelete(${idx})"><svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Wissen</button>
      </div>
    </div>
</div>`;
}

// ── TOGGLE CARD ──────────────────────────────────────────
function toggleCard(idx) { document.getElementById('qcard-'+idx)?.classList.toggle('open'); }

// ── DROPDOWN QUICK ACTIONS ───────────────────────────────
function _closeAllQaDropdowns() {
  document.querySelectorAll('.da-qa-dropdown-wrap.open').forEach(w => {
    w.classList.remove('open');
    const card = w.closest('.da-quote-card');
    if (card) card.style.removeProperty('z-index');
  });
}
function toggleQaDropdown(btn) {
  const wrap = btn.closest('.da-qa-dropdown-wrap');
  if (!wrap) return;
  const card = btn.closest('.da-quote-card');
  const isOpen = wrap.classList.contains('open');
  // Sluit alle open dropdowns + reset z-index
  _closeAllQaDropdowns();
  if (!isOpen) {
    wrap.classList.add('open');
    // Breng de kaart naar voor zodat de dropdown boven andere kaarten verschijnt
    if (card) card.style.zIndex = '9999';
  }
}
function closeQaDropdown(el) {
  const wrap = el.closest('.da-qa-dropdown-wrap');
  if (!wrap) return;
  wrap.classList.remove('open');
  const card = wrap.closest('.da-quote-card');
  if (card) card.style.removeProperty('z-index');
}
// Klik buiten sluit dropdown
document.addEventListener('click', e => {
  if (!e.target.closest('.da-qa-dropdown-wrap')) {
    _closeAllQaDropdowns();
  }
});

// ── PDF DOWNLOADEN ────────────────────────────────────────
function downloadPdf(idx) {
  const q = QUOTES[idx];
  if (!q) return;
  showToast('⏳ PDF ophalen…');
  jQuery.post(window.digitifyAdmin.ajaxUrl, {
    action: 'digitify_download_pdf',
    nonce:  window.digitifyAdmin.nonce,
    ref:    q.ref,
  }, function(response) {
    if (response.success && response.data.pdfB64) {
      const link = document.createElement('a');
      link.href = 'data:application/pdf;base64,' + response.data.pdfB64;
      link.download = `Offerte_${q.ref}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ PDF gedownload');
    } else {
      showToast('⚠️ PDF niet beschikbaar');
    }
  }).fail(function() { showToast('⚠️ Verbindingsfout'); });
}

// ── FACTUUR MAKEN (jsPDF) ─────────────────────────────────
function generateInvoice(idx) {
  const q = QUOTES[idx];
  if (!q) return;
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    alert('jsPDF niet geladen. Herlaad de pagina en probeer opnieuw.'); return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const c = q.client || {};

  const C = {
    black:[17,17,17], orange:[255,175,81], white:[255,255,255],
    grey:[100,100,100], lgrey:[220,220,220], vlgrey:[245,245,245],
    green:[16,163,74], blue:[37,99,235],
  };

  const now   = new Date();
  const invNr = `FACT-${q.ref||Date.now().toString().slice(-6)}`;
  const dateStr = (q.date||now.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'}));
  const dueDate = (() => {
    const d = new Date(now); d.setDate(d.getDate()+30);
    return d.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'});
  })();
  const clientDisplay = c.bedrijf || c.name || 'Klant';

  // ── HEADER ─────────────────────────────────────────────
  doc.setFillColor(...C.black); doc.rect(0,0,W,24,'F');
  doc.setFillColor(...C.orange); doc.rect(0,0,5,24,'F');
  doc.setFillColor(22,22,22); doc.rect(W-60,0,60,24,'F');

  try { if(typeof LOGO_B64!=='undefined') doc.addImage(LOGO_B64,'PNG',8,6,12,12); } catch(e){}
  doc.setTextColor(...C.white); doc.setFontSize(11); doc.setFont(undefined,'bold');
  doc.text('DIGITIFY',24,12);
  doc.setFontSize(6.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.orange);
  doc.text('Partner in Digital Solutions',24,17);

  doc.setFontSize(18); doc.setFont(undefined,'bold'); doc.setTextColor(...C.orange);
  doc.text('FACTUUR',W-8,13,{align:'right'});
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(180,180,180);
  doc.text(invNr,W-8,18.5,{align:'right'});

  doc.setFillColor(...C.orange); doc.rect(5,24,W-5,0.6,'F');

  // ── INFO KAARTJES ───────────────────────────────────────
  let y = 32;
  const hw = (W-28)/2;
  const S = window.digitifyAdmin?.settings || {};

  // Kaart links: KLANTGEGEVENS
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,hw,48,3,3,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(10,y,hw,9,3,3,'F');
  doc.rect(10,y+5,hw,4,'F');
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text('KLANTGEGEVENS',10+hw/2,y+7,{align:'center'});
  let ky = y+16;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text(clientDisplay,15,ky); ky+=5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  if(c.name && c.name!==c.bedrijf) { doc.text(c.name,15,ky); ky+=4; }
  if(c.adres)    { doc.text(c.adres,15,ky); ky+=4; }
  if(c.email)    { doc.setTextColor(...C.blue); doc.text(c.email,15,ky); ky+=4; doc.setTextColor(...C.grey); }
  if(c.telefoon) { doc.text(c.telefoon,15,ky); ky+=4; }
  if(c.btw)      { doc.text(`BTW: ${c.btw}`,15,ky); }

  // Kaart rechts: ONZE GEGEVENS (company info uit instellingen)
  const dx = 10+hw+8;
  const companyName    = S.company_name    || 'Digitify BV';
  const companyBtw     = S.company_btw     || 'BE0742906469';
  const companyAddress = S.company_address || '';
  const companyCity    = S.company_city    || '';
  const companyEmail   = S.company_email   || 'contact@digitify.be';
  const companyPhone   = S.company_phone   || '';
  const companyIban    = S.company_iban    || '';

  doc.setFillColor(...C.vlgrey); doc.roundedRect(dx,y,hw,48,3,3,'F');
  doc.setFillColor(30,30,30);    doc.roundedRect(dx,y,hw,9,3,3,'F');
  doc.rect(dx,y+5,hw,4,'F');
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
  doc.text('ONZE GEGEVENS',dx+hw/2,y+7,{align:'center'});
  let oy = y+16;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text(companyName, dx+4, oy); oy+=5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  if(companyAddress)  { doc.text(companyAddress, dx+4, oy); oy+=4; }
  if(companyCity)     { doc.text(companyCity,    dx+4, oy); oy+=4; }
  if(companyEmail)    { doc.setTextColor(...C.blue); doc.text(companyEmail, dx+4, oy); oy+=4; doc.setTextColor(...C.grey); }
  if(companyPhone)    { doc.text(companyPhone, dx+4, oy); oy+=4; }
  if(companyBtw)      { doc.text(`BTW: ${companyBtw}`, dx+4, oy); oy+=4; }
  if(companyIban)     { doc.text(`IBAN: ${companyIban}`, dx+4, oy); }

  y += 56;

  // ── FACTUURDETAILS BALK ──────────────────────────────
  const bdH = 14;
  doc.setFillColor(22,22,22); doc.roundedRect(10, y, W-20, bdH, 2, 2, 'F');
  const bdCols = [
    { lbl:'Factuurnummer', val: invNr },
    { lbl:'Factuurdatum',  val: dateStr },
    { lbl:'Vervaldatum',   val: dueDate },
    { lbl:'Referentie',    val: q.ref||'—' },
  ];
  const colW = (W-20) / bdCols.length;
  bdCols.forEach((col, i) => {
    const cx = 10 + i * colW + colW / 2;
    doc.setFontSize(5.5); doc.setFont(undefined,'normal'); doc.setTextColor(130,130,130);
    doc.text(col.lbl.toUpperCase(), cx, y+4.5, {align:'center'});
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
    doc.text(col.val, cx, y+10.5, {align:'center'});
  });

  y += bdH + 8;

  // ── DIENSTEN TABEL ──────────────────────────────────────
  const items = q.items || [];
  const tableBody = items.map(it => [
    it.prodLabel||'—',
    it.catLabel||'—',
    `€ ${f2(it.excl)}`,
    `€ ${f2(it.btwAmt)}`,
    `€ ${f2(it.total)}`,
  ]);

  const grandExcl = items.reduce((s,it)=>s+(parseFloat(it.excl)||0),0);
  const grandBtw  = items.reduce((s,it)=>s+(parseFloat(it.btwAmt)||0),0);
  const grandTot  = parseFloat(q.grandTotal)||0;

  doc.autoTable({
    startY: y,
    head: [['Omschrijving','Categorie','Excl. BTW','BTW','Totaal']],
    body: tableBody,
    foot: [
      [{ content:'Subtotaal excl. BTW', colSpan:4, styles:{halign:'right',fontStyle:'bold',fillColor:[28,28,28],textColor:C.white,fontSize:8} },
       { content:`€ ${f2(grandExcl)}`, styles:{halign:'right',fontStyle:'bold',fillColor:[28,28,28],textColor:C.white,fontSize:8} }],
      [{ content:`BTW`, colSpan:4, styles:{halign:'right',fillColor:[22,22,22],textColor:[150,150,150],fontSize:7.5} },
       { content:`€ ${f2(grandBtw)}`, styles:{halign:'right',fillColor:[22,22,22],textColor:[150,150,150],fontSize:7.5} }],
      [{ content:'TOTAAL INCL. BTW', colSpan:4, styles:{halign:'right',fontStyle:'bold',fillColor:C.orange,textColor:C.black,fontSize:11} },
       { content:`€ ${f2(grandTot)}`, styles:{halign:'right',fontStyle:'bold',fillColor:C.orange,textColor:C.black,fontSize:11} }],
    ],
    theme: 'striped',
    headStyles: { fillColor:C.orange, textColor:C.black, fontStyle:'bold', fontSize:8 },
    footStyles: { fontSize:8 },
    styles: { fontSize:8, cellPadding:{top:3,bottom:3,left:5,right:5} },
    columnStyles: {
      0:{cellWidth:'auto'}, 1:{cellWidth:36}, 2:{cellWidth:28,halign:'right'}, 3:{cellWidth:22,halign:'right'}, 4:{cellWidth:28,halign:'right'},
    },
    margin:{ left:10, right:10, bottom:18 },
  });

  const afterY = doc.lastAutoTable.finalY + 10;

  // ── BETALINGSINFO ───────────────────────────────────────
  if (afterY < H - 40) {
    const payIban    = companyIban    || 'BE67 0682 2870 5104';
    const payName    = companyName    || 'Digitify BV';
    const payDays    = S.payment_days ? parseInt(S.payment_days) : 30;
    doc.setFillColor(232,252,240); doc.roundedRect(10,afterY,W-20,22,3,3,'F');
    doc.setFillColor(...C.green); doc.roundedRect(10,afterY,3,22,1.5,1.5,'F');
    doc.rect(11.5,afterY,1.5,22,'F');
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(16,110,55);
    doc.text('Betalingsinformatie',17,afterY+7);
    doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(30,100,50);
    doc.text(`Gelieve het bedrag van €${f2(grandTot)} te storten op rekening ${payIban} (${payName})`,17,afterY+13);
    doc.text(`met mededeling: ${invNr} · Betaaltermijn: ${payDays} dagen · Vervaldatum: ${dueDate}`,17,afterY+18.5);
  }

  // ── FOOTER ─────────────────────────────────────────────
  const footerParts = [companyEmail, companyPhone, S.company_website||'www.digitify.be', `BTW: ${companyBtw}`].filter(Boolean);
  doc.setFillColor(...C.black); doc.rect(0,H-10,W,10,'F');
  doc.setFillColor(...C.orange); doc.rect(0,H-10,4,10,'F');
  doc.setTextColor(140,140,140); doc.setFontSize(6.5);
  doc.text(footerParts.join(' · '),W/2,H-4.5,{align:'center'});

  doc.save(`Factuur_${invNr}.pdf`);
  showToast('✓ Factuur gedownload');
}

// ── BEWERKEN IN CONFIGURATOR ─────────────────────────────
function editInConfigurator(idx) {
  const q = QUOTES[idx];
  if (!q) return;
  // Sla volledige quote op in sessionStorage
  try {
    sessionStorage.setItem('digitify_edit_quote', JSON.stringify({
      idx:        idx,
      ref:        q.ref,
      client:     q.client || {},
      cartItems:  q.cartItems || [],
      items:      q.items || [],
    }));
  } catch(e) { console.warn('sessionStorage niet beschikbaar:', e); }
  // Redirect naar configurator met edit-parameter
  const configUrl = window.digitifyAdmin.configUrl || '';
  window.location.href = configUrl + (configUrl.includes('?') ? '&' : '?') + 'digitify_edit=1&edit_ref=' + encodeURIComponent(q.ref||'');
}

// ── EDIT MODAL (snel bewerken klantdata) ─────────────────
let _editIdx = null;
function openEditModal(idx) {
  const q = QUOTES[idx]; if (!q) return;
  _editIdx = idx;
  const c = q.client || {};
  document.getElementById('edit-ref-label').textContent = q.ref || '';
  document.getElementById('edit-name').value     = c.name     || '';
  document.getElementById('edit-bedrijf').value  = c.bedrijf  || '';
  document.getElementById('edit-email').value    = c.email    || '';
  document.getElementById('edit-telefoon').value = c.telefoon || '';
  document.getElementById('edit-adres').value    = c.adres    || '';
  document.getElementById('edit-btw').value      = c.btw      || '';
  document.getElementById('edit-expdate').value  = q.expDate  || '';
  document.getElementById('edit-total').value    = q.grandTotal || 0;
  document.getElementById('edit-note').value     = q.note     || '';
  document.getElementById('edit-modal').classList.add('active');
}
function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('active');
  _editIdx = null;
}
function saveEdit() {
  if (_editIdx === null) return;
  const data = {
    client: {
      name:     document.getElementById('edit-name').value.trim(),
      bedrijf:  document.getElementById('edit-bedrijf').value.trim(),
      email:    document.getElementById('edit-email').value.trim(),
      telefoon: document.getElementById('edit-telefoon').value.trim(),
      adres:    document.getElementById('edit-adres').value.trim(),
      btw:      document.getElementById('edit-btw').value.trim(),
    },
    expDate:    document.getElementById('edit-expdate').value.trim(),
    grandTotal: parseFloat(document.getElementById('edit-total').value) || 0,
    note:       document.getElementById('edit-note').value.trim(),
  };

  const saveBtn = document.querySelector('.da-btn-save');
  if (saveBtn) saveBtn.disabled = true;

  jQuery.post(window.digitifyAdmin.ajaxUrl, {
    action: 'digitify_update_quote',
    nonce:  window.digitifyAdmin.nonce,
    idx:    _editIdx,
    data:   JSON.stringify(data),
  }, function(response) {
    if (saveBtn) saveBtn.disabled = false;
    if (response.success) {
      if (!QUOTES[_editIdx]) return;
      QUOTES[_editIdx].client     = { ...QUOTES[_editIdx].client, ...data.client };
      QUOTES[_editIdx].expDate    = data.expDate;
      QUOTES[_editIdx].grandTotal = data.grandTotal;
      QUOTES[_editIdx].note       = data.note;
      closeEditModal();
      render();
      showToast('✓ Offerte opgeslagen');
    } else {
      alert('Fout: ' + (response.data?.msg || 'Onbekende fout'));
    }
  }).fail(function() {
    if (saveBtn) saveBtn.disabled = false;
    alert('Verbindingsfout – probeer opnieuw.');
  });
}

// ── DELETE / CLEAR ───────────────────────────────────────
let _pendingAction = null;

function confirmDelete(idx) {
  const q = QUOTES[idx];
  const name = q?.client?.bedrijf || q?.client?.name || q?.ref || 'deze offerte';
  showConfirm('Offerte verwijderen?', `Verwijder de offerte van <strong>${esc(name)}</strong>? Dit kan niet ongedaan gemaakt worden.`, () => {
    jQuery.post(window.digitifyAdmin.ajaxUrl, {
      action: 'digitify_delete_quote',
      nonce:  window.digitifyAdmin.nonce,
      idx:    idx,
    }, function(response) {
      if (response.success) {
        QUOTES.splice(idx, 1);
        buildMonthFilter();
        render();
        showToast('✓ Offerte verwijderd');
      } else {
        alert('Fout: ' + (response.data?.msg || 'Onbekende fout'));
      }
    });
  });
}

function confirmClearAll() {
  if (!QUOTES.length) return;
  showConfirm('Alle offertes wissen?', `Wis alle <strong>${QUOTES.length}</strong> opgeslagen offerte${QUOTES.length!==1?'s':''}? Niet ongedaan te maken.`, () => {
    jQuery.post(window.digitifyAdmin.ajaxUrl, {
      action: 'digitify_clear_quotes',
      nonce:  window.digitifyAdmin.nonce,
    }, function(response) {
      if (response.success) {
        QUOTES.length = 0;
        render();
        showToast('✓ Alle offertes gewist');
      } else {
        alert('Fout: ' + (response.data?.msg || 'Onbekende fout'));
      }
    });
  });
}

function showConfirm(title, msg, onYes) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').innerHTML = msg;
  _pendingAction = onYes;
  document.getElementById('confirm-overlay').classList.add('active');
  document.getElementById('confirm-yes-btn').onclick = () => { _pendingAction?.(); closeConfirm(); };
}
function closeConfirm() {
  document.getElementById('confirm-overlay')?.classList.remove('active');
  _pendingAction = null;
}

// ── STATUS BIJWERKEN (AJAX) ───────────────────────────────
function updateStatus(idx, field, value) {
  const q = QUOTES[idx];
  if (!q) return;

  // Klik op al-actieve status → wis de status
  if (field === 'status' && q.status === value) value = '';

  const oldVal = q[field];
  q[field] = (field === 'status') ? value : value;

  // Optimistic re-render – open-toestand bewaren
  const cardEl = document.getElementById('qcard-' + idx);
  const wasOpen = cardEl ? cardEl.classList.contains('open') : false;
  if (cardEl) cardEl.outerHTML = quoteCard(q, idx);
  if (wasOpen) document.getElementById('qcard-' + idx)?.classList.add('open');
  updateStats(QUOTES);

  jQuery.post(window.digitifyAdmin.ajaxUrl, {
    action: 'digitify_update_quote_status',
    nonce:  window.digitifyAdmin.nonce,
    idx:    idx,
    field:  field,
    value:  value,
  }, function(response) {
    if (!response.success) {
      q[field] = oldVal; // rollback
      const ce = document.getElementById('qcard-' + idx);
      const ceOpen = ce ? ce.classList.contains('open') : wasOpen;
      if (ce) ce.outerHTML = quoteCard(q, idx);
      if (ceOpen) document.getElementById('qcard-' + idx)?.classList.add('open');
      showToast('⚠️ Status bijwerken mislukt');
    } else {
      const msg = field === 'status'
        ? (value ? '✓ Status: ' + value : '✓ Status gewist')
        : '✓ Bijgewerkt';
      showToast(msg);
    }
  }).fail(function() {
    q[field] = oldVal;
    const ce = document.getElementById('qcard-' + idx);
    const ceOpen = ce ? ce.classList.contains('open') : wasOpen;
    if (ce) ce.outerHTML = quoteCard(q, idx);
    if (ceOpen) document.getElementById('qcard-' + idx)?.classList.add('open');
    showToast('⚠️ Verbindingsfout');
  });
}

// ── OFFERTE PDF BUILDER (jsPDF) – premium multi-page ─────

function _buildQuotePdfDoc(q) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const c = q.client || {};
  const S = window.digitifyAdmin?.settings || {};

  const C = {
    black:[17,17,17], orange:[255,175,81], white:[255,255,255],
    grey:[100,100,100], vlgrey:[245,245,245], lgrey:[220,220,220],
    green:[16,163,74], blue:[37,99,235], teal:[5,150,105]
  };

  const dateStr = q.date || new Date().toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'});
  const expDate = q.expDate || '—';
  const clientDisplay = c.bedrijf || c.name || 'Klant';
  const companyName = S.company_name || 'Digitify';
  const companyBtw = S.company_btw || 'BE0685556507';
  const companyAddress = S.company_address || '';
  const companyCity = S.company_city || '';
  const companyEmail = S.company_email || 'contact@digitify.be';
  const companyPhone = S.company_phone || '+32 (0) 486 51 57 73';
  const companyWebsite = S.company_website || 'www.digitify.be';
  const signerName = S.quote_signer_name || 'Klim Gaikalov';
  const signerRole = S.quote_signer_role || 'Zaakvoerder · Creative Director · Digitify';
  const signerLine = `${signerName} · ${signerRole}`;
  let pageNum = 1;

  const cart = Array.isArray(q.cartItems) && q.cartItems.length ? q.cartItems : null;
  const legacyItems = Array.isArray(q.items) ? q.items : [];
  const allItems = cart || legacyItems;
  const prodNames = allItems.map(it => it.prodLabel || it.label || 'dienst').filter(Boolean).join(', ') || 'de geselecteerde diensten';
  const btwPct = cart && cart[0] && cart[0].btw !== undefined ? (parseFloat(cart[0].btw)||21)
               : (legacyItems.length>0 && legacyItems[0].btw !== undefined ? (parseFloat(legacyItems[0].btw)||21) : 21);
  const grandExcl = allItems.reduce((s,it)=>s+(parseFloat(it.excl)||0),0);
  const grandBtw  = allItems.reduce((s,it)=>s+(parseFloat(it.btwAmt)||0),0);
  const grandTot  = parseFloat(q.grandTotal) || (grandExcl+grandBtw);

  function addPageHeader() {
    const HH = 20;
    doc.setFillColor(...C.black); doc.rect(0,0,W,HH,'F');
    doc.setFillColor(...C.orange); doc.rect(0,0,5,HH,'F');
    doc.setFillColor(20,20,20); doc.rect(W-58,0,58,HH,'F');
    try { if(typeof LOGO_B64!=='undefined') doc.addImage(LOGO_B64,'PNG',8,4,11,11); } catch(e){}
    doc.setTextColor(...C.white); doc.setFontSize(9.5); doc.setFont(undefined,'bold');
    doc.text('DIGITIFY',22,10.5);
    doc.setFontSize(5.8); doc.setFont(undefined,'normal'); doc.setTextColor(...C.orange);
    doc.text('Partner in Digital Solutions',22,14.5);
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(210,210,210);
    doc.text(q.ref||'',W-8,10.5,{align:'right'});
    doc.setFontSize(6); doc.setFont(undefined,'normal'); doc.setTextColor(120,120,120);
    doc.text(`${dateStr}  ·  p.${pageNum}`,W-8,14.5,{align:'right'});
    doc.setFillColor(...C.orange); doc.rect(5,HH,W-5,0.6,'F');
  }

  function addPageFooter() {
    doc.setFillColor(...C.black); doc.rect(0,H-10,W,10,'F');
    doc.setFillColor(...C.orange); doc.rect(0,H-10,4,10,'F');
    const footer = [companyEmail, companyPhone, companyWebsite, `BTW: ${companyBtw}`].filter(Boolean).join(' · ');
    doc.setTextColor(140,140,140); doc.setFontSize(6.5); doc.setFont(undefined,'normal');
    doc.text(footer, W/2, H-4.5, {align:'center'});
  }

  function sectionTitle(label, y) {
    doc.setFillColor(22,22,22); doc.roundedRect(10,y,W-20,10,2,2,'F');
    doc.setFillColor(...C.orange); doc.roundedRect(10,y,4,10,2,2,'F');
    doc.rect(12,y,2,10,'F');
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
    doc.text(label,17.5,y+6.8);
    return y+14;
  }

  // PAGINA 1
  const heroH = 100;
  doc.setFillColor(10,10,10); doc.rect(0,0,W,heroH,'F');
  doc.setFillColor(...C.orange); doc.rect(0,0,6,heroH,'F');
  doc.setFillColor(16,16,16); doc.rect(W-52,0,52,heroH,'F');
  doc.setFillColor(...C.orange); doc.rect(W-52,0,3,heroH,'F');
  try { if(typeof LOGO_B64!=='undefined') doc.addImage(LOGO_B64,'PNG',W/2-14,10,28,28); } catch(e){}
  doc.setTextColor(...C.white); doc.setFontSize(24); doc.setFont(undefined,'bold');
  doc.text('DIGITIFY',W/2,46,{align:'center'});
  doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.orange);
  doc.text('Partner in Digital Solutions',W/2,52.5,{align:'center'});
  doc.setFillColor(...C.orange); doc.rect(W/2-22,56,44,0.5,'F');

  const cOX=W/2-32, cOY=59, cOW=64, cOH=24;
  doc.setFillColor(20,20,20); doc.roundedRect(cOX,cOY,cOW,cOH,3,3,'F');
  doc.setDrawColor(...C.orange); doc.setLineWidth(0.3); doc.roundedRect(cOX,cOY,cOW,cOH,3,3,'S');
  doc.setFillColor(...C.orange); doc.roundedRect(cOX,cOY,cOW,9,3,3,'F'); doc.rect(cOX,cOY+5,cOW,4,'F');
  doc.setTextColor(...C.black); doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.text('OFFERTE',W/2,cOY+7,{align:'center'});
  doc.setTextColor(...C.orange); doc.setFontSize(11); doc.text(q.ref||'—',W/2,cOY+18,{align:'center'});
  doc.setFontSize(5.5); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80); doc.text(`${dateStr}  ·  Geldig tot ${expDate}`,W/2,cOY+23,{align:'center'});
  doc.setFillColor(30,30,30); doc.rect(W/2-20,86,40,0.4,'F');
  doc.setFontSize(5.5); doc.setFont(undefined,'bold'); doc.setTextColor(65,65,65); doc.text('OPGESTELD VOOR',W/2,91,{align:'center'});
  doc.setFontSize(15); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
  const cnLines=doc.splitTextToSize(clientDisplay,W-32);
  cnLines.forEach((l,li)=>doc.text(l,W/2,98+li*8,{align:'center'}));

  let y = heroH + 10;
  const hw = (W-28)/2;
  const cardIH = 46;
  const padX = 6;

  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,hw,cardIH,3,3,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(10,y,hw,8.5,3,3,'F'); doc.rect(10,y+4.5,hw,4,'F');
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text('KLANTGEGEVENS', 10+hw/2, y+6.5, {align:'center'});
  let ky=y+15;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.text(clientDisplay,10+padX,ky); ky+=5.5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  if(c.name && c.name!==c.bedrijf) { doc.text(c.name,10+padX,ky); ky+=4.2; }
  if(c.adres) { doc.text(c.adres,10+padX,ky); ky+=4.2; }
  if(c.email) { doc.setTextColor(...C.blue); doc.text(c.email,10+padX,ky); ky+=4.2; doc.setTextColor(...C.grey); }
  if(c.telefoon) { doc.text(c.telefoon,10+padX,ky); ky+=4.2; }
  if(c.btw) { doc.text(`BTW: ${c.btw}`,10+padX,ky); }

  const dx=10+hw+8;
  doc.setFillColor(...C.vlgrey); doc.roundedRect(dx,y,hw,cardIH,3,3,'F');
  doc.setFillColor(...C.black); doc.roundedRect(dx,y,hw,8.5,3,3,'F'); doc.rect(dx,y+4.5,hw,4,'F');
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white); doc.text('DIGITIFY', dx+hw/2, y+6.5, {align:'center'});
  let oy=y+15;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(companyName,dx+padX,oy); oy+=5.5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  [companyAddress, companyCity, companyEmail, companyPhone, companyWebsite, `BTW: ${companyBtw}`].filter(Boolean).slice(0,5).forEach(line => { doc.text(line,dx+padX,oy); oy+=4.2; });

  y += cardIH + 8;
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,W-20,0.6,0.3,0.3,'F'); y += 8;
  doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
  const p1 = `Bedankt voor uw vertrouwen in Digitify${clientDisplay ? ` en de interesse vanuit ${clientDisplay}` : ''}. Het stemt ons trots u deze offerte op maat voor te leggen voor: ${prodNames}. Na een zorgvuldige analyse van uw noden en doelstellingen hebben wij dit voorstel samengesteld dat perfect aansluit bij uw ambities.`;
  const p2 = `Bij Digitify combineren we design, technologie en strategie tot digitale oplossingen die echt resultaat opleveren - meetbaar, duurzaam en volledig op uw maat. Van het eerste concept tot de finale oplevering staan wij garant voor kwaliteit, transparantie en een vlotte samenwerking.`;
  const p3 = `Deze offerte is geldig tot ${expDate}. Heeft u vragen of wenst u aanpassingen? Aarzel niet - contacteer ons via ${companyEmail} of bel of Whatsapp ons op ${companyPhone}. Wij helpen u graag verder.`;
  [p1,p2,p3].forEach((pTxt,idx)=>{ const lines=doc.splitTextToSize(pTxt,W-22); doc.text(lines,10,y); y += lines.length*4.8 + (idx===2?5:4); });
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(signerName,10,y);
  y += 4.5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.2); doc.setTextColor(...C.grey); doc.text(signerRole,10,y);
  y += 4.5;
  doc.text([companyEmail, companyPhone, companyWebsite, `BTW: ${companyBtw}`].filter(Boolean).join(' · '),10,y);
  addPageFooter();

  // PAGINA 2 - diensten & proces
  doc.addPage(); pageNum++;
  addPageHeader();
  y = 25;
  y = sectionTitle('Onze diensten & aanpak', y);

  const svc = [
    {title:'Webdesign', accent:C.orange, lines:[
      'Snelle, conversie-gerichte websites en webshops die uw merk weerspiegelen en bezoekers omzetten in klanten.',
      '• Custom design in uw huisstijl', '• Responsive op alle apparaten', '• SEO-geoptimaliseerd', '• Gericht op conversie']},
    {title:'Media', accent:C.blue, lines:[
      'Sterke beelden maken het verschil. Van korte social clips tot uitgebreide brand films, fotoshoots en video.',
      '• Professionele montage', '• Platform-specifieke formaten', '• Sound design & kleurcorrectie', '• Drone-beelden mogelijk']},
    {title:'Marketing', accent:C.green, lines:[
      'Gerichte campagnes die meetbaar klanten en omzet opleveren. Google Ads, Meta Ads, social media en drukwerk.',
      '• Data-gedreven aanpak', '• Transparante rapportering', '• Continue optimalisatie', '• Online & offline']},
    {title:'Extra\'s & Add-ons', accent:C.teal, lines:[
      'Aanvullende services: hosting, domeinnamen, SEO, onderhoud, branding en copywriting.',
      '• Hosting & domeinnamen', '• SEO-optimalisatie', '• Onderhoud & updates', '• Logo & huisstijl']}
  ];

  const boxW = (W-26)/2, boxH = 38;
  svc.forEach((s,i)=>{
    const col=i%2, row=Math.floor(i/2), x=10+col*(boxW+6), by=y+row*(boxH+5);
    doc.setFillColor(250,250,250); doc.roundedRect(x,by,boxW,boxH,3,3,'F');
    doc.setDrawColor(230,230,230); doc.setLineWidth(0.25); doc.roundedRect(x,by,boxW,boxH,3,3,'S');
    doc.setFillColor(...s.accent); doc.roundedRect(x,by,3,boxH,1.5,1.5,'F');
    doc.setFontSize(8.8); doc.setFont(undefined,'bold'); doc.setTextColor(18,18,18); doc.text(s.title,x+7,by+7);
    doc.setFontSize(6.9); doc.setFont(undefined,'normal'); doc.setTextColor(...C.grey);
    const lines = [];
    lines.push(...doc.splitTextToSize(s.lines[0], boxW-13).slice(0,3));
    s.lines.slice(1).forEach(t => lines.push(t));
    lines.slice(0,6).forEach((ln,li)=>doc.text(ln,x+7,by+13+li*4.1));
  });
  y += Math.ceil(svc.length/2)*(boxH+5) + 8;

  y = sectionTitle('Ons proces - van idee tot resultaat', y);
  const steps = [
    {nr:'01', title:'Discover', txt:'Kennismaking en briefing. We luisteren naar uw doelen en wensen.'},
    {nr:'02', title:'Create', txt:'Strategie omzetten naar concept, design en content op maat.'},
    {nr:'03', title:'Build', txt:'Bouwen, testen en live zetten als een samenhangend geheel.'},
    {nr:'04', title:'Grow', txt:'Meten, bijsturen en schalen op basis van data en resultaten.'}
  ];
  const stepW = (W-32)/4;
  steps.forEach((s,i)=>{
    const sx = 10 + i*(stepW+4);
    doc.setFillColor(248,248,248); doc.roundedRect(sx,y,stepW,42,3,3,'F');
    doc.setDrawColor(230,230,230); doc.setLineWidth(0.25); doc.roundedRect(sx,y,stepW,42,3,3,'S');
    doc.setFillColor(...C.orange); doc.circle(sx+8,y+8,4.5,'F');
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(s.nr,sx+8,y+8,{align:'center', baseline:'middle'});
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20); doc.text(s.title,sx+16,y+9);
    doc.setFontSize(6.8); doc.setFont(undefined,'normal'); doc.setTextColor(...C.grey);
    doc.splitTextToSize(s.txt,stepW-10).slice(0,5).forEach((ln,li)=>doc.text(ln,sx+5,y+17+li*4));
  });
  addPageFooter();

  // PAGINA 3 - offerte details
  doc.addPage(); pageNum++;
  addPageHeader();
  y = 25;
  y = sectionTitle('Offerte details - geselecteerde diensten', y);

  if (cart) {
    let curY = y;
    const head = [['Omschrijving','St.','Prijs excl. BTW']];
    cart.forEach((it) => {
      if (curY + 28 > H - 24) { doc.addPage(); pageNum++; addPageHeader(); curY = 24; }
      const body = [];
      body.push([{ content: `${it.catLabel||'—'} / ${it.prodLabel||'—'}`, colSpan: 3,
        styles:{ fillColor:[20,20,20], textColor:C.white, fontStyle:'bold', fontSize:9.3, cellPadding:{top:4,bottom:4,left:10,right:6} } }]);
      (Array.isArray(it.items) ? it.items : []).forEach(li => {
        const lbl = li?.label || '—'; const price = parseFloat(li?.price)||0;
        body.push([
          { content: lbl, styles:{fontSize:8, cellPadding:{top:2,bottom:2,left:10,right:5}} },
          { content: (li?.qty ? String(li.qty) : '1'), styles:{halign:'center',fontSize:8, cellPadding:{top:2,bottom:2,left:3,right:3}} },
          { content: fE(price), styles:{halign:'right',fontStyle:'bold',fontSize:8, cellPadding:{top:2,bottom:2,left:4,right:8}} }
        ]);
      });
      if (Array.isArray(it.includedItems) && it.includedItems.length) {
        body.push([{ content:'Inbegrepen in dit pakket:', colSpan:3, styles:{ fillColor:[232,252,240], textColor:[16,120,60], fontStyle:'bold', fontSize:7.5, cellPadding:{top:2,bottom:1,left:8} } }]);
        it.includedItems.forEach(x => body.push([{ content:`+ ${x}`, colSpan:3, styles:{ fillColor:[242,255,248], textColor:[30,110,60], fontSize:7, cellPadding:{top:1,bottom:1,left:12} } }]));
      }
      if (Array.isArray(it.answers) && it.answers.length) {
        const rel = it.answers.filter(a=>a && a.answer && String(a.answer).trim());
        if (rel.length) {
          body.push([{ content:'Projectinformatie:', colSpan:3, styles:{ fillColor:[255,246,230], textColor:[180,110,20], fontStyle:'bold', fontSize:7.5, cellPadding:{top:2,bottom:1,left:8} } }]);
          rel.forEach(a => {
            body.push([{ content: String(a.question||'').trim() || '—', colSpan:3, styles:{ fillColor:[255,250,240], textColor:[100,100,100], fontSize:7, fontStyle:'bold', cellPadding:{top:1.2,bottom:0.4,left:10} } }]);
            body.push([{ content: String(a.answer||'').trim() || '—', colSpan:3, styles:{ fillColor:[255,250,240], textColor:[60,60,60], fontSize:7.5, cellPadding:{top:0.8,bottom:2.2,left:10} } }]);
          });
        }
      }
      if (it.comment && String(it.comment).trim()) {
        body.push([{ content:`Opmerking: ${String(it.comment).trim()}`, colSpan:3, styles:{ fillColor:[255,252,235], textColor:C.grey, fontSize:7, fontStyle:'italic', cellPadding:{top:1,bottom:1,left:8} } }]);
      }
      body.push([{ content:`Subtotaal ${it.prodLabel||''}`, colSpan:2, styles:{ fontStyle:'bold', fontSize:8, fillColor:[240,240,240], textColor:[30,30,30], cellPadding:{top:2,bottom:2,left:10} } },
                 { content:fE(parseFloat(it.excl)||0), styles:{ fontStyle:'bold', fontSize:8, fillColor:[240,240,240], textColor:[30,30,30], halign:'right', cellPadding:{top:2,bottom:2,right:8} } }]);
      body.push([{ content:`BTW (${btwPct}%)`, colSpan:2, styles:{ fontSize:7, fillColor:[240,240,240], textColor:[130,130,130], cellPadding:{top:1,bottom:2,left:10} } },
                 { content:fE(parseFloat(it.btwAmt)||0), styles:{ fontSize:7, fillColor:[240,240,240], textColor:[130,130,130], halign:'right', cellPadding:{top:1,bottom:2,right:8} } }]);
      doc.autoTable({
        startY: curY, head, body, theme:'plain',
        headStyles:{ fillColor:C.orange, textColor:C.black, fontStyle:'bold', fontSize:8, cellPadding:{top:3,bottom:3,left:6,right:4} },
        columnStyles:{ 0:{ cellWidth:'auto' }, 1:{ cellWidth:18, halign:'center' }, 2:{ cellWidth:44, halign:'right' } },
        styles:{ fontSize:8, cellPadding:{top:2,bottom:2,left:8,right:5}, lineColor:[230,230,230], lineWidth:0.25 },
        alternateRowStyles:{ fillColor:[253,253,253] },
        margin:{ left:10,right:10,top:20,bottom:14 },
        didDrawPage: () => { addPageFooter(); }
      });
      curY = doc.lastAutoTable.finalY + 6;
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    doc.autoTable({
      startY: y,
      head: [['Omschrijving','Categorie','Excl. BTW','BTW','Totaal']],
      body: legacyItems.map(it => [it.prodLabel||'—', it.catLabel||'—', fE(it.excl), fE(it.btwAmt), fE(it.total)]),
      theme:'striped',
      headStyles:{ fillColor:C.orange,textColor:C.black,fontStyle:'bold',fontSize:8 },
      styles:{ fontSize:8,cellPadding:{top:3,bottom:3,left:5,right:5} },
      columnStyles:{0:{cellWidth:'auto'},1:{cellWidth:34},2:{cellWidth:28,halign:'right'},3:{cellWidth:22,halign:'right'},4:{cellWidth:28,halign:'right'}},
      margin:{ left:10,right:10,top:20,bottom:14 },
      didDrawPage: () => { addPageFooter(); }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (y + 36 > H - 20) { doc.addPage(); pageNum++; addPageHeader(); y = 24; }
  const totW=W-20, totX=10, rH1=9, rH2=7, rH3=14, totBoxH=rH1+rH2+rH3;
  doc.setFillColor(20,20,20); doc.roundedRect(totX,y,totW,totBoxH,3,3,'F');
  doc.setFillColor(14,14,14); doc.rect(totX,y+rH1,totW,rH2,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(totX,y+rH1+rH2,totW,rH3,3,3,'F'); doc.rect(totX,y+rH1+rH2,totW,3,'F');
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(155,155,155); doc.text('Subtotaal excl. BTW',totX+10,y+5.5); doc.setTextColor(225,225,225); doc.text(fE(grandExcl),totX+totW-8,y+5.5,{align:'right'});
  doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(90,90,90); doc.text(`BTW (${btwPct}%)`,totX+10,y+rH1+4.5); doc.setTextColor(110,110,110); doc.text(fE(grandBtw),totX+totW-8,y+rH1+4.5,{align:'right'});
  doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20); doc.text('TOTAAL INCL. BTW',totX+10,y+rH1+rH2+9.2); doc.text(fE(grandTot),totX+totW-8,y+rH1+rH2+9.2,{align:'right'});
  addPageFooter();

  // PAGINA 4 - akkoord
  doc.addPage(); pageNum++;
  addPageHeader();
  y = 25;
  y = sectionTitle('Akkoord & handtekeningen', y);
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,W-20,24,3,3,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(10,y,3,24,1.5,1.5,'F');
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text('Offertesamenvatting',17,y+9);
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey); doc.text(`Datum: ${dateStr} · Ref: ${q.ref||'—'} · Geldig tot: ${expDate}`,17,y+16);
  doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(`${fE(grandTot)} incl. BTW`,W-15,y+14,{align:'right'});
  y += 28;
  const sigW=(W-28)/2, sigH=56;
  [{ label:'Voor akkoord - Klant', sub:clientDisplay, x:10 }, { label:'Voor akkoord - Digitify', sub:signerLine, x:10+sigW+8 }].forEach(sig=>{
    doc.setFillColor(...C.vlgrey); doc.roundedRect(sig.x,y,sigW,sigH,3,3,'F');
    doc.setFillColor(...C.black); doc.roundedRect(sig.x,y,sigW,10,3,3,'F'); doc.rect(sig.x,y+6,sigW,4,'F');
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white); doc.text(sig.label, sig.x+sigW/2, y+7.5, {align:'center'});
    doc.setFontSize(6.8); doc.setFont(undefined,'normal'); doc.setTextColor(...C.grey); doc.text(sig.sub, sig.x+sigW/2, y+17, {align:'center'});
    doc.setFontSize(6.5); doc.text('Naam:',sig.x+5,y+25); doc.setDrawColor(...C.lgrey); doc.setLineWidth(0.3); doc.line(sig.x+20,y+25,sig.x+sigW-5,y+25);
    doc.text('Datum:',sig.x+5,y+50); doc.line(sig.x+20,y+50,sig.x+sigW-5,y+50); doc.setFontSize(7); doc.text(dateStr,sig.x+22,y+50);
  });
  addPageFooter();

  // PAGINA 5 - tips
  doc.addPage(); pageNum++;
  addPageHeader();
  y = 25;
  y = sectionTitle('Tips & tricks - haal het meeste uit uw investering', y);
  const tips = [
    {title:'Eerste 3 seconden tellen', tip:'Op sociale media beslist de kijker in 3 seconden of ze verder kijken. Start met een sterke openingszin of beeld.'},
    {title:'Consistentie wint', tip:'Wekelijks content plaatsen werkt beter dan één grote campagne per jaar. Maak een contentkalender.'},
    {title:'Hergebruik uw content', tip:'Een brand film kan hergebruikt worden als social clip, testimonial en website hero. Maximaliseer uw investering.'},
    {title:'Doelgroep centraal', tip:'Praat niet over uzelf maar over de problemen van uw klant. Content die helpt, converteert het best.'},
    {title:'Ondertiteling verhoogt bereik', tip:'80% van sociale media video\'s wordt zonder geluid bekeken. Ondertiteling verhoogt uw bereik significant.'},
    {title:'Formaat per platform', tip:'Een vierkante video werkt beter op Instagram, een landscape-variant op YouTube. Pas altijd aan per kanaal.'}
  ];
  const tipW=(W-26)/2, tipH=38;
  tips.forEach((tip,i)=>{
    const col=i%2, row=Math.floor(i/2), tx=10+col*(tipW+6), ty=y+row*(tipH+4);
    doc.setFillColor(250,250,250); doc.roundedRect(tx,ty,tipW,tipH,3,3,'F');
    doc.setDrawColor(228,228,228); doc.setLineWidth(0.2); doc.roundedRect(tx,ty,tipW,tipH,3,3,'S');
    doc.setFillColor(...C.orange); doc.roundedRect(tx,ty,3,tipH,1.5,1.5,'F'); doc.rect(tx+1.5,ty,1.5,tipH,'F');
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(18,18,18); doc.text(doc.splitTextToSize(tip.title, tipW-14)[0],tx+7,ty+7);
    doc.setDrawColor(220,220,220); doc.setLineWidth(0.25); doc.line(tx+7, ty+10.5, tx+tipW-5, ty+10.5);
    doc.setFont(undefined,'normal'); doc.setFontSize(7); doc.setTextColor(70,70,70);
    doc.splitTextToSize(tip.tip,tipW-13).slice(0,4).forEach((l,li)=>doc.text(l,tx+7,ty+16+li*4.0));
  });
  y += Math.ceil(tips.length/2)*(tipH+4)+8;
  y = sectionTitle('Volgende stappen', y);
  [
    {n:'1',text:'Lees de offerte door en stel uw vragen via '+companyEmail},
    {n:'2',text:'Onderteken digitaal of afgedrukt en stuur ons een kopie terug'},
    {n:'3',text:'Wij starten de onboarding en plannen uw project in'},
    {n:'4',text:'Succesvolle oplevering!'}
  ].forEach((step,i)=>{
    const sy=y+i*10;
    doc.setFillColor(...C.orange); doc.circle(16,sy+3.5,4.5,'F');
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(step.n,16,sy+3.5,{align:'center', baseline:'middle'});
    if(i<3){ doc.setDrawColor(228,228,228); doc.setLineWidth(0.5); doc.line(16,sy+8,16,sy+10); }
    doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(...C.grey); doc.text(step.text,24,sy+4.5);
  });
  addPageFooter();
  return doc;
}


// ── OFFERTE PDF DOWNLOADEN ────────────────────────────────
function downloadQuotePdf(idx) {
  const q = QUOTES[idx];
  if (!q) return;

  const downloadFallbackPdf = () => {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
      alert('jsPDF niet geladen. Herlaad de pagina en probeer opnieuw.'); return;
    }
    try {
      _buildQuotePdfDoc(q).save(`Offerte_${q.ref||'quote'}.pdf`);
      showToast('✓ Offerte PDF gedownload');
    } catch(e) {
      console.error('PDF fout:', e);
      showToast('⚠️ PDF genereren mislukt');
    }
  };

  // Voor rijke offertes met cartItems bouwen we altijd de nieuwste PDF-layout client-side op,
  // zodat extra secties en klantdata meteen meegenomen worden.
  if (Array.isArray(q.cartItems) && q.cartItems.length) {
    downloadFallbackPdf();
    return;
  }

  jQuery.post(window.digitifyAdmin.ajaxUrl, {
    action: 'digitify_download_pdf',
    nonce: window.digitifyAdmin.nonce,
    ref: q.ref || ''
  }, function(response) {
    if (response && response.success && response.data && response.data.pdfB64) {
      try {
        const link = document.createElement('a');
        link.href = 'data:application/pdf;base64,' + response.data.pdfB64;
        link.download = `Offerte_${q.ref||'quote'}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('✓ Offerte PDF gedownload');
        return;
      } catch (serverDownloadErr) {
        console.warn('Server PDF download mislukt, fallback naar client-side builder:', serverDownloadErr);
      }
    }
    downloadFallbackPdf();
  }).fail(function() {
    downloadFallbackPdf();
  });
}

// ── FACTUUR PDF DOWNLOADEN ────────────────────────────────
function downloadInvoicePdf(idx) {
  const q = QUOTES[idx];
  if (!q) return;
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    alert('jsPDF niet geladen. Herlaad de pagina en probeer opnieuw.'); return;
  }
  try {
    const doc = _buildInvoicePdfDocForMail(q);
    if (doc) {
      doc.save(`Factuur_${q.ref||'factuur'}.pdf`);
      showToast('✓ Factuur PDF gedownload');
    } else {
      showToast('⚠️ Factuur genereren mislukt');
    }
  } catch(e) {
    console.error('Factuur PDF fout:', e);
    showToast('⚠️ Factuur genereren mislukt');
  }
}

// ── VOORSCHOTFACTUUR GENEREREN (50% standaard) ───────────
function generateVoorschotfactuur(idx, pct) {
  const q = QUOTES[idx];
  if (!q) return;
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    showToast('⚠️ jsPDF niet geladen. Herlaad de pagina.'); return;
  }
  const pctFinal = Math.max(1, Math.min(100, parseFloat(pct) || 50));
  try {
    const doc = _buildVoorschotPdfDoc(q, pctFinal);
    if (!doc) { showToast('⚠️ jsPDF niet beschikbaar'); return; }
    doc.save(`Voorschotfactuur_${pctFinal}pct_${q.ref||'quote'}.pdf`);
    showToast(`✓ Voorschotfactuur ${pctFinal}% gedownload`);
  } catch(e) {
    console.error('Voorschotfactuur fout:', e);
    showToast('⚠️ Voorschotfactuur genereren mislukt');
  }
}

// ── MAIL MODAL ───────────────────────────────────────────
let _mailIdx  = null;
let _mailType = null;

function openMailModal(idx, type) {
  const q = QUOTES[idx];
  if (!q) return;
  _mailIdx = idx;

  // E-mail vooraf invullen
  const toInput = document.getElementById('mail-to-input');
  if (toInput) toInput.value = q.client?.email || '';

  // Bericht leegmaken
  const msgInput = document.getElementById('mail-msg-input');
  if (msgInput) { msgInput.value = ''; msgInput.placeholder = 'Schrijf hier uw bericht aan de klant…'; }

  // Bijlage resetten
  const attachInput = document.getElementById('mail-attachment');
  if (attachInput) attachInput.value = '';

  // Reset send button
  const sendBtn = document.getElementById('mail-send-btn');
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M3 10l14-7-7 14v-7L3 10z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Versturen';
  }

  // Standaard: "Alleen bericht" geselecteerd
  const tplBtn = document.querySelector(`.da-tpl-btn[data-tpl="geen"]`);
  setMailTemplate('geen', tplBtn);

  document.getElementById('mail-modal')?.classList.add('active');
  setTimeout(() => toInput?.focus(), 120);
}

// ── Template-selector ─────────────────────────────────────
function setMailTemplate(tpl, btn) {
  _mailType = tpl;

  // Actieve knop markeren
  document.querySelectorAll('.da-tpl-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const attachRow  = document.getElementById('mail-attachment-row');
  const voorRow    = document.getElementById('mail-voorschot-row');

  // Bijlage is altijd zichtbaar (optioneel)
  if (attachRow) attachRow.style.display = '';
  // Voorschot percentage enkel bij voorschot
  if (voorRow)   voorRow.style.display   = (tpl === 'voorschot') ? '' : 'none';

  // Onderwerp bijwerken (alleen als nog niet door gebruiker gewijzigd)
  const q = _mailIdx !== null ? QUOTES[_mailIdx] : null;
  if (q) {
    const subjectInput = document.getElementById('mail-subject-input');
    if (subjectInput) {
      const clientLabel = q.client?.bedrijf || q.client?.name || '';
      const subjects = {
        offerte:  `Offerte ${q.ref||''} – ${clientLabel}`.trim(),
        factuur:  `Factuur ${q.ref||''} – ${clientLabel}`.trim(),
        voorstel: `Voorstel ${q.ref||''} – ${clientLabel}`.trim(),
        voorschot:`Voorschotfactuur ${q.ref||''} – ${clientLabel}`.trim(),
        geen:     `Bericht van Digitify – ${q.ref||''}`.trim(),
      };
      subjectInput.value = subjects[tpl] || subjectInput.value;
    }
  }
}

function closeMailModal() {
  document.getElementById('mail-modal')?.classList.remove('active');
  _mailIdx  = null;
  _mailType = null;
}

function doSendMail() {
  if (_mailIdx === null) return;
  const toInput = document.getElementById('mail-to-input');
  const to = (toInput?.value || '').trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
    showToast('⚠️ Geldig e-mailadres vereist');
    toInput?.focus();
    return;
  }
  const personalMsg   = (document.getElementById('mail-msg-input')?.value    || '').trim();
  const customSubject = (document.getElementById('mail-subject-input')?.value || '').trim();
  const voorschotPct  = parseInt(document.getElementById('mail-voorschot-pct')?.value || '50', 10) || 50;
  const q = QUOTES[_mailIdx];
  if (!q) return;

  const sendBtn = document.getElementById('mail-send-btn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '⏳ Versturen…'; }

  const svgSend = '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M3 10l14-7-7 14v-7L3 10z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const savedIdx  = _mailIdx;
  const savedType = _mailType || 'geen';

  // Interne verstuurFunctie (na eventuele FileReader)
  const _doPost = (attachmentB64, attachmentName) => {
    // IMPORTANT: gebruik FormData i.p.v. x-www-form-urlencoded.
    // Anders worden '+' tekens in base64 omgezet naar spaties → corrupte PDF.
    const fd = new FormData();
    fd.append('action', 'digitify_send_document_email');
    fd.append('nonce', window.digitifyAdmin.nonce);
    fd.append('idx', String(savedIdx));
    fd.append('type', savedType);
    fd.append('to', to);
    fd.append('message', personalMsg);
    fd.append('subject', customSubject);
    fd.append('voorschotPct', String(voorschotPct));
    fd.append('attachmentB64', attachmentB64 || '');
    fd.append('attachmentName', attachmentName || '');

    jQuery.ajax({
      url: window.digitifyAdmin.ajaxUrl,
      method: 'POST',
      data: fd,
      processData: false,
      contentType: false,
    }).done(function(response) {
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = svgSend + ' Versturen'; }
      if (response.success) {
        closeMailModal();
        const typeLabel = savedType === 'factuur' ? 'Factuur' : savedType === 'voorschot' ? 'Voorschotfactuur' : savedType === 'voorstel' ? 'Voorstel' : savedType === 'offerte' ? 'Offerte' : 'Bericht';
        showToast(`✓ ${typeLabel} verstuurd naar ${to}`);
        if (savedType === 'factuur')   QUOTES[savedIdx].factuur_verstuurd = true;
        if (savedType === 'voorschot') QUOTES[savedIdx].voorschot_verstuurd = true;
        if (savedType === 'voorstel')  QUOTES[savedIdx].voorstel_verstuurd = true;
        if (savedType === 'offerte')   QUOTES[savedIdx].offerte_verstuurd = true;
        const ce = document.getElementById('qcard-' + savedIdx);
        const ceWasOpen = ce ? ce.classList.contains('open') : false;
        if (ce) ce.outerHTML = quoteCard(QUOTES[savedIdx], savedIdx);
        if (ceWasOpen) document.getElementById('qcard-' + savedIdx)?.classList.add('open');
      } else {
        showToast('⚠️ ' + (response.data?.msg || 'Versturen mislukt'));
      }
    }).fail(function() {
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = svgSend + ' Versturen'; }
      showToast('⚠️ Verbindingsfout');
    });
  };

  // Bijlage lezen als aanwezig (voor alle templates)
  const attachInput = document.getElementById('mail-attachment');
  if (attachInput?.files?.length) {
    const file = attachInput.files[0];
    const reader = new FileReader();
    reader.onload  = e  => _doPost(e.target.result, file.name);
    reader.onerror = () => _doPost('', '');
    reader.readAsDataURL(file);
  } else {
    _doPost('', '');
  }
}

// Helper: bouw factuur-PDF doc (zonder te downloaden) voor e-mail bijlage
function _buildInvoicePdfDocForMail(q) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const c = q.client || {};
  const S = window.digitifyAdmin?.settings || {};
  const C = {
    black:[17,17,17], orange:[255,175,81], white:[255,255,255],
    grey:[100,100,100], vlgrey:[245,245,245], green:[16,163,74], blue:[37,99,235],
  };
  const now    = new Date();
  const invNr  = `FACT-${q.ref||Date.now().toString().slice(-6)}`;
  const dateStr= q.date || now.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'});
  const dueDate= (() => { const d=new Date(now); d.setDate(d.getDate()+30); return d.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'}); })();
  const clientDisplay  = c.bedrijf||c.name||'Klant';
  const companyName    = S.company_name    || 'Digitify BV';
  const companyBtw     = S.company_btw     || 'BE0742906469';
  const companyAddress = S.company_address || '';
  const companyCity    = S.company_city    || '';
  const companyEmail   = S.company_email   || 'contact@digitify.be';
  const companyPhone   = S.company_phone   || '';
  const companyIban    = S.company_iban    || '';

  doc.setFillColor(...C.black); doc.rect(0,0,W,24,'F');
  doc.setFillColor(...C.orange); doc.rect(0,0,5,24,'F');
  doc.setFillColor(22,22,22); doc.rect(W-60,0,60,24,'F');
  try { if(typeof LOGO_B64!=='undefined') doc.addImage(LOGO_B64,'PNG',8,6,12,12); } catch(e){}
  doc.setTextColor(...C.white); doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.text('DIGITIFY',24,12);
  doc.setFontSize(6.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.orange); doc.text('Partner in Digital Solutions',24,17);
  doc.setFontSize(18); doc.setFont(undefined,'bold'); doc.setTextColor(...C.orange); doc.text('FACTUUR',W-8,13,{align:'right'});
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(180,180,180); doc.text(invNr,W-8,18.5,{align:'right'});
  doc.setFillColor(...C.orange); doc.rect(5,24,W-5,0.6,'F');

  let y = 32; const hw = (W-28)/2;
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,hw,48,3,3,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(10,y,hw,9,3,3,'F'); doc.rect(10,y+5,hw,4,'F');
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text('KLANTGEGEVENS',10+hw/2,y+7,{align:'center'});
  let ky=y+16;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(clientDisplay,15,ky); ky+=5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  if(c.name&&c.name!==c.bedrijf){doc.text(c.name,15,ky);ky+=4;}
  if(c.adres){doc.text(c.adres,15,ky);ky+=4;}
  if(c.email){doc.setTextColor(...C.blue);doc.text(c.email,15,ky);ky+=4;doc.setTextColor(...C.grey);}
  if(c.telefoon){doc.text(c.telefoon,15,ky);ky+=4;}
  if(c.btw){doc.text(`BTW: ${c.btw}`,15,ky);}

  const dx=10+hw+8;
  doc.setFillColor(...C.vlgrey); doc.roundedRect(dx,y,hw,48,3,3,'F');
  doc.setFillColor(30,30,30); doc.roundedRect(dx,y,hw,9,3,3,'F'); doc.rect(dx,y+5,hw,4,'F');
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white); doc.text('ONZE GEGEVENS',dx+hw/2,y+7,{align:'center'});
  let oy=y+16;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(companyName,dx+4,oy); oy+=5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  if(companyAddress){doc.text(companyAddress,dx+4,oy);oy+=4;}
  if(companyCity){doc.text(companyCity,dx+4,oy);oy+=4;}
  if(companyEmail){doc.setTextColor(...C.blue);doc.text(companyEmail,dx+4,oy);oy+=4;doc.setTextColor(...C.grey);}
  if(companyPhone){doc.text(companyPhone,dx+4,oy);oy+=4;}
  if(companyBtw){doc.text(`BTW: ${companyBtw}`,dx+4,oy);oy+=4;}
  if(companyIban){doc.text(`IBAN: ${companyIban}`,dx+4,oy);}
  y+=56;

  const bdH=14;
  doc.setFillColor(22,22,22); doc.roundedRect(10,y,W-20,bdH,2,2,'F');
  const bdCols=[{lbl:'Factuurnummer',val:invNr},{lbl:'Factuurdatum',val:dateStr},{lbl:'Vervaldatum',val:dueDate},{lbl:'Referentie',val:q.ref||'—'}];
  const colW=(W-20)/bdCols.length;
  bdCols.forEach((col,i)=>{
    const cx=10+i*colW+colW/2;
    doc.setFontSize(5.5);doc.setFont(undefined,'normal');doc.setTextColor(130,130,130);doc.text(col.lbl.toUpperCase(),cx,y+4.5,{align:'center'});
    doc.setFontSize(7.5);doc.setFont(undefined,'bold');doc.setTextColor(...C.white);doc.text(col.val,cx,y+10.5,{align:'center'});
  });
  y+=bdH+8;

  // Diensten (detail uit configurator)
  const cart = Array.isArray(q.cartItems) && q.cartItems.length ? q.cartItems : null;
  const legacyItems = Array.isArray(q.items) ? q.items : [];

  const btwPct = cart && cart[0] && cart[0].btw !== undefined ? (parseFloat(cart[0].btw)||21)
                : (legacyItems.length>0 && legacyItems[0].btw !== undefined ? (parseFloat(legacyItems[0].btw)||21) : 21);

  const itemsForTotals = cart || legacyItems;
  const grandExcl = itemsForTotals.reduce((s,it)=>s+(parseFloat(it.excl)||0),0);
  const grandBtw  = itemsForTotals.reduce((s,it)=>s+(parseFloat(it.btwAmt)||0),0);
  const grandTot  = parseFloat(q.grandTotal)|| (grandExcl+grandBtw);

  if (cart) {
    const head = [['Omschrijving','St.','Prijs excl. BTW']];
    let curY = y;

    cart.forEach(it => {
      if (curY + 28 > H - 16) { doc.addPage(); curY = 24; }
      const body = [];
      body.push([{ content: `${it.catLabel||'—'}  /  ${it.prodLabel||'—'}`, colSpan:3,
        styles:{ fillColor:[20,20,20], textColor:C.white, fontStyle:'bold', fontSize:9.3,
          cellPadding:{top:4,bottom:4,left:10,right:6} } }]);

      (Array.isArray(it.items) ? it.items : []).forEach(li => {
        const lbl = li?.label || '—';
        const price = parseFloat(li?.price)||0;
        body.push([
          { content: lbl, styles:{fontSize:8, cellPadding:{top:2,bottom:2,left:10,right:5}} },
          { content: (li?.qty ? String(li.qty) : '1'), styles:{halign:'center',fontSize:8, cellPadding:{top:2,bottom:2,left:3,right:3}} },
          { content: fE(price), styles:{halign:'right',fontStyle:'bold',fontSize:8, cellPadding:{top:2,bottom:2,left:4,right:8}} },
        ]);
      });

      if (Array.isArray(it.includedItems) && it.includedItems.length) {
        body.push([{ content:'Inbegrepen in dit pakket:', colSpan:3,
          styles:{ fillColor:[232,252,240], textColor:[16,120,60], fontStyle:'bold', fontSize:7.5,
            cellPadding:{top:2,bottom:1,left:8} } }]);
        const chunkSize=2;
        for(let ci=0; ci<it.includedItems.length; ci+=chunkSize){
          const chunk=it.includedItems.slice(ci,ci+chunkSize);
          body.push([{ content:chunk.map(x=>`+ ${x}`).join('          '), colSpan:3,
            styles:{ fillColor:[242,255,248], textColor:[30,110,60], fontSize:7, cellPadding:{top:1,bottom:1,left:12} } }]);
        }
      }

      if (Array.isArray(it.answers) && it.answers.length) {
        const rel = it.answers.filter(a=>a && a.answer && String(a.answer).trim());
        if (rel.length) {
          body.push([{ content:'Projectinformatie:', colSpan:3,
            styles:{ fillColor:[255,246,230], textColor:[180,110,20], fontStyle:'bold', fontSize:7.5,
              cellPadding:{top:2,bottom:1,left:8} } }]);
          rel.forEach(a=>{
            body.push([{ content:String(a.question||'').trim()||'—', colSpan:3,
              styles:{ fillColor:[255,250,240], textColor:[100,100,100], fontSize:7, fontStyle:'bold',
                cellPadding:{top:1.2,bottom:0.4,left:10} } }]);
            body.push([{ content:String(a.answer||'').trim()||'—', colSpan:3,
              styles:{ fillColor:[255,250,240], textColor:[60,60,60], fontSize:7.5,
                cellPadding:{top:0.8,bottom:2.2,left:10} } }]);
          });
        }
      }

      if (it.comment && String(it.comment).trim()) {
        body.push([{ content:`Opmerking: ${String(it.comment).trim()}`, colSpan:3,
          styles:{ fillColor:[255,252,235], textColor:C.grey, fontSize:7, fontStyle:'italic',
            cellPadding:{top:1,bottom:1,left:8} } }]);
      }

      body.push([{ content:`Subtotaal ${it.prodLabel||''}`, colSpan:2,
        styles:{ fontStyle:'bold', fontSize:8, fillColor:[240,240,240], textColor:[30,30,30], cellPadding:{top:2,bottom:2,left:10} } },
        { content:fE(parseFloat(it.excl)||0), styles:{ fontStyle:'bold', fontSize:8, fillColor:[240,240,240], textColor:[30,30,30], halign:'right', cellPadding:{top:2,bottom:2,right:8} } }]);
      body.push([{ content:`BTW (${btwPct}%)`, colSpan:2,
        styles:{ fontSize:7, fillColor:[240,240,240], textColor:[130,130,130], cellPadding:{top:1,bottom:2,left:10} } },
        { content:fE(parseFloat(it.btwAmt)||0), styles:{ fontSize:7, fillColor:[240,240,240], textColor:[130,130,130], halign:'right', cellPadding:{top:1,bottom:2,right:8} } }]);

      doc.autoTable({
        startY: curY,
        head,
        body,
        theme:'plain',
        headStyles:{ fillColor:C.orange, textColor:C.black, fontStyle:'bold', fontSize:8, cellPadding:{top:3,bottom:3,left:6,right:4} },
        columnStyles:{ 0:{cellWidth:'auto'}, 1:{cellWidth:18,halign:'center'}, 2:{cellWidth:44,halign:'right'} },
        styles:{ fontSize:8, cellPadding:{top:2,bottom:2,left:8,right:5}, lineColor:[230,230,230], lineWidth:0.25 },
        alternateRowStyles:{ fillColor:[253,253,253] },
        margin:{ left:10,right:10,bottom:18 },
      });

      curY = doc.lastAutoTable.finalY + 6;
    });

    // Totalen tabel
    doc.autoTable({
      startY: curY,
      head:[['','', ''] ],
      body:[
        [{content:'Subtotaal excl. BTW',colSpan:2,styles:{halign:'right',fontStyle:'bold',fillColor:[28,28,28],textColor:C.white,fontSize:8}},{content:`€ ${f2(grandExcl)}`,styles:{halign:'right',fontStyle:'bold',fillColor:[28,28,28],textColor:C.white,fontSize:8}}],
        [{content:`BTW (${btwPct}%)`,colSpan:2,styles:{halign:'right',fillColor:[22,22,22],textColor:[150,150,150],fontSize:7.5}},{content:`€ ${f2(grandBtw)}`,styles:{halign:'right',fillColor:[22,22,22],textColor:[150,150,150],fontSize:7.5}}],
        [{content:'TOTAAL INCL. BTW',colSpan:2,styles:{halign:'right',fontStyle:'bold',fillColor:C.orange,textColor:C.black,fontSize:11}},{content:`€ ${f2(grandTot)}`,styles:{halign:'right',fontStyle:'bold',fillColor:C.orange,textColor:C.black,fontSize:11}}],
      ],
      theme:'plain',
      columnStyles:{0:{cellWidth:'auto'},1:{cellWidth:18},2:{cellWidth:44,halign:'right'}},
      styles:{fontSize:8,cellPadding:{top:3,bottom:3,left:5,right:5}},
      margin:{left:10,right:10,bottom:18},
    });

  } else {
    // Legacy samenvattingstabel
    const items = legacyItems;
    const tableBody = items.map(it => [it.prodLabel||'—',it.catLabel||'—',fE(it.excl),fE(it.btwAmt),fE(it.total)]);

    doc.autoTable({
      startY:y,
      head:[['Omschrijving','Categorie','Excl. BTW','BTW','Totaal']],
      body:tableBody,
      foot:[
        [{content:'Subtotaal excl. BTW',colSpan:4,styles:{halign:'right',fontStyle:'bold',fillColor:[28,28,28],textColor:C.white,fontSize:8}},{content:`€ ${f2(grandExcl)}`,styles:{halign:'right',fontStyle:'bold',fillColor:[28,28,28],textColor:C.white,fontSize:8}}],
        [{content:`BTW (${btwPct}%)`,colSpan:4,styles:{halign:'right',fillColor:[22,22,22],textColor:[150,150,150],fontSize:7.5}},{content:`€ ${f2(grandBtw)}`,styles:{halign:'right',fillColor:[22,22,22],textColor:[150,150,150],fontSize:7.5}}],
        [{content:'TOTAAL INCL. BTW',colSpan:4,styles:{halign:'right',fontStyle:'bold',fillColor:C.orange,textColor:C.black,fontSize:11}},{content:`€ ${f2(grandTot)}`,styles:{halign:'right',fontStyle:'bold',fillColor:C.orange,textColor:C.black,fontSize:11}}],
      ],
      theme:'striped',headStyles:{fillColor:C.orange,textColor:C.black,fontStyle:'bold',fontSize:8},
      styles:{fontSize:8,cellPadding:{top:3,bottom:3,left:5,right:5}},
      columnStyles:{0:{cellWidth:'auto'},1:{cellWidth:36},2:{cellWidth:28,halign:'right'},3:{cellWidth:22,halign:'right'},4:{cellWidth:28,halign:'right'}},
      margin:{left:10,right:10,bottom:18},
    });
  }

  let after

  let afterY=doc.lastAutoTable.finalY+10;
  if(afterY<H-40){
    const payIban=companyIban||'BE67 0682 2870 5104';
    const payDays=S.payment_days?parseInt(S.payment_days):30;
    doc.setFillColor(232,252,240);doc.roundedRect(10,afterY,W-20,22,3,3,'F');
    doc.setFillColor(...C.green);doc.roundedRect(10,afterY,3,22,1.5,1.5,'F');doc.rect(11.5,afterY,1.5,22,'F');
    doc.setFontSize(8.5);doc.setFont(undefined,'bold');doc.setTextColor(16,110,55);doc.text('Betalingsinformatie',17,afterY+7);
    doc.setFont(undefined,'normal');doc.setFontSize(7.5);doc.setTextColor(30,100,50);
    doc.text(`Gelieve het bedrag van €${f2(grandTot)} te storten op rekening ${payIban} (${companyName})`,17,afterY+13);
    doc.text(`met mededeling: ${invNr} · Betaaltermijn: ${payDays} dagen · Vervaldatum: ${dueDate}`,17,afterY+18.5);
    afterY += 26;
  }
  // Optionele notities
  if(q.note && q.note.trim() && afterY < H-42){
    const noteH=22;
    doc.setFillColor(245,247,255);doc.roundedRect(10,afterY,W-20,noteH,3,3,'F');
    doc.setFillColor(...C.blue);doc.roundedRect(10,afterY,3,noteH,1.5,1.5,'F');doc.rect(11.5,afterY,1.5,noteH,'F');
    doc.setFontSize(8.5);doc.setFont(undefined,'bold');doc.setTextColor(...C.blue);doc.text('Opmerkingen',17,afterY+7);
    doc.setFont(undefined,'normal');doc.setFontSize(7.5);doc.setTextColor(30,50,100);
    const nl=doc.splitTextToSize(q.note.trim(),W-42);
    nl.slice(0,2).forEach((ln,i)=>doc.text(ln,17,afterY+13+i*4.5));
  }
  const footerParts=[companyEmail,companyPhone,S.company_website||'www.digitify.be',`BTW: ${companyBtw}`].filter(Boolean);
  doc.setFillColor(...C.black);doc.rect(0,H-10,W,10,'F');
  doc.setFillColor(...C.orange);doc.rect(0,H-10,4,10,'F');
  doc.setTextColor(140,140,140);doc.setFontSize(6.5);
  doc.text(footerParts.join(' · '),W/2,H-4.5,{align:'center'});
  return doc;
}

// ── VOORSCHOTFACTUUR PDF DOCUMENT (herbruikbaar voor mail + download) ──
function _buildVoorschotPdfDoc(q, pct) {
  if (typeof window.jspdf === 'undefined') return null;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const c = q.client || {};
  const S = window.digitifyAdmin?.settings || {};
  const C = { black:[17,17,17], orange:[255,175,81], white:[255,255,255], grey:[100,100,100], vlgrey:[245,245,245], green:[16,163,74], blue:[37,99,235] };
  const f2 = v => v.toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const now = new Date();
  const invNr   = `VOOR-${q.ref||Date.now().toString().slice(-6)}`;
  const dateStr = q.date || now.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'});
  const dueDate = (() => { const d=new Date(now); d.setDate(d.getDate()+14); return d.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'}); })();
  const clientDisplay = c.bedrijf||c.name||'Klant';
  const companyName   = S.company_name  || 'Digitify BV';
  const companyBtw    = S.company_btw   || 'BE0742906469';
  const companyEmail  = S.company_email || 'contact@digitify.be';
  const companyIban   = S.company_iban  || '';
  const cart = Array.isArray(q.cartItems) && q.cartItems.length ? q.cartItems : null;
  const legacyItems = Array.isArray(q.items) ? q.items : [];
  const btwPct = cart && cart[0] && cart[0].btw !== undefined ? (parseFloat(cart[0].btw)||21)
              : (legacyItems.length>0 && legacyItems[0].btw !== undefined ? (parseFloat(legacyItems[0].btw)||21) : 21);

  const grandExcl = (cart||legacyItems).reduce((s,it)=>s+(parseFloat(it.excl)||0),0);
  const grandBtw  = (cart||legacyItems).reduce((s,it)=>s+(parseFloat(it.btwAmt)||0),0);
  const grandTotal = parseFloat(q.grandTotal)|| (grandExcl+grandBtw);

  const voorschotExcl  = grandExcl * (pct/100);
  const voorschotBtw   = grandBtw  * (pct/100);
  const voorschotTotal = voorschotExcl + voorschotBtw;

  // Header
  doc.setFillColor(...C.black); doc.rect(0,0,W,24,'F');
  doc.setFillColor(...C.orange); doc.rect(0,0,5,24,'F');
  doc.setFillColor(22,22,22); doc.rect(W-60,0,60,24,'F');
  try { if(typeof LOGO_B64!=='undefined') doc.addImage(LOGO_B64,'PNG',8,6,12,12); } catch(e){}
  doc.setTextColor(...C.white); doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.text('DIGITIFY',24,12);
  doc.setFontSize(6.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.orange); doc.text('Partner in Digital Solutions',24,17);
  doc.setFontSize(15); doc.setFont(undefined,'bold'); doc.setTextColor(...C.orange); doc.text('VOORSCHOTFACTUUR',W-8,11,{align:'right'});
  doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(180,180,180); doc.text(`${pct}% voorschot · ${invNr}`,W-8,17,{align:'right'});
  doc.setFillColor(...C.orange); doc.rect(5,24,W-5,0.6,'F');

  let y=32; const hw=(W-28)/2;
  // Client card
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,hw,42,3,3,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(10,y,hw,8,3,3,'F'); doc.rect(10,y+5,hw,3,'F');
  doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text('KLANTGEGEVENS',10+hw/2,y+6.5,{align:'center'});
  let ky=y+14; doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(clientDisplay,15,ky); ky+=5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7); doc.setTextColor(...C.grey);
  if(c.name&&c.name!==c.bedrijf){doc.text(c.name,15,ky);ky+=4;}
  if(c.email){doc.setTextColor(...C.blue);doc.text(c.email,15,ky);ky+=4;doc.setTextColor(...C.grey);}
  if(c.btw){doc.text(`BTW: ${c.btw}`,15,ky);}
  // Company card
  const dx=10+hw+8;
  doc.setFillColor(...C.vlgrey); doc.roundedRect(dx,y,hw,42,3,3,'F');
  doc.setFillColor(30,30,30); doc.roundedRect(dx,y,hw,8,3,3,'F'); doc.rect(dx,y+5,hw,3,'F');
  doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white); doc.text('ONZE GEGEVENS',dx+hw/2,y+6.5,{align:'center'});
  let oy=y+14; doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text(companyName,dx+4,oy); oy+=5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7); doc.setTextColor(...C.grey);
  if(companyEmail){doc.setTextColor(...C.blue);doc.text(companyEmail,dx+4,oy);oy+=4;doc.setTextColor(...C.grey);}
  if(companyBtw){doc.text(`BTW: ${companyBtw}`,dx+4,oy);oy+=4;}
  if(companyIban){doc.text(`IBAN: ${companyIban}`,dx+4,oy);}
  y+=50;

  // Detail bar
  const bdH=14; doc.setFillColor(22,22,22); doc.roundedRect(10,y,W-20,bdH,2,2,'F');
  const bdCols=[{lbl:'Factuurnummer',val:invNr},{lbl:'Datum',val:dateStr},{lbl:'Vervaldatum (14 d.)',val:dueDate},{lbl:'Ref. offerte',val:q.ref||'—'}];
  const colW=(W-20)/bdCols.length;
  bdCols.forEach((col,i)=>{
    const cx=10+i*colW+colW/2;
    doc.setFontSize(5.5);doc.setFont(undefined,'normal');doc.setTextColor(130,130,130);doc.text(col.lbl.toUpperCase(),cx,y+4.5,{align:'center'});
    doc.setFontSize(7.5);doc.setFont(undefined,'bold');doc.setTextColor(...C.white);doc.text(col.val,cx,y+10.5,{align:'center'});
  });
  y+=bdH+10;

  // Voorschot tabel
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,W-20,50,3,3,'F');
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text(`Voorschot ${pct}% – Offerte ${q.ref||''}`,16,y+10);
  doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.grey);
  doc.text(`Voorschot van ${pct}% op het totale offertebedrag van € ${f2(grandTotal)} incl. BTW`,16,y+17);
  y+=28;
  const rows=[['Omschrijving','Excl. BTW','BTW','Totaal'],[`${pct}% voorschot – ref. ${q.ref||''}`,`€ ${f2(voorschotExcl)}`,`€ ${f2(voorschotBtw)}`,`€ ${f2(voorschotTotal)}`]];
  if(typeof doc.autoTable==='function'){
    doc.autoTable({startY:y,head:[rows[0]],body:[rows[1]],theme:'plain',styles:{fontSize:8,cellPadding:5},headStyles:{fillColor:C.black,textColor:C.white,fontStyle:'bold'},margin:{left:10,right:10}});
    y=doc.lastAutoTable.finalY+10;
  } else { y+=20; }

  // Details oorspronkelijke offerte (lijn per dienst + aparte prijzen)
  if (cart && typeof doc.autoTable==='function') {
    const head = [['Omschrijving','St.','Prijs excl. BTW']];
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
    doc.text('Details oorspronkelijke offerte', 10, y);
    y += 4;

    cart.forEach(it => {
      if (y + 28 > H - 16) { doc.addPage(); y = 24; }

      const body = [];
      body.push([{ content: `${it.catLabel||'—'}  /  ${it.prodLabel||'—'}`, colSpan:3,
        styles:{ fillColor:[20,20,20], textColor:C.white, fontStyle:'bold', fontSize:9.0,
          cellPadding:{top:4,bottom:4,left:10,right:6} } }]);

      (Array.isArray(it.items) ? it.items : []).forEach(li => {
        const lbl = li?.label || '—';
        const price = parseFloat(li?.price)||0;
        body.push([
          { content: lbl, styles:{fontSize:8, cellPadding:{top:2,bottom:2,left:10,right:5}} },
          { content: (li?.qty ? String(li.qty) : '1'), styles:{halign:'center',fontSize:8, cellPadding:{top:2,bottom:2,left:3,right:3}} },
          { content: fE(price), styles:{halign:'right',fontStyle:'bold',fontSize:8, cellPadding:{top:2,bottom:2,left:4,right:8}} },
        ]);
      });

      doc.autoTable({
        startY: y,
        head,
        body,
        theme:'plain',
        headStyles:{ fillColor:C.orange, textColor:C.black, fontStyle:'bold', fontSize:8, cellPadding:{top:3,bottom:3,left:6,right:4} },
        columnStyles:{ 0:{cellWidth:'auto'}, 1:{cellWidth:18,halign:'center'}, 2:{cellWidth:44,halign:'right'} },
        styles:{ fontSize:8, cellPadding:{top:2,bottom:2,left:8,right:5}, lineColor:[230,230,230], lineWidth:0.25 },
        alternateRowStyles:{ fillColor:[253,253,253] },
        margin:{ left:10,right:10 },
      });

      y = doc.lastAutoTable.finalY + 6;
    });
  }

  // Total box
  doc.setFillColor(...C.orange); doc.roundedRect(W-70,y,60,22,3,3,'F');
  doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text('TE BETALEN',W-40,y+8,{align:'center'});
  doc.setFontSize(14); doc.setFont(undefined,'bold'); doc.text(`€ ${f2(voorschotTotal)}`,W-40,y+18,{align:'center'});
  y+=32;
  // Payment info
  if(companyIban){
    doc.setFillColor(245,245,245); doc.roundedRect(10,y,W-20,18,2,2,'F');
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black); doc.text('BETAALINFORMATIE',16,y+7);
    doc.setFont(undefined,'normal'); doc.setTextColor(...C.grey);
    doc.text(`IBAN: ${companyIban}  ·  Mededeling: ${invNr}`,16,y+13);
  }
  // Footer
  doc.setFillColor(...C.black);doc.rect(0,H-10,W,10,'F');
  doc.setFillColor(...C.orange);doc.rect(0,H-10,4,10,'F');
  doc.setTextColor(140,140,140);doc.setFontSize(6.5);
  doc.text(`${companyEmail} · ${S.company_phone||'+32 (0) 465 83 72 64'} · ${S.company_website||'www.digitify.be'} · BTW: ${companyBtw}`,W/2,H-4.5,{align:'center'});
  return doc;
}

// ── OFFERTE DUPLICEREN (AJAX) ─────────────────────────────
function duplicateQuote(idx) {
  const q = QUOTES[idx];
  if (!q) return;
  const name = q.client?.bedrijf || q.client?.name || q.ref || 'deze offerte';
  showConfirm('Offerte dupliceren?', `Maak een kopie van de offerte van <strong>${esc(name)}</strong>?`, () => {
    jQuery.post(window.digitifyAdmin.ajaxUrl, {
      action: 'digitify_duplicate_quote',
      nonce:  window.digitifyAdmin.nonce,
      idx:    idx,
    }, function(response) {
      if (response.success) {
        const newQuote = response.data?.quote;
        if (newQuote) {
          QUOTES.unshift(newQuote);
          buildMonthFilter();
          render();
        }
        showToast('✓ Offerte gedupliceerd – ref: ' + (response.data?.newRef || ''));
      } else {
        alert('Fout: ' + (response.data?.msg || 'Onbekende fout'));
      }
    }).fail(function() {
      alert('Verbindingsfout – probeer opnieuw.');
    });
  });
}

// ── MAIL PREVIEW ─────────────────────────────────────────
function previewMail() {
  if (_mailIdx === null) return;
  const q = QUOTES[_mailIdx];
  if (!q) return;
  const c = q.client || {};
  const S = window.digitifyAdmin?.settings || {};
  const type = _mailType || 'geen';
  const personalMsg = (document.getElementById('mail-msg-input')?.value || '').trim();
  const subject = (document.getElementById('mail-subject-input')?.value || '').trim();

  const typeLabels = {
    offerte:  'Offerte',
    factuur:  'Factuur',
    voorstel: 'Voorstel',
    voorschot:'Voorschotfactuur',
    geen:     'Bericht',
  };
  const typeLabel = typeLabels[type] || 'Bericht';
  const clientName = c.bedrijf || c.name || 'Klant';
  const companyName = S.company_name || 'Digitify';
  const companyEmail = S.company_email || 'contact@digitify.be';

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><style>
  body{margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif}
  .wrap{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.12)}
  .hdr{background:#111;padding:20px 28px;display:flex;align-items:center;gap:12px}
  .hdr-logo{width:36px;height:36px;border-radius:6px;background:#ffaf51;display:flex;align-items:center;justify-content:center;color:#111;font-weight:bold;font-size:13px;flex-shrink:0}
  .hdr-info{}
  .hdr-name{color:#fff;font-weight:bold;font-size:16px}
  .hdr-tag{color:#ffaf51;font-size:11px}
  .accent-bar{height:4px;background:linear-gradient(90deg,#ffaf51,#ff8c00)}
  .body{padding:28px}
  .badge{display:inline-block;background:#ffaf51;color:#111;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:20px;margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px}
  .greeting{font-size:15px;color:#222;margin-bottom:12px}
  .msg-box{background:#f8f8f8;border-left:3px solid #ffaf51;padding:12px 16px;border-radius:4px;font-size:13px;color:#444;margin-bottom:18px;white-space:pre-line}
  .ref-line{font-size:12px;color:#888;margin-bottom:20px}
  .btn{display:inline-block;background:#ffaf51;color:#111;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;margin-bottom:20px}
  .footer{background:#f8f8f8;padding:16px 28px;font-size:11px;color:#999;border-top:1px solid #eee}
</style></head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-logo">D</div>
    <div class="hdr-info">
      <div class="hdr-name">${esc(companyName)}</div>
      <div class="hdr-tag">Partner in Digital Solutions</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="body">
    <span class="badge">${esc(typeLabel)}</span>
    <div class="greeting">Beste ${esc(clientName)},</div>
    ${personalMsg ? `<div class="msg-box">${esc(personalMsg)}</div>` : ''}
    <div class="ref-line">Referentie: <strong>${esc(q.ref||'—')}</strong> · Datum: ${esc(q.date||'—')}</div>
    ${type !== 'geen' ? `<a href="#" class="btn">📎 ${esc(typeLabel)} downloaden</a>` : ''}
    <p style="font-size:12px;color:#888">Met vriendelijke groeten,<br><strong>${esc(companyName)}</strong></p>
  </div>
  <div class="footer">${esc(companyEmail)} · Onderwerp: ${esc(subject)}</div>
</div>
</body></html>`;

  const modal = document.getElementById('mail-preview-modal');
  const iframe = document.getElementById('mail-preview-iframe');
  if (!modal || !iframe) return;
  iframe.srcdoc = html;
  modal.classList.add('active');
}

function closeMailPreview() {
  document.getElementById('mail-preview-modal')?.classList.remove('active');
}

// ── BIJLAGE VISUELE FEEDBACK ──────────────────────────────
function onAttachmentChange(input) {
  const display = document.getElementById('da-file-upload-display');
  if (!display) return;
  if (input.files && input.files.length) {
    const file = input.files[0];
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    display.textContent = `📎 ${file.name} (${sizeMb} MB)`;
    display.classList.add('has-file');
  } else {
    display.textContent = 'Geen bestand gekozen';
    display.classList.remove('has-file');
  }
}
