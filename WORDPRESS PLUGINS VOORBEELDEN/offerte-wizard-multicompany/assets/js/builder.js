/**
 * Offerte Wizard v2 — Wizard Builder JS
 * Visual schema editor: service/question CRUD, drag-drop ordering,
 * live preview, JSON editor sync, save.
 * Depends on: OWMC_Schema, OWMC_BuilderNonce, OWMC_CompanySlug (localized)
 */
(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────────────────────── */
  let schema = deepClone(window.OWMC_Schema || {});
  let editingServiceId   = null; // slug of service currently open in editor
  let editingQuestionIdx = null; // index within service.questions
  let dirty = false;

  /* ── Utils ──────────────────────────────────────────────────────────────── */

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function slugify(str) {
    return str.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 40);
  }

  function uid() {
    return 'svc_' + Math.random().toString(36).substring(2, 9);
  }

  function fmt(n) {
    return n != null && n !== '' ? '€' + parseFloat(n).toFixed(2) : '';
  }

  function markDirty() {
    dirty = true;
    syncJsonEditor();
    const status = document.getElementById('builder-status');
    if (status) { status.className = 'owmc-builder-status owmc-builder-status--saving'; status.textContent = '● Niet opgeslagen'; }
  }

  /* ── JSON editor sync ───────────────────────────────────────────────────── */

  function syncJsonEditor() {
    const el = document.getElementById('builder-json-editor');
    if (el) el.value = JSON.stringify(schema, null, 2);
    updateJsonStatus(true);
  }

  function parseJsonEditor() {
    const el = document.getElementById('builder-json-editor');
    if (!el) return false;
    try {
      schema = JSON.parse(el.value);
      updateJsonStatus(true);
      return true;
    } catch (e) {
      updateJsonStatus(false, e.message);
      return false;
    }
  }

  function updateJsonStatus(ok, msg = '') {
    const el = document.getElementById('builder-json-status');
    if (!el) return;
    if (ok) {
      el.className = 'owmc-json-status owmc-json-status--ok';
      el.textContent = '✓ Geldig';
    } else {
      el.className = 'owmc-json-status owmc-json-status--error';
      el.textContent = '✕ ' + msg;
    }
  }

  /* ── Step panel tabs ────────────────────────────────────────────────────── */

  function initStepTabs() {
    document.querySelectorAll('.owmc-builder-step').forEach(btn => {
      btn.addEventListener('click', () => {
        // Sync JSON editor before leaving any panel
        if (document.querySelector('#builder-panel-5.owmc-builder-panel--active')) {
          if (!parseJsonEditor()) return;
        }

        document.querySelectorAll('.owmc-builder-step').forEach(b => b.classList.remove('owmc-builder-step--active'));
        document.querySelectorAll('.owmc-builder-panel').forEach(p => p.classList.remove('owmc-builder-panel--active'));

        btn.classList.add('owmc-builder-step--active');
        const panel = document.getElementById('builder-panel-' + btn.dataset.step);
        if (panel) panel.classList.add('owmc-builder-panel--active');

        // Populate step-specific panels
        const step = parseInt(btn.dataset.step, 10);
        if (step === 1) renderServicesList();
        if (step === 2) populateCopyFields();
        if (step === 3) populateLocationFields();
        if (step === 4) populateContactFields();
        if (step === 5) syncJsonEditor();
      });
    });
  }

  /* ── Services list ──────────────────────────────────────────────────────── */

  function getServices() {
    return schema.services || [];
  }

  function renderServicesList() {
    const list = document.getElementById('builder-services-list');
    if (!list) return;
    list.innerHTML = '';

    getServices().forEach((svc, idx) => {
      const row = document.createElement('div');
      row.className = 'owmc-service-row';
      row.dataset.idx = idx;
      row.draggable = true;

      const priceStr = svc.pricing
        ? [
            svc.pricing.base   ? 'basis €' + svc.pricing.base          : '',
            svc.pricing.perM2  ? '+ €' + svc.pricing.perM2  + '/m²'    : '',
            svc.pricing.perUnit? '+ €' + svc.pricing.perUnit + '/stuk'  : '',
          ].filter(Boolean).join(' ') || '—'
        : '—';

      row.innerHTML = `
        <span class="owmc-drag-handle" title="Slepen">⠿</span>
        <span class="owmc-service-row-icon">${esc(svc.icon || '📦')}</span>
        <div class="owmc-service-row-info">
          <div class="owmc-service-row-title">${esc(svc.title || svc.id)}</div>
          <div class="owmc-service-row-desc">${esc(svc.description || '')}</div>
        </div>
        <span class="owmc-service-row-price">${esc(priceStr)}</span>
        <div class="owmc-service-row-actions">
          <button class="owmc-btn owmc-btn--ghost owmc-btn--sm" data-action="edit" title="Bewerken">✎</button>
          <button class="owmc-btn owmc-btn--ghost owmc-btn--sm" data-action="del"  title="Verwijderen" style="color:#ef4444">✕</button>
        </div>
      `;

      // Edit
      row.querySelector('[data-action="edit"]').addEventListener('click', () => openServiceEditor(idx));

      // Delete
      row.querySelector('[data-action="del"]').addEventListener('click', () => {
        if (!confirm(`"${svc.title || svc.id}" verwijderen?`)) return;
        schema.services.splice(idx, 1);
        markDirty();
        renderServicesList();
        renderPreview();
        const editor = document.getElementById('builder-service-editor');
        if (editor) editor.style.display = 'none';
      });

      // Drag-drop
      row.addEventListener('dragstart', onDragStart);
      row.addEventListener('dragover',  onDragOver);
      row.addEventListener('dragleave', onDragLeave);
      row.addEventListener('drop',      onDrop);
      row.addEventListener('dragend',   onDragEnd);

      list.appendChild(row);
    });
  }

  /* ── Drag-drop reorder ──────────────────────────────────────────────────── */

  let dragIdx = null;

  function onDragStart(e) {
    dragIdx = parseInt(this.dataset.idx, 10);
    this.classList.add('owmc-service-row--dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('owmc-service-row--over');
  }
  function onDragLeave() {
    this.classList.remove('owmc-service-row--over');
  }
  function onDrop(e) {
    e.preventDefault();
    const targetIdx = parseInt(this.dataset.idx, 10);
    this.classList.remove('owmc-service-row--over');
    if (dragIdx === null || dragIdx === targetIdx) return;

    const svcs = schema.services;
    const [moved] = svcs.splice(dragIdx, 1);
    svcs.splice(targetIdx, 0, moved);
    markDirty();
    renderServicesList();
    renderPreview();
  }
  function onDragEnd() {
    document.querySelectorAll('.owmc-service-row').forEach(r => {
      r.classList.remove('owmc-service-row--dragging', 'owmc-service-row--over');
    });
    dragIdx = null;
  }

  /* ── Add service ────────────────────────────────────────────────────────── */

  function initAddService() {
    const btn = document.getElementById('builder-add-service');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!schema.services) schema.services = [];
      const newSvc = {
        id:          uid(),
        title:       'Nieuwe dienst',
        description: '',
        icon:        '📦',
        pricing:     { base: 0, perM2: 0, perUnit: 0 },
        questions:   [],
      };
      schema.services.push(newSvc);
      markDirty();
      renderServicesList();
      openServiceEditor(schema.services.length - 1);
      renderPreview();
    });
  }

  /* ── Service editor ─────────────────────────────────────────────────────── */

  function openServiceEditor(idx) {
    const svc    = (schema.services || [])[idx];
    const editor = document.getElementById('builder-service-editor');
    if (!svc || !editor) return;

    editingServiceId = idx;
    editor.style.display = '';
    editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    document.getElementById('svc-title').value  = svc.title       || '';
    document.getElementById('svc-desc').value   = svc.description || '';
    document.getElementById('svc-icon').value   = svc.icon        || '';
    document.getElementById('svc-id').value     = svc.id          || '';
    document.getElementById('svc-price-base').value  = svc.pricing?.base   ?? '';
    document.getElementById('svc-price-m2').value    = svc.pricing?.perM2  ?? '';
    document.getElementById('svc-price-unit').value  = svc.pricing?.perUnit ?? '';

    renderQuestionsList(svc);
  }

  window.owmcBuilderCloseServiceEditor = function () {
    const editor = document.getElementById('builder-service-editor');
    if (editor) editor.style.display = 'none';
    editingServiceId = null;
  };

  window.owmcBuilderSaveService = function () {
    if (editingServiceId === null) return;
    const svc = (schema.services || [])[editingServiceId];
    if (!svc) return;

    svc.title       = document.getElementById('svc-title').value.trim();
    svc.description = document.getElementById('svc-desc').value.trim();
    svc.icon        = document.getElementById('svc-icon').value.trim() || '📦';
    // id is readonly — not changed

    const base   = parseFloat(document.getElementById('svc-price-base').value) || 0;
    const perM2  = parseFloat(document.getElementById('svc-price-m2').value)   || 0;
    const perUnit= parseFloat(document.getElementById('svc-price-unit').value) || 0;
    svc.pricing = { base, perM2, perUnit };

    markDirty();
    renderServicesList();
    renderPreview();
    window.owmcBuilderCloseServiceEditor();
  };

  /* ── Questions list ─────────────────────────────────────────────────────── */

  function renderQuestionsList(svc) {
    const list = document.getElementById('builder-questions-list');
    if (!list) return;
    list.innerHTML = '';

    (svc.questions || []).forEach((q, qi) => {
      const row = document.createElement('div');
      row.className = 'owmc-question-row';
      row.innerHTML = `
        <span class="owmc-drag-handle">⠿</span>
        <span class="owmc-question-row-label">${esc(q.label || q.id)}</span>
        <span class="owmc-question-row-type">${esc(q.type || 'text')}</span>
        <div class="owmc-question-row-actions">
          <button class="owmc-btn owmc-btn--ghost owmc-btn--sm" data-action="edit">✎</button>
          <button class="owmc-btn owmc-btn--ghost owmc-btn--sm" data-action="del" style="color:#ef4444">✕</button>
        </div>
      `;

      row.querySelector('[data-action="edit"]').addEventListener('click', () => {
        openQuestionEditor(svc, qi, row);
      });
      row.querySelector('[data-action="del"]').addEventListener('click', () => {
        svc.questions.splice(qi, 1);
        markDirty();
        renderQuestionsList(svc);
      });

      list.appendChild(row);
    });
  }

  function initAddQuestion() {
    const btn = document.getElementById('builder-add-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (editingServiceId === null) return;
      const svc = (schema.services || [])[editingServiceId];
      if (!svc) return;
      if (!svc.questions) svc.questions = [];
      svc.questions.push({
        id:       'q_' + Math.random().toString(36).substring(2, 6),
        type:     'chips',
        label:    'Nieuwe vraag',
        required: false,
        options:  [],
      });
      markDirty();
      renderQuestionsList(svc);
    });
  }

  /* ── Question inline editor ─────────────────────────────────────────────── */

  function openQuestionEditor(svc, qi, afterRow) {
    // Remove any existing editor
    document.querySelectorAll('.owmc-question-editor').forEach(el => el.remove());

    const q = svc.questions[qi];
    const div = document.createElement('div');
    div.className = 'owmc-question-editor';

    div.innerHTML = `
      <div class="owmc-question-editor-grid">
        <div class="owmc-field">
          <label class="owmc-label">Label</label>
          <input class="owmc-input" id="qe-label" type="text" value="${esc(q.label || '')}">
        </div>
        <div class="owmc-field">
          <label class="owmc-label">ID</label>
          <input class="owmc-input" id="qe-id" type="text" value="${esc(q.id || '')}">
        </div>
        <div class="owmc-field">
          <label class="owmc-label">Type</label>
          <select class="owmc-select" id="qe-type">
            <option value="chips"   ${q.type === 'chips'    ? 'selected' : ''}>Chips (multi-keuze)</option>
            <option value="select"  ${q.type === 'select'   ? 'selected' : ''}>Dropdown</option>
            <option value="number"  ${q.type === 'number'   ? 'selected' : ''}>Getal</option>
            <option value="text"    ${q.type === 'text'     ? 'selected' : ''}>Tekst</option>
            <option value="textarea"${q.type === 'textarea' ? 'selected' : ''}>Tekstgebied</option>
          </select>
        </div>
      </div>
      <div id="qe-options-wrap">
        <label class="owmc-label">Opties (één per regel)</label>
        <textarea class="owmc-textarea" id="qe-options" rows="4" style="font-size:13px">${(q.options || []).join('\n')}</textarea>
      </div>
      <div class="owmc-form-actions" style="margin-top:10px;padding-top:10px">
        <button class="owmc-btn owmc-btn--ghost owmc-btn--sm" id="qe-cancel">Annuleren</button>
        <button class="owmc-btn owmc-btn--primary owmc-btn--sm" id="qe-save">Opslaan</button>
      </div>
    `;

    afterRow.insertAdjacentElement('afterend', div);

    // Show/hide options based on type
    const typeEl    = div.querySelector('#qe-type');
    const optsWrap  = div.querySelector('#qe-options-wrap');
    function toggleOpts() {
      const show = ['chips', 'select'].includes(typeEl.value);
      optsWrap.style.display = show ? '' : 'none';
    }
    typeEl.addEventListener('change', toggleOpts);
    toggleOpts();

    // Save
    div.querySelector('#qe-save').addEventListener('click', () => {
      q.label   = div.querySelector('#qe-label').value.trim();
      q.id      = div.querySelector('#qe-id').value.trim() || slugify(q.label) || 'q_' + qi;
      q.type    = typeEl.value;
      q.options = div.querySelector('#qe-options').value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      markDirty();
      renderQuestionsList(svc);
      div.remove();
    });

    div.querySelector('#qe-cancel').addEventListener('click', () => div.remove());
  }

  /* ── Step copy fields (panel 2) ─────────────────────────────────────────── */

  function populateCopyFields() {
    for (let s = 1; s <= 4; s++) {
      const steps = schema.steps || {};
      const step  = steps[s] || {};
      const titleEl    = document.getElementById(`step${s}-title`);
      const subtitleEl = document.getElementById(`step${s}-subtitle`);
      if (titleEl)    titleEl.value    = step.title    || '';
      if (subtitleEl) subtitleEl.value = step.subtitle || '';
    }
  }

  function initCopyFields() {
    document.querySelectorAll('[data-step][data-key]').forEach(input => {
      input.addEventListener('input', () => {
        const s   = input.dataset.step;
        const key = input.dataset.key;
        if (!schema.steps) schema.steps = {};
        if (!schema.steps[s]) schema.steps[s] = {};
        schema.steps[s][key] = input.value;
        markDirty();
        renderPreview();
      });
    });
  }

  /* ── Location & contact label fields (panels 3 & 4) ────────────────────── */

  function populateLocationFields() {
    const loc = schema.location || {};
    setVal('loc-label-type',      loc.labelType      || '');
    setVal('loc-label-ownership', loc.labelOwnership || '');
    setVal('loc-label-postcode',  loc.labelPostcode  || '');
    setVal('loc-label-city',      loc.labelCity      || '');
  }

  function populateContactFields() {
    const con = schema.contact || {};
    setVal('con-label-name',  con.labelName  || '');
    setVal('con-label-email', con.labelEmail || '');
    setVal('con-label-tel',   con.labelTel   || '');
    setVal('con-label-notes', con.labelNotes || '');
  }

  function initLabelFields() {
    const map = {
      'loc-label-type':       ['location', 'labelType'],
      'loc-label-ownership':  ['location', 'labelOwnership'],
      'loc-label-postcode':   ['location', 'labelPostcode'],
      'loc-label-city':       ['location', 'labelCity'],
      'con-label-name':       ['contact',  'labelName'],
      'con-label-email':      ['contact',  'labelEmail'],
      'con-label-tel':        ['contact',  'labelTel'],
      'con-label-notes':      ['contact',  'labelNotes'],
    };
    Object.entries(map).forEach(([id, [section, key]]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        if (!schema[section]) schema[section] = {};
        schema[section][key] = el.value;
        markDirty();
      });
    });
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  /* ── JSON panel ─────────────────────────────────────────────────────────── */

  function initJsonPanel() {
    const formatBtn = document.getElementById('builder-format-json');
    const jsonEl    = document.getElementById('builder-json-editor');
    if (!formatBtn || !jsonEl) return;

    formatBtn.addEventListener('click', () => {
      if (parseJsonEditor()) {
        syncJsonEditor();
        markDirty();
        renderPreview();
        renderServicesList();
      }
    });

    jsonEl.addEventListener('input', () => {
      try {
        schema = JSON.parse(jsonEl.value);
        updateJsonStatus(true);
        markDirty();
        renderPreview();
      } catch (e) {
        updateJsonStatus(false, e.message);
      }
    });
  }

  /* ── Live preview ───────────────────────────────────────────────────────── */

  function renderPreview() {
    const container = document.getElementById('builder-preview');
    if (!container) return;

    const svcs = getServices();
    if (!svcs.length) {
      container.innerHTML = '<p style="text-align:center;color:#9aa0aa;padding:32px 16px;font-size:13px">Voeg diensten toe om een preview te zien.</p>';
      return;
    }

    let html = `<div class="owmc-wrap"><div class="owmc-layout" style="grid-template-columns:1fr;gap:0;padding:0">`;
    html += `<div class="owmc-wizard-column"><div class="owmc-card" style="border-radius:0;box-shadow:none">`;

    // Mini stepper
    html += `<div style="display:flex;gap:0;padding:16px 20px 0;overflow-x:auto">`;
    const steps = [
      (schema.steps?.[1]?.title || 'Diensten'),
      (schema.steps?.[2]?.title || 'Details'),
      (schema.steps?.[3]?.title || 'Locatie'),
      (schema.steps?.[4]?.title || 'Contact'),
    ];
    steps.forEach((label, i) => {
      const active = i === 0;
      html += `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">
          <div style="width:28px;height:28px;border-radius:50%;border:2px solid ${active ? '#f7c600' : 'rgba(17,19,24,.12)'};background:${active ? '#f7c600' : 'transparent'};color:${active ? '#111' : '#9aa'};font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">${i + 1}</div>
          <span style="font-size:10px;color:${active ? '#111' : '#9aa'};font-weight:${active ? 700 : 500};white-space:nowrap">${esc(label)}</span>
        </div>
        ${i < steps.length - 1 ? '<div style="flex:1;height:2px;background:rgba(17,19,24,.1);min-width:16px;margin-bottom:16px"></div>' : ''}
      `;
    });
    html += `</div>`;

    // Services
    html += `<div style="padding:20px">`;
    const step1 = schema.steps?.[1] || {};
    html += `<div style="margin-bottom:16px"><div style="font-size:18px;font-weight:700;color:#111">${esc(step1.title || 'Wat kan ik voor u doen?')}</div>`;
    if (step1.subtitle) html += `<div style="font-size:13px;color:#5b6472;margin-top:4px">${esc(step1.subtitle)}</div>`;
    html += `</div>`;

    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">`;
    svcs.forEach(svc => {
      html += `
        <div style="display:flex;flex-direction:column;align-items:center;padding:14px 8px;border:2px solid rgba(17,19,24,.1);border-radius:8px;text-align:center;gap:4px">
          <span style="font-size:22px">${esc(svc.icon || '📦')}</span>
          <span style="font-size:12px;font-weight:600;color:#111">${esc(svc.title || svc.id)}</span>
          ${svc.description ? `<span style="font-size:11px;color:#5b6472">${esc(svc.description)}</span>` : ''}
        </div>
      `;
    });
    html += `</div>`;
    html += `</div></div></div></div></div>`;

    container.innerHTML = html;
  }

  /* ── Save ───────────────────────────────────────────────────────────────── */

  function initSave() {
    const saveBtn = document.getElementById('builder-save-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', () => {
      // If JSON panel is active, parse it first
      if (document.querySelector('#builder-panel-5.owmc-builder-panel--active')) {
        if (!parseJsonEditor()) {
          alert('JSON is ongeldig. Corrigeer de fouten eerst.');
          return;
        }
      }

      const jsonStr = JSON.stringify(schema);
      document.getElementById('builder-json-hidden').value = jsonStr;

      const form = document.getElementById('builder-save-form');
      if (!form) return;

      const status = document.getElementById('builder-status');
      if (status) { status.className = 'owmc-builder-status owmc-builder-status--saving'; status.textContent = 'Opslaan…'; }
      saveBtn.disabled = true;

      const fd = new FormData(form);
      fetch(form.action, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      })
        .then(r => r.text())
        .then(() => {
          dirty = false;
          if (status) { status.className = 'owmc-builder-status owmc-builder-status--saved'; status.textContent = '✓ Opgeslagen'; }
          setTimeout(() => { if (status) status.textContent = ''; }, 3000);
        })
        .catch(() => {
          if (status) { status.className = 'owmc-builder-status owmc-builder-status--error'; status.textContent = '✕ Opslaan mislukt'; }
        })
        .finally(() => { saveBtn.disabled = false; });
    });
  }

  /* ── Warn on unsaved changes ────────────────────────────────────────────── */

  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ── Escape HTML ────────────────────────────────────────────────────────── */

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    // Ensure services array exists
    if (!schema.services) schema.services = [];

    initStepTabs();
    initAddService();
    initAddQuestion();
    initCopyFields();
    initLabelFields();
    initJsonPanel();
    initSave();

    // Initial render
    renderServicesList();
    renderPreview();
    populateCopyFields();
    populateLocationFields();
    populateContactFields();
    syncJsonEditor();
  });

})();
