/**
 * Offerte Wizard v2 — Admin JS
 * Global admin utilities: AJAX helpers, company form, lead/contact status
 * updates, token copy, settings.
 * Depends on: OWMC_Admin (wp_localize_script)
 */
(function () {
  'use strict';

  /* ── Config ────────────────────────────────────────────────────────────── */
  const cfg = window.OWMC_Admin || {};
  const ajax = cfg.ajaxUrl || '/wp-admin/admin-ajax.php';
  const nonce = cfg.nonce || '';

  /* ── Utility ───────────────────────────────────────────────────────────── */

  /**
   * Perform an admin AJAX request.
   * @param {string} action
   * @param {object} data
   * @returns {Promise<any>}
   */
  function doAjax(action, data = {}) {
    const body = new FormData();
    body.append('action', action);
    body.append('_nonce', nonce);
    Object.entries(data).forEach(([k, v]) => body.append(k, v));

    return fetch(ajax, { method: 'POST', body, credentials: 'same-origin' })
      .then(r => r.json());
  }

  /** Show a simple WP-style notice inline. */
  function flashNotice(text, type = 'success', duration = 3000) {
    const el = document.createElement('div');
    el.className = `owmc-notice owmc-notice--${type}`;
    el.style.cssText = 'position:fixed;top:64px;right:24px;z-index:9999;min-width:240px;max-width:480px;animation:owmcFadeIn .2s ease';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  /* ── Company form toggle ───────────────────────────────────────────────── */

  function initCompanyForm() {
    const wrap    = document.getElementById('owmc-company-form-wrap');
    const showBtn = document.getElementById('owmc-add-company-btn');
    const editBtns= document.querySelectorAll('.owmc-edit-company-btn');
    const cancelBtns = document.querySelectorAll('.owmc-cancel-company-btn');
    const form    = document.getElementById('owmc-company-form');
    const title   = document.getElementById('owmc-form-title');

    if (!wrap) return;

    function showForm(data = {}) {
      wrap.classList.add('owmc-visible');
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (data.id) {
        // populate edit form
        title && (title.textContent = 'Bedrijf bewerken');
        Object.entries(data).forEach(([k, v]) => {
          const el = form.querySelector(`[name="${k}"]`);
          if (el) el.value = v;
        });
        updateColorSwatches();
      } else {
        title && (title.textContent = 'Nieuw bedrijf');
        form && form.reset();
        updateColorSwatches();
      }
    }

    showBtn && showBtn.addEventListener('click', () => showForm());

    editBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const data = JSON.parse(btn.dataset.company || '{}');
        showForm(data);
      });
    });

    cancelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.classList.remove('owmc-visible');
        form && form.reset();
      });
    });

    // Submit via AJAX
    form && form.addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());

      doAjax('owmc_save_company', data)
        .then(res => {
          if (res.success) {
            flashNotice('Bedrijf opgeslagen.');
            setTimeout(() => location.reload(), 800);
          } else {
            flashNotice(res.data?.message || 'Fout bij opslaan.', 'error');
          }
        })
        .catch(() => flashNotice('Netwerkfout.', 'error'));
    });
  }

  /* ── Color swatch sync ─────────────────────────────────────────────────── */

  function initColorPickers() {
    document.querySelectorAll('.owmc-color-swatch').forEach(swatch => {
      const target = document.getElementById(swatch.dataset.target);
      if (!target) return;

      // Init swatch background
      swatch.style.background = target.value || '#ffffff';

      swatch.addEventListener('click', () => {
        const picker = document.createElement('input');
        picker.type  = 'color';
        picker.value = target.value || '#ffffff';
        picker.style.position = 'fixed';
        picker.style.opacity  = '0';
        picker.style.pointerEvents = 'none';
        document.body.appendChild(picker);
        picker.click();
        picker.addEventListener('input', () => {
          target.value = picker.value;
          swatch.style.background = picker.value;
        });
        picker.addEventListener('change', () => picker.remove());
      });

      target.addEventListener('input', () => {
        swatch.style.background = target.value;
      });
    });
  }

  function updateColorSwatches() {
    document.querySelectorAll('.owmc-color-swatch').forEach(swatch => {
      const target = document.getElementById(swatch.dataset.target);
      if (target) swatch.style.background = target.value || '#ffffff';
    });
  }

  /* ── Delete company ────────────────────────────────────────────────────── */

  function initDeleteCompany() {
    document.querySelectorAll('.owmc-delete-company-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name || 'dit bedrijf';
        if (!confirm(`Weet je zeker dat je "${name}" wilt verwijderen?`)) return;

        doAjax('owmc_delete_company', { id: btn.dataset.id })
          .then(res => {
            if (res.success) {
              flashNotice('Bedrijf verwijderd.');
              btn.closest('tr')?.remove();
            } else {
              flashNotice(res.data?.message || 'Verwijderen mislukt.', 'error');
            }
          })
          .catch(() => flashNotice('Netwerkfout.', 'error'));
      });
    });
  }

  /* ── Lead status update ────────────────────────────────────────────────── */

  function initLeadStatus() {
    document.querySelectorAll('.owmc-lead-status-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const leadId = sel.dataset.leadId;
        doAjax('owmc_update_lead_status', { lead_id: leadId, status: sel.value })
          .then(res => {
            if (res.success) {
              flashNotice('Status bijgewerkt.');
              // Update badge in row
              const badge = sel.closest('tr')?.querySelector('.owmc-badge');
              if (badge) {
                badge.className = 'owmc-badge owmc-badge--' + sel.value.replace(/\s+/g, '-').toLowerCase();
                badge.textContent = sel.options[sel.selectedIndex].text;
              }
            } else {
              flashNotice('Update mislukt.', 'error');
              sel.value = sel.dataset.original || sel.value; // revert
            }
          })
          .catch(() => flashNotice('Netwerkfout.', 'error'));
      });

      sel.dataset.original = sel.value;
    });
  }

  /* ── Contact pipeline stage ────────────────────────────────────────────── */

  function initContactStage() {
    document.querySelectorAll('.owmc-stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const contactId = btn.dataset.contactId;
        const stage     = btn.dataset.stage;

        doAjax('owmc_update_contact_stage', { contact_id: contactId, stage })
          .then(res => {
            if (res.success) {
              // Update active button
              btn.closest('.owmc-stage-btns')?.querySelectorAll('.owmc-stage-btn').forEach(b => {
                b.classList.toggle('owmc-stage-btn--active', b === btn);
              });
              flashNotice('Pipeline bijgewerkt.');
            } else {
              flashNotice('Update mislukt.', 'error');
            }
          })
          .catch(() => flashNotice('Netwerkfout.', 'error'));
      });
    });
  }

  /* ── Contact notes save ────────────────────────────────────────────────── */

  function initContactNotes() {
    const saveBtn = document.getElementById('owmc-save-note-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', () => {
      const contactId = saveBtn.dataset.contactId;
      const notes = document.getElementById('owmc-notes-textarea')?.value || '';

      saveBtn.disabled = true;
      saveBtn.textContent = 'Opslaan…';

      doAjax('owmc_save_contact_note', { contact_id: contactId, notes })
        .then(res => {
          if (res.success) {
            flashNotice('Notitie opgeslagen.');
          } else {
            flashNotice('Opslaan mislukt.', 'error');
          }
        })
        .catch(() => flashNotice('Netwerkfout.', 'error'))
        .finally(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Opslaan';
        });
    });
  }

  /* ── Email preview ─────────────────────────────────────────────────────── */

  function initEmailPreview() {
    const btn = document.getElementById('owmc-preview-email-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const template  = document.getElementById('owmc-email-template')?.value || 'lead_notification';
      const companyId = btn.dataset.companyId || '';

      btn.disabled = true;
      btn.textContent = 'Laden…';

      doAjax('owmc_email_preview', { template, company_id: companyId })
        .then(res => {
          if (res.success && res.data?.html) {
            const win = window.open('', '_blank', 'width=700,height=600,scrollbars=yes');
            if (win) {
              win.document.write(res.data.html);
              win.document.close();
            }
          } else {
            flashNotice('Preview laden mislukt.', 'error');
          }
        })
        .catch(() => flashNotice('Netwerkfout.', 'error'))
        .finally(() => {
          btn.disabled = false;
          btn.textContent = 'Preview';
        });
    });
  }

  /* ── API token copy ────────────────────────────────────────────────────── */

  function initTokenCopy() {
    const copyBtn = document.getElementById('owmc-copy-token-btn');
    const tokenEl = document.getElementById('owmc-token-value');
    if (!copyBtn || !tokenEl) return;

    copyBtn.addEventListener('click', () => {
      const text = tokenEl.textContent.trim();
      if (!text) return;

      navigator.clipboard.writeText(text)
        .then(() => {
          const orig = copyBtn.textContent;
          copyBtn.textContent = '✓ Gekopieerd';
          setTimeout(() => { copyBtn.textContent = orig; }, 1800);
        })
        .catch(() => {
          // Fallback for older browsers
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity  = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          flashNotice('Token gekopieerd.');
        });
    });
  }

  /* ── Settings form save ────────────────────────────────────────────────── */

  function initSettingsForm() {
    const form = document.getElementById('owmc-settings-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Opslaan…'; }

      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());

      doAjax('owmc_save_settings', data)
        .then(res => {
          if (res.success) {
            flashNotice('Instellingen opgeslagen.');
          } else {
            flashNotice(res.data?.message || 'Fout bij opslaan.', 'error');
          }
        })
        .catch(() => flashNotice('Netwerkfout.', 'error'))
        .finally(() => {
          if (btn) { btn.disabled = false; btn.textContent = 'Opslaan'; }
        });
    });
  }

  /* ── Confirm deletes ───────────────────────────────────────────────────── */

  function initConfirmDeletes() {
    document.querySelectorAll('[data-confirm]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (!confirm(el.dataset.confirm)) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    });
  }

  /* ── Leads export ──────────────────────────────────────────────────────── */

  function initLeadsExport() {
    const exportBtn = document.getElementById('owmc-export-csv-btn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
      const params = new URLSearchParams(window.location.search);
      params.set('action', 'export');
      window.location.href = window.location.pathname + '?' + params.toString();
    });
  }

  /* ── Table row click to detail ─────────────────────────────────────────── */

  function initRowLinks() {
    document.querySelectorAll('[data-row-href]').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, select, .owmc-table-actions')) return;
        window.location.href = row.dataset.rowHref;
      });
    });
  }

  /* ── Auto-expand textarea ──────────────────────────────────────────────── */

  function initAutoTextarea() {
    document.querySelectorAll('textarea[data-autoresize]').forEach(ta => {
      function resize() {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      }
      ta.addEventListener('input', resize);
      resize();
    });
  }

  /* ── Init ──────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    initCompanyForm();
    initColorPickers();
    initDeleteCompany();
    initLeadStatus();
    initContactStage();
    initContactNotes();
    initEmailPreview();
    initTokenCopy();
    initSettingsForm();
    initConfirmDeletes();
    initLeadsExport();
    initRowLinks();
    initAutoTextarea();
  });

})();
