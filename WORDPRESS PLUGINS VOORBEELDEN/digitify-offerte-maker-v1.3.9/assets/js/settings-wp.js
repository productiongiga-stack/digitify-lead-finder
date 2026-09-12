/* ═══════════════════════════════════════════════════════
   Digitify – Settings WP (instellingen pagina)
   Laadt en slaat plugin-instellingen op via WP AJAX.
   Afhankelijk van: digitifySettings (wp_localize_script)
════════════════════════════════════════════════════════ */
'use strict';

// ── TOAST ────────────────────────────────────────────
function showSettingsToast(msg) {
  const t = document.getElementById('settings-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── TAB SWITCHING ─────────────────────────────────────
function switchTab(tab, navBtn) {
  // Old horizontal tabs (backward compat)
  document.querySelectorAll('.ds-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  // New vertical sidebar nav items
  document.querySelectorAll('.ds-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
  });
  // Panes
  document.querySelectorAll('.ds-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === 'tab-' + tab);
  });
}

// ── HELPER ───────────────────────────────────────────
function setFieldVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = val || '';
}

// ── SMTP STATUS BADGE ─────────────────────────────────
function updateSmtpBadge(s) {
  const badge     = document.getElementById('smtp-status-badge');
  const stripDot  = document.getElementById('ss-smtp-dot');
  const stripVal  = document.getElementById('ss-smtp-val');
  const tabBadge  = document.getElementById('smtp-tab-badge');
  const isOk = s && s.smtp_host && s.smtp_user;
  if (badge) {
    badge.textContent = isOk ? 'Geconfigureerd' : 'Niet geconfigureerd';
    badge.className   = 'ds-smtp-status ' + (isOk ? 'ok' : 'off');
  }
  if (stripDot) stripDot.className = 'ds-status-dot ' + (isOk ? 'ok' : '');
  if (stripVal) stripVal.textContent = isOk ? s.smtp_host : 'Niet geconfigureerd';
  if (tabBadge) tabBadge.style.display = isOk ? 'none' : '';
}

// ── INIT: LOAD SETTINGS ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Logo
  const logoImg = document.getElementById('settings-logo');
  if (logoImg && typeof LOGO_B64 !== 'undefined') logoImg.src = LOGO_B64;

  // Load pre-seeded settings from PHP (wp_localize_script)
  const s = (window.digitifySettings && window.digitifySettings.settings)
    ? window.digitifySettings.settings : {};

  // Bedrijfsgegevens
  setFieldVal('company_name',    s.company_name);
  setFieldVal('company_btw',     s.company_btw);
  setFieldVal('company_address', s.company_address);
  setFieldVal('company_city',    s.company_city);
  setFieldVal('company_email',   s.company_email);
  setFieldVal('company_phone',   s.company_phone);
  setFieldVal('company_website', s.company_website);
  setFieldVal('company_iban',    s.company_iban);

  // E-mail & SMTP
  setFieldVal('notify_email', s.notify_email);
  setFieldVal('from_name',    s.from_name);
  setFieldVal('from_email',   s.from_email);
  setFieldVal('smtp_host',    s.smtp_host);
  setFieldVal('smtp_port',    s.smtp_port);
  // Select
  const encSel = document.getElementById('smtp_enc');
  if (encSel && s.smtp_enc) encSel.value = s.smtp_enc;
  setFieldVal('smtp_user', s.smtp_user);
  // smtp_pass intentionally NOT pre-filled for security

  // Factuur
  setFieldVal('payment_days',   s.payment_days);
  setFieldVal('invoice_footer', s.invoice_footer);
  setFieldVal('offerte_prefix',  s.offerte_prefix);
  setFieldVal('invoice_prefix',  s.invoice_prefix);
  const btwSel = document.getElementById('default_btw');
  if (btwSel && s.default_btw) btwSel.value = s.default_btw;

  // Embed
  setFieldVal('embed_bg', s.embed_bg);

  // Huisstijl & PDF
  const accentVal = s.accent_color || '#ffaf51';
  setFieldVal('accent_color', accentVal);
  const accentPicker = document.getElementById('accent_color_picker');
  if (accentPicker) accentPicker.value = accentVal;

  // Systeem & Debug
  setFieldVal('quote_limit', s.quote_limit);
  const debugCheck = document.getElementById('debug_mode');
  if (debugCheck) debugCheck.checked = (s.debug_mode === '1');
  const hidePricesCheck = document.getElementById('hide_prices_ui');
  if (hidePricesCheck) hidePricesCheck.checked = (s.hide_prices_ui === '1');

  // SMTP badge + status strip
  updateSmtpBadge(s);

  // DB status strip
  const dbDot = document.getElementById('ss-db-dot');
  const dbVal = document.getElementById('ss-db-val');
  if (dbDot) dbDot.className = 'ds-status-dot ok';
  if (dbVal) dbVal.textContent = 'Beschikbaar';
});

