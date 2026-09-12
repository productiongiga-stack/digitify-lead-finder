/**
 * Offerte Wizard v2 — Premium SaaS Frontend
 * Vanilla JS, no dependencies.
 * Config injected via OWMC global (wp_localize_script).
 */
(function () {
  'use strict';

  if (!window.OWMC) return;

  const C   = window.OWMC;
  const i18n = C.i18n || {};

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    step: 1,
    totalSteps: 4,
    services:   [],          // selected service IDs
    details:    {},          // { serviceId: { key: value } }
    location:   { type: '', ownership: '', postcode: '', city: '' },
    contact:    { naam: '', email: '', tel: '', opmerkingen: '' },
    pricing:    { subtotal: 0, btw: 0, total: 0, lines: [] },
    btwEnabled: C.pricing?.btwEnabled !== false,
    submitted:  false,
  };

  // ── DOM ────────────────────────────────────────────────────────────────────
  const view     = document.getElementById('owmc-view');
  const stepper  = document.getElementById('owmc-stepper');
  const progress = document.getElementById('owmc-progress-bar');
  const toast    = document.getElementById('owmc-toast');
  const cartCol  = document.getElementById('owmc-cart-column');
  const yearEl   = document.getElementById('owmc-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Apply theme
  applyTheme();

  // ── Theme ─────────────────────────────────────────────────────────────────
  function applyTheme() {
    const t = C.theme || {};
    const root = document.querySelector('.owmc-wrap');
    if (!root) return;
    const map = {
      '--owmc-primary':   t.primary   || '#f7c600',
      '--owmc-secondary': t.secondary || '#e5b800',
      '--owmc-bg':        t.bg        || '#f6f7f9',
      '--owmc-card':      t.card      || '#ffffff',
      '--owmc-text':      t.text      || '#111318',
      '--owmc-muted':     t.muted     || '#5b6472',
      '--owmc-border':    t.border    || 'rgba(17,19,24,.10)',
    };
    Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  function boot() {
    trackEvent('wizard_started');
    renderStep(1);
    renderCart();
  }

  // ── Step rendering ─────────────────────────────────────────────────────────
  function renderStep(n) {
    state.step = n;
    updateStepper();
    updateProgress();
    view.innerHTML = '';
    view.classList.remove('owmc-view--entering');
    void view.offsetWidth; // force reflow
    view.classList.add('owmc-view--entering');

    switch (n) {
      case 1: renderStep1(); break;
      case 2: renderStep2(); break;
      case 3: renderStep3(); break;
      case 4: renderStep4(); break;
    }
  }

  function updateStepper() {
    const schema = C.wizard || {};
    const labels = schema.meta?.stepLabels || ['Diensten', 'Details', 'Locatie', 'Contact'];
    stepper.innerHTML = '';
    for (let i = 1; i <= state.totalSteps; i++) {
      const s = document.createElement('div');
      s.className = 'owmc-step' + (i === state.step ? ' owmc-step--active' : '') + (i < state.step ? ' owmc-step--done' : '');
      s.innerHTML = `
        <div class="owmc-step-dot">${i < state.step ? '✓' : i}</div>
        <div class="owmc-step-label">${esc(labels[i - 1] || `Stap ${i}`)}</div>
      `;
      stepper.appendChild(s);
      if (i < state.totalSteps) {
        const line = document.createElement('div');
        line.className = 'owmc-step-line' + (i < state.step ? ' owmc-step-line--done' : '');
        stepper.appendChild(line);
      }
    }
  }

  function updateProgress() {
    const pct = Math.round(((state.step - 1) / state.totalSteps) * 100);
    if (progress) progress.style.width = pct + '%';
  }

  // ── Step 1: Service selection ──────────────────────────────────────────────
  function renderStep1() {
    const schema  = C.wizard || {};
    const meta    = schema.meta?.step1 || {};
    const services = schema.services || [];

    let html = stepHeader(meta.title || 'Welke werken wenst u?', meta.subtitle || '');
    html += `<div class="owmc-service-grid">`;

    services.forEach(svc => {
      const active = state.services.includes(svc.id);
      html += `
        <button class="owmc-service-card ${active ? 'owmc-service-card--selected' : ''}"
                data-id="${esc(svc.id)}" type="button" role="checkbox" aria-checked="${active}">
          <div class="owmc-service-icon">${esc(svc.icon || '🔧')}</div>
          <div class="owmc-service-title">${esc(svc.title)}</div>
          <div class="owmc-service-desc">${esc(svc.desc || '')}</div>
          <div class="owmc-service-check" aria-hidden="true">✓</div>
        </button>`;
    });

    html += `</div>`;
    html += navButtons({ next: true, nextDisabled: state.services.length === 0 });
    view.innerHTML = html;

    view.querySelectorAll('.owmc-service-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const idx = state.services.indexOf(id);
        if (idx >= 0) {
          state.services.splice(idx, 1);
          if (state.details[id]) delete state.details[id];
          btn.classList.remove('owmc-service-card--selected');
          btn.setAttribute('aria-checked', 'false');
        } else {
          state.services.push(id);
          btn.classList.add('owmc-service-card--selected');
          btn.setAttribute('aria-checked', 'true');
        }
        // Update next button
        const nextBtn = view.querySelector('.owmc-btn--next');
        if (nextBtn) nextBtn.disabled = state.services.length === 0;
        recalcPricing();
        renderCart();
      });
    });

    bindNav();
  }

  // ── Step 2: Service details ────────────────────────────────────────────────
  function renderStep2() {
    if (state.services.length === 0) { renderStep(1); return; }

    const schema   = C.wizard || {};
    const meta     = schema.meta?.step2 || {};
    const services = schema.services || [];

    let html = stepHeader(meta.title || 'Projectdetails', meta.subtitle || '');

    state.services.forEach(svcId => {
      const svc = services.find(s => s.id === svcId);
      if (!svc || !svc.questions?.length) return;

      html += `<div class="owmc-service-section">
        <div class="owmc-service-section-title">${esc(svc.icon || '')} ${esc(svc.title)}</div>`;

      svc.questions.forEach((q, qi) => {
        const saved = state.details[svcId]?.[q.key] ?? '';
        html += renderField(q, saved, `${svcId}__${q.key}`);
      });

      html += `</div>`;
    });

    html += navButtons({ back: true, next: true });
    view.innerHTML = html;
    bindDynamicFields();
    bindNav();
  }

  function renderField(q, saved, fieldId) {
    const req  = q.required ? ' <span class="owmc-req" aria-hidden="true">*</span>' : '';
    const reqA = q.required ? ' required' : '';

    let input = '';
    if (q.type === 'select') {
      input = `<select class="owmc-select" id="${fieldId}" name="${fieldId}"${reqA}>
        <option value="">Selecteer…</option>
        ${(q.options || []).map(o => `<option value="${esc(o)}" ${saved === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select>`;
    } else if (q.type === 'chips') {
      input = `<div class="owmc-chips" role="group" aria-labelledby="label-${fieldId}">
        ${(q.options || []).map(o => `
          <button type="button" class="owmc-chip ${saved === o ? 'owmc-chip--active' : ''}"
                  data-field="${fieldId}" data-value="${esc(o)}" role="radio" aria-checked="${saved === o}">
            ${esc(o)}
          </button>`).join('')}
        <input type="hidden" id="${fieldId}" name="${fieldId}" value="${esc(saved)}">
      </div>`;
    } else if (q.type === 'textarea') {
      input = `<textarea class="owmc-textarea" id="${fieldId}" name="${fieldId}" rows="3" placeholder="${esc(q.placeholder || '')}"${reqA}>${esc(saved)}</textarea>`;
    } else if (q.type === 'number') {
      input = `<input class="owmc-input" type="number" id="${fieldId}" name="${fieldId}" value="${esc(saved)}" placeholder="${esc(q.placeholder || '')}" min="0"${reqA}>`;
    } else {
      input = `<input class="owmc-input" type="text" id="${fieldId}" name="${fieldId}" value="${esc(saved)}" placeholder="${esc(q.placeholder || '')}"${reqA}>`;
    }

    return `
      <div class="owmc-field" data-field-id="${fieldId}">
        <label class="owmc-label" id="label-${fieldId}" for="${fieldId}">${esc(q.label)}${req}</label>
        ${input}
      </div>`;
  }

  // ── Step 3: Location ───────────────────────────────────────────────────────
  function renderStep3() {
    const schema  = C.wizard || {};
    const meta    = schema.meta?.step3 || {};
    const loc     = schema.location || {};
    const labels  = loc.labels  || {};
    const types   = loc.propertyTypes    || [];
    const owners  = loc.ownershipOptions || [];

    let html = stepHeader(meta.title || 'Locatie', meta.subtitle || '');
    html += `<div class="owmc-step-fields">`;

    // Type chips
    html += `<div class="owmc-field">
      <label class="owmc-label">${esc(labels.type || 'Type pand')} <span class="owmc-req">*</span></label>
      <div class="owmc-chips" role="group">
        ${types.map(t => `<button type="button" class="owmc-chip ${state.location.type === t ? 'owmc-chip--active' : ''}" data-loc="type" data-value="${esc(t)}">${esc(t)}</button>`).join('')}
        <input type="hidden" id="loc-type" value="${esc(state.location.type)}">
      </div>
    </div>`;

    // Ownership chips
    html += `<div class="owmc-field">
      <label class="owmc-label">${esc(labels.ownership || 'Eigendom')} <span class="owmc-req">*</span></label>
      <div class="owmc-chips" role="group">
        ${owners.map(o => `<button type="button" class="owmc-chip ${state.location.ownership === o ? 'owmc-chip--active' : ''}" data-loc="ownership" data-value="${esc(o)}">${esc(o)}</button>`).join('')}
        <input type="hidden" id="loc-ownership" value="${esc(state.location.ownership)}">
      </div>
    </div>`;

    // Postcode + city
    html += `
      <div class="owmc-field-row">
        <div class="owmc-field">
          <label class="owmc-label" for="loc-postcode">${esc(labels.postcode || 'Postcode')} <span class="owmc-req">*</span></label>
          <input class="owmc-input" type="text" id="loc-postcode" value="${esc(state.location.postcode)}" placeholder="9000" maxlength="6" required>
        </div>
        <div class="owmc-field owmc-field--grow">
          <label class="owmc-label" for="loc-city">${esc(labels.city || 'Stad/Gemeente')} <span class="owmc-req">*</span></label>
          <input class="owmc-input" type="text" id="loc-city" value="${esc(state.location.city)}" placeholder="Gent" required>
        </div>
      </div>`;

    html += `</div>`;
    html += navButtons({ back: true, next: true });
    view.innerHTML = html;

    // Chips for location
    view.querySelectorAll('[data-loc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const loc = btn.dataset.loc;
        const val = btn.dataset.value;
        state.location[loc] = val;
        view.querySelectorAll(`[data-loc="${loc}"]`).forEach(b => {
          b.classList.toggle('owmc-chip--active', b.dataset.value === val);
          b.setAttribute('aria-checked', b.dataset.value === val ? 'true' : 'false');
        });
        document.getElementById(`loc-${loc}`).value = val;
      });
    });

    ['postcode', 'city'].forEach(k => {
      document.getElementById(`loc-${k}`)?.addEventListener('input', e => {
        state.location[k] = e.target.value;
      });
    });

    bindNav();
  }

  // ── Step 4: Contact ────────────────────────────────────────────────────────
  function renderStep4() {
    const schema  = C.wizard || {};
    const meta    = schema.meta?.step4 || {};
    const labels  = schema.contact?.labels || {};

    let html = stepHeader(meta.title || 'Contact', meta.subtitle || '');
    html += `<div class="owmc-step-fields">`;

    const fields = [
      { id: 'naam',         label: labels.name  || 'Naam',           type: 'text',  req: true,  ph: 'Jan Janssen' },
      { id: 'email',        label: labels.email || 'E-mailadres',     type: 'email', req: true,  ph: 'jan@voorbeeld.be' },
      { id: 'tel',          label: labels.tel   || 'Telefoonnummer',  type: 'tel',   req: false, ph: '+32 470 12 34 56' },
      { id: 'opmerkingen',  label: labels.notes || 'Extra opmerkingen', type: 'textarea', req: false, ph: 'Eventuele opmerkingen…' },
    ];

    fields.forEach(f => {
      const req  = f.req ? '<span class="owmc-req">*</span>' : '';
      const reqA = f.req ? ' required' : '';
      const val  = esc(state.contact[f.id] || '');
      const input = f.type === 'textarea'
        ? `<textarea class="owmc-textarea" id="con-${f.id}" rows="3" placeholder="${esc(f.ph)}">${val}</textarea>`
        : `<input class="owmc-input" type="${f.type}" id="con-${f.id}" value="${val}" placeholder="${esc(f.ph)}"${reqA}>`;
      html += `<div class="owmc-field"><label class="owmc-label" for="con-${f.id}">${esc(f.label)} ${req}</label>${input}</div>`;
    });

    // Honeypot
    html += `<div style="position:absolute;left:-9999px;visibility:hidden"><input tabindex="-1" name="_hp" autocomplete="off"></div>`;

    html += `</div>`;
    html += navButtons({ back: true, submit: true });
    view.innerHTML = html;

    // Sync contact fields
    ['naam', 'email', 'tel', 'opmerkingen'].forEach(k => {
      document.getElementById(`con-${k}`)?.addEventListener('input', e => {
        state.contact[k] = e.target.value;
      });
    });

    bindNav();
  }

  // ── Submission ─────────────────────────────────────────────────────────────
  async function submit() {
    if (state.submitted) return;

    if (!validateStep4()) {
      showToast(i18n.required || 'Vul verplichte velden in.', 'error');
      return;
    }

    const btn = view.querySelector('.owmc-btn--submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Verzenden…'; }
    state.submitted = true;
    trackEvent('wizard_completed');

    const payload = buildPayload();

    try {
      const res = await fetch(C.restUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LEAD-TOKEN': C.token || '',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        renderSuccess();
      } else {
        state.submitted = false;
        if (btn) { btn.disabled = false; btn.textContent = i18n.submit || 'Aanvraag versturen'; }
        showToast(data.message || i18n.failed, 'error');
      }
    } catch (err) {
      state.submitted = false;
      if (btn) { btn.disabled = false; btn.textContent = i18n.submit || 'Aanvraag versturen'; }
      showToast(i18n.failed || 'Verzenden mislukt.', 'error');
    }
  }

  function buildPayload() {
    const schema   = C.wizard || {};
    const services = schema.services || [];
    const details  = {};

    state.services.forEach(id => {
      if (state.details[id]) details[id] = state.details[id];
    });

    return {
      company:  C.company.slug,
      diensten: state.services,
      details,
      pand: {
        type:      state.location.type,
        eigendom:  state.location.ownership,
        postcode:  state.location.postcode,
        stad:      state.location.city,
      },
      contact: state.contact,
      _hp: '',
      meta: {
        page:      window.location.href,
        userAgent: navigator.userAgent,
        createdAt: new Date().toISOString(),
      },
    };
  }

  function renderSuccess() {
    const copy = C.copy || {};
    if (cartCol) cartCol.style.display = 'none';
    view.innerHTML = `
      <div class="owmc-success">
        <div class="owmc-success-icon">✅</div>
        <h2 class="owmc-success-title">${esc(copy.thankyouTitle || 'Bedankt!')}</h2>
        <p class="owmc-success-text">${esc(copy.thankyouText || 'Uw aanvraag is goed ontvangen.')}</p>
        <button class="owmc-btn owmc-btn--primary" onclick="location.reload()">${esc(i18n.newRequest || 'Nieuwe aanvraag')}</button>
      </div>`;
    stepper.innerHTML = '';
    if (progress) progress.style.width = '100%';
  }

  // ── Pricing ────────────────────────────────────────────────────────────────
  function recalcPricing() {
    const schema   = C.wizard || {};
    const services = schema.services || [];
    const btwRate  = C.pricing?.btwRate || 21;
    let subtotal = 0;
    const lines = [];

    state.services.forEach(id => {
      const svc = services.find(s => s.id === id);
      if (!svc?.pricing) return;
      const pr      = svc.pricing;
      const details = state.details[id] || {};
      let price     = parseFloat(pr.base || 0);

      ['oppervlakte', 'oppervlak', 'area'].forEach(k => {
        if (details[k] && !isNaN(details[k])) price += parseFloat(pr.perM2 || 0) * parseFloat(details[k]);
      });
      ['aantal', 'inhoud', 'units'].forEach(k => {
        if (details[k] && !isNaN(details[k])) price += parseFloat(pr.perUnit || 0) * parseFloat(details[k]);
      });

      if (price > 0) {
        lines.push({ service: svc.title, price });
        subtotal += price;
      }
    });

    const btw   = state.btwEnabled ? Math.round(subtotal * btwRate) / 100 : 0;
    const total = subtotal + btw;

    state.pricing = { subtotal, btw, total, lines, btwRate };
    updateCartPricing();
  }

  function updateCartPricing() {
    const p = state.pricing;
    const fmt = n => '€' + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const subtotalEl = document.getElementById('owmc-price-subtotal');
    const btwEl      = document.getElementById('owmc-price-btw');
    const totalEl    = document.getElementById('owmc-price-total');
    const btwRow     = document.getElementById('owmc-btw-row');
    const pricingBox = document.getElementById('owmc-cart-pricing');

    if (subtotalEl) subtotalEl.textContent = fmt(p.subtotal);
    if (btwEl)      btwEl.textContent      = fmt(p.btw);
    if (totalEl)    totalEl.textContent    = fmt(p.total);
    if (btwRow)     btwRow.style.display   = state.btwEnabled ? '' : 'none';
    if (pricingBox) pricingBox.style.display = p.lines.length > 0 ? '' : 'none';
  }

  // ── Cart ───────────────────────────────────────────────────────────────────
  function renderCart() {
    const schema    = C.wizard || {};
    const services  = schema.services || [];
    const itemsEl   = document.getElementById('owmc-cart-items');
    const countEl   = document.getElementById('owmc-cart-count');
    if (!itemsEl) return;

    if (countEl) countEl.textContent = state.services.length;

    if (state.services.length === 0) {
      itemsEl.innerHTML = '<div class="owmc-cart-empty">Selecteer diensten om een indicatieve prijs te zien.</div>';
      return;
    }

    let html = '';
    state.services.forEach(id => {
      const svc = services.find(s => s.id === id);
      if (!svc) return;
      const priceLine = state.pricing.lines?.find(l => l.service === svc.title);
      html += `
        <div class="owmc-cart-item">
          <span class="owmc-cart-item-icon">${esc(svc.icon || '🔧')}</span>
          <span class="owmc-cart-item-name">${esc(svc.title)}</span>
          ${priceLine ? `<span class="owmc-cart-item-price">€${priceLine.price.toFixed(0)}</span>` : ''}
        </div>`;
    });

    itemsEl.innerHTML = html;
    updateCartPricing();

    // BTW toggle
    const btwToggle = document.getElementById('owmc-btw-toggle');
    if (btwToggle && !btwToggle.dataset.bound) {
      btwToggle.dataset.bound = '1';
      btwToggle.addEventListener('change', () => {
        state.btwEnabled = btwToggle.checked;
        recalcPricing();
        renderCart();
      });
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function bindNav() {
    view.querySelector('.owmc-btn--next')?.addEventListener('click', () => {
      if (validateCurrentStep()) {
        saveCurrentStep();
        if (state.step < state.totalSteps) renderStep(state.step + 1);
      } else {
        showToast(i18n.required || 'Vul verplichte velden in.', 'warning');
      }
    });

    view.querySelector('.owmc-btn--back')?.addEventListener('click', () => {
      saveCurrentStep();
      if (state.step > 1) renderStep(state.step - 1);
    });

    view.querySelector('.owmc-btn--submit')?.addEventListener('click', () => {
      saveCurrentStep();
      submit();
    });
  }

  function navButtons({ back = false, next = false, submit = false, nextDisabled = false }) {
    let html = '<div class="owmc-nav">';
    if (back) html += `<button class="owmc-btn owmc-btn--secondary owmc-btn--back" type="button">← ${i18n.back || 'Terug'}</button>`;
    if (next) html += `<button class="owmc-btn owmc-btn--primary owmc-btn--next" type="button" ${nextDisabled ? 'disabled' : ''}>${i18n.next || 'Volgende'} →</button>`;
    if (submit) html += `<button class="owmc-btn owmc-btn--primary owmc-btn--submit" type="button">${i18n.submit || 'Aanvraag versturen'}</button>`;
    html += '</div>';
    return html;
  }

  function stepHeader(title, subtitle) {
    return `<div class="owmc-step-header">
      <h2 class="owmc-step-title">${esc(title)}</h2>
      ${subtitle ? `<p class="owmc-step-subtitle">${esc(subtitle)}</p>` : ''}
    </div>`;
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateCurrentStep() {
    switch (state.step) {
      case 1: return state.services.length > 0;
      case 2: return validateStep2();
      case 3: return validateStep3();
      case 4: return validateStep4();
    }
    return true;
  }

  function validateStep2() {
    const schema   = C.wizard || {};
    const services = schema.services || [];
    let valid = true;

    state.services.forEach(id => {
      const svc = services.find(s => s.id === id);
      if (!svc) return;
      (svc.questions || []).forEach(q => {
        if (!q.required) return;
        const el = view.querySelector(`#${CSS.escape(id + '__' + q.key)}`);
        if (!el || !el.value.trim()) {
          el?.classList.add('owmc-input--error');
          valid = false;
        }
      });
    });
    return valid;
  }

  function validateStep3() {
    return !!(state.location.type && state.location.ownership && state.location.postcode && state.location.city);
  }

  function validateStep4() {
    const c = state.contact;
    return !!(c.naam?.trim() && c.email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));
  }

  // ── Save state from DOM ───────────────────────────────────────────────────
  function saveCurrentStep() {
    if (state.step === 2) {
      state.services.forEach(id => {
        state.details[id] = state.details[id] || {};
        view.querySelectorAll(`[id^="${CSS.escape(id + '__')}"]`).forEach(el => {
          const key = el.id.substring(id.length + 2);
          state.details[id][key] = el.value;
        });
      });
      recalcPricing();
      renderCart();
    }
    if (state.step === 3) {
      state.location.postcode = document.getElementById('loc-postcode')?.value || '';
      state.location.city     = document.getElementById('loc-city')?.value     || '';
    }
    if (state.step === 4) {
      ['naam', 'email', 'tel', 'opmerkingen'].forEach(k => {
        state.contact[k] = document.getElementById(`con-${k}`)?.value || '';
      });
    }
  }

  function bindDynamicFields() {
    // Chips in step 2
    view.querySelectorAll('.owmc-chip[data-field]').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const val   = btn.dataset.value;
        const hidden = view.querySelector(`#${CSS.escape(field)}`);
        if (hidden) hidden.value = val;
        view.querySelectorAll(`.owmc-chip[data-field="${CSS.escape(field)}"]`).forEach(b => {
          b.classList.toggle('owmc-chip--active', b.dataset.value === val);
          b.setAttribute('aria-checked', b.dataset.value === val ? 'true' : 'false');
        });
        // Save and recalc
        const [svcId, key] = field.split('__');
        if (svcId && key) {
          state.details[svcId] = state.details[svcId] || {};
          state.details[svcId][key] = val;
          recalcPricing();
          renderCart();
        }
      });
    });

    // Number/text fields trigger reprice on change
    view.querySelectorAll('input[type="number"], input[type="text"]').forEach(el => {
      el.addEventListener('input', () => {
        const parts = el.id.split('__');
        if (parts.length === 2) {
          state.details[parts[0]] = state.details[parts[0]] || {};
          state.details[parts[0]][parts[1]] = el.value;
          recalcPricing();
          renderCart();
        }
        el.classList.remove('owmc-input--error');
      });
    });
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  function trackEvent(eventName, extra = {}) {
    if (!C.eventUrl) return;
    fetch(C.eventUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-LEAD-TOKEN': C.token || '' },
      body:    JSON.stringify({ event: eventName, company: C.company?.slug, ...extra }),
    }).catch(() => {});
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, type = 'info') {
    if (!toast) return;
    toast.textContent = msg;
    toast.className   = `owmc-toast owmc-toast--${type} owmc-toast--visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('owmc-toast--visible'), 4000);
  }

  // ── Escape ─────────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  boot();
})();
