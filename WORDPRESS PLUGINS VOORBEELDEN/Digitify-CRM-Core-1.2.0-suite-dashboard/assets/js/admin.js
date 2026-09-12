/**
 * Digitify CRM Contacten — Admin JS
 * Pipeline stage + notities opslaan.
 */
(function () {
  'use strict';

  const cfg = window.DCRM_Admin || {};
  const ajax = cfg.ajaxUrl || '/wp-admin/admin-ajax.php';
  const nonce = cfg.nonce || '';

  function doAjax(action, data = {}) {
    const body = new FormData();
    body.append('action', action);
    body.append('_nonce', nonce);
    Object.entries(data).forEach(([k, v]) => body.append(k, v));
    return fetch(ajax, { method: 'POST', body, credentials: 'same-origin' }).then(r => r.json());
  }

  function flashNotice(text, type = 'success', duration = 2500) {
    const el = document.createElement('div');
    el.className = `owmc-notice owmc-notice--${type}`;
    el.style.cssText = 'position:fixed;right:16px;top:48px;z-index:99999;max-width:360px;padding:12px 14px;border-radius:12px;box-shadow:0 10px 24px rgba(0,0,0,.12);background:#fff;';
    el.innerHTML = `<strong style="display:block;margin-bottom:2px;">${type === 'success' ? 'OK' : 'Fout'}</strong>${text}`;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), duration);
  }

  // Pipeline stage: buttons inside .owmc-pipeline-select
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.owmc-pipeline-select button[data-stage]');
    if (!btn) return;

    e.preventDefault();
    const wrap = btn.closest('.owmc-pipeline-select');
    const contactId = wrap ? wrap.getAttribute('data-contact') : null;
    const stage = btn.getAttribute('data-stage');

    if (!contactId || !stage) return;

    // optimistic UI
    wrap.querySelectorAll('button').forEach(b => b.classList.remove('owmc-pipeline-btn--active'));
    btn.classList.add('owmc-pipeline-btn--active');

    doAjax('dcrm_update_contact_stage', { contact_id: contactId, stage })
      .then(res => {
        if (!res || !res.success) throw new Error((res && res.data && res.data.message) || 'Update mislukt');
        flashNotice('Pipeline fase opgeslagen.');
      })
      .catch(err => {
        flashNotice(err.message || 'Update mislukt', 'error');
      });
  });

  // Expose global function used by inline button in view
  window.dcrmSaveNote = function(contactId) {
    const textarea = document.getElementById('owmc-contact-notes');
    const note = textarea ? textarea.value : '';
    doAjax('dcrm_save_contact_note', { contact_id: contactId, note })
      .then(res => {
        if (!res || !res.success) throw new Error((res && res.data && res.data.message) || 'Opslaan mislukt');
        flashNotice('Notitie opgeslagen.');
      })
      .catch(err => flashNotice(err.message || 'Opslaan mislukt', 'error'));
  };

})();