// ── SAVE SETTINGS ─────────────────────────────────────
function saveSettings() {
  const data = {
    company_name:    (document.getElementById('company_name')?.value    || '').trim(),
    company_btw:     (document.getElementById('company_btw')?.value     || '').trim(),
    company_address: (document.getElementById('company_address')?.value || '').trim(),
    company_city:    (document.getElementById('company_city')?.value    || '').trim(),
    company_email:   (document.getElementById('company_email')?.value   || '').trim(),
    company_phone:   (document.getElementById('company_phone')?.value   || '').trim(),
    company_website: (document.getElementById('company_website')?.value || '').trim(),
    company_iban:    (document.getElementById('company_iban')?.value    || '').trim(),

    notify_email:    (document.getElementById('notify_email')?.value    || '').trim(),
    from_name:       (document.getElementById('from_name')?.value       || '').trim(),
    from_email:      (document.getElementById('from_email')?.value      || '').trim(),

    smtp_host:       (document.getElementById('smtp_host')?.value       || '').trim(),
    smtp_port:        document.getElementById('smtp_port')?.value        || '',
    smtp_enc:         document.getElementById('smtp_enc')?.value         || 'tls',
    smtp_user:       (document.getElementById('smtp_user')?.value       || '').trim(),

    payment_days:    document.getElementById('payment_days')?.value     || '',
    invoice_footer: (document.getElementById('invoice_footer')?.value  || '').trim(),

    embed_bg:       (document.getElementById('embed_bg')?.value         || '').trim(),

    // Huisstijl & PDF
    accent_color:   (document.getElementById('accent_color')?.value     || '').trim(),

    // Factuur nummering & BTW
    offerte_prefix: (document.getElementById('offerte_prefix')?.value   || '').trim(),
    invoice_prefix: (document.getElementById('invoice_prefix')?.value   || '').trim(),
    default_btw:    (document.getElementById('default_btw')?.value      || '').trim(),

    // Systeem & Debug
    quote_limit:    (document.getElementById('quote_limit')?.value      || '').trim(),
    debug_mode:     (document.getElementById('debug_mode')?.checked ? '1' : '0'),
    hide_prices_ui: (document.getElementById('hide_prices_ui')?.checked ? '1' : '0'),
  };

  // Only include password if entered (don't overwrite existing with blank)
  const pass = document.getElementById('smtp_pass')?.value || '';
  if (pass) data.smtp_pass = pass;

  // Disable all save buttons
  document.querySelectorAll('.ds-btn-save').forEach(b => { b.disabled = true; });

  jQuery.post(window.digitifySettings.ajaxUrl, {
    action:   'digitify_save_settings',
    nonce:    window.digitifySettings.nonce,
    settings: JSON.stringify(data),
  }, function(response) {
    document.querySelectorAll('.ds-btn-save').forEach(b => { b.disabled = false; });
    if (response.success) {
      showSettingsToast('✓ Instellingen opgeslagen');
      updateSmtpBadge(data);
      _showSaveStatus(true);
      // Clear password field after save
      const passEl = document.getElementById('smtp_pass');
      if (passEl) passEl.value = '';
    } else {
      showSettingsToast('⚠️ Opslaan mislukt – probeer opnieuw');
      _showSaveStatus(false);
    }
  }).fail(function() {
    document.querySelectorAll('.ds-btn-save').forEach(b => { b.disabled = false; });
    showSettingsToast('⚠️ Verbindingsfout');
    _showSaveStatus(false);
  });
}

function _showSaveStatus(ok) {
  const msg = ok ? '✓ Opgeslagen' : '⚠️ Mislukt';
  const cls = ok ? 'ds-save-status ok' : 'ds-save-status err';
  document.querySelectorAll('.ds-save-status').forEach(el => {
    el.textContent = msg; el.className = cls;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ''; el.className = 'ds-save-status'; }, 3000);
  });
}

// ── TEST SMTP ─────────────────────────────────────────
function testSmtp() {
  const emailEl  = document.getElementById('smtp-test-email');
  const resultEl = document.getElementById('smtp-test-result');
  const testBtn  = document.querySelector('button[onclick="testSmtp()"]');

  if (!emailEl || !emailEl.value.trim()) {
    showSettingsToast('⚠️ Vul een test e-mailadres in');
    return;
  }

  if (testBtn)  testBtn.disabled = true;
  if (resultEl) {
    resultEl.style.display = 'inline-flex';
    resultEl.className     = 'ds-test-result';
    resultEl.textContent   = '⏳ Versturen…';
  }

  jQuery.post(window.digitifySettings.ajaxUrl, {
    action: 'digitify_test_smtp',
    nonce:  window.digitifySettings.nonce,
    to:     emailEl.value.trim(),
  }, function(response) {
    if (testBtn) testBtn.disabled = false;
    if (resultEl) {
      if (response.success) {
        resultEl.className   = 'ds-test-result ok';
        resultEl.textContent = '✓ Test e-mail verstuurd!';
      } else {
        resultEl.className   = 'ds-test-result err';
        resultEl.textContent = '✗ ' + (response.data?.msg || 'Versturen mislukt');
      }
    }
  }).fail(function() {
    if (testBtn) testBtn.disabled = false;
    if (resultEl) {
      resultEl.className   = 'ds-test-result err';
      resultEl.textContent = '✗ Verbindingsfout';
    }
  });
}

// ── COPY SHORTCODE ────────────────────────────────────
function copyShortcode(elementId, btn) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent || el.innerText || '';
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      _btnCopied(btn);
    }).catch(() => _fallbackCopy(text, btn));
  } else {
    _fallbackCopy(text, btn);
  }
}
function _fallbackCopy(text, btn) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); _btnCopied(btn); } catch(e) {}
  document.body.removeChild(ta);
}
function _btnCopied(btn) {
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Gekopieerd!';
  btn.classList.add('copied');
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
}

// ── TOGGLE PASSWORD VISIBILITY ────────────────────────
function toggleSmtpPw(btn) {
  const input = document.getElementById('smtp_pass');
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  // Swap eye icon
  btn.innerHTML = isPass
    ? '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 3l14 14M8.5 8.6A2.5 2.5 0 0011.4 11.5M7 5.1A9 9 0 011 10s3.5 6 9 6a9 9 0 005-1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13.5 7.5A9 9 0 0119 10s-3.5 6-9 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" stroke-width="1.7"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>';
}

// ── COLOR PICKER SYNC ─────────────────────────────────
function syncColorText(val) {
  const textEl = document.getElementById('accent_color');
  if (textEl) textEl.value = val;
}

function syncColorPicker(val) {
  if (!val || !/^#[0-9a-fA-F]{3,6}$/.test(val)) return;
  const picker = document.getElementById('accent_color_picker');
  if (picker) picker.value = val;
}
