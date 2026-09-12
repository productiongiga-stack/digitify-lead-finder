
/* global OWMC */
(() => {
  if (!window.OWMC) return;
  const cfg = window.OWMC;

  // Prevent running inside Elementor editor/preview (can break layout of the builder UI)
  try {
    const isElementor = (window.elementorFrontend && typeof window.elementorFrontend.isEditMode === "function" && window.elementorFrontend.isEditMode())
      || (document.body && (document.body.classList.contains('elementor-editor-active') || document.body.classList.contains('elementor-editor-preview')));
    if (isElementor) return;
  } catch(e) {}

  // Apply theme variables (scoped to the wizard wrapper to avoid leaking to the whole page)
  const root = document.querySelector('.owmc-wrap') || document.documentElement;
  const theme = cfg.theme || {};
  root.style.setProperty('--owmc-primary', theme.primary || '#f7c600');
  root.style.setProperty('--owmc-focus', `color-mix(in srgb, ${theme.primary || '#f7c600'} 22%, transparent)`);
  root.style.setProperty('--owmc-primary-weak', `color-mix(in srgb, ${theme.primary || '#f7c600'} 18%, transparent)`);
  root.style.setProperty('--owmc-bg', theme.bg || '#f6f7f9');
  root.style.setProperty('--owmc-card', theme.card || '#ffffff');
  root.style.setProperty('--owmc-text', theme.text || '#111318');
  root.style.setProperty('--owmc-muted', theme.muted || '#5b6472');
  root.style.setProperty('--owmc-border', theme.border || 'rgba(17,19,24,.10)');

  const schema = cfg.wizard || {};
  const meta = schema.meta || {};
  const services = Array.isArray(schema.services) ? schema.services : [];

  const steps = (meta.stepLabels && meta.stepLabels.length === 4)
    ? meta.stepLabels.map((l, i) => ({ n:i+1, label: l }))
    : [{n:1,label:"Diensten"},{n:2,label:"Details"},{n:3,label:"Locatie"},{n:4,label:"Contact"}];

  const state = {
    step: 1,
    diensten: new Set(),
    details: {}, // per service id: { key: value }
    pand:   { type:"", eigendom:"", postcode:"", stad:"" },
    contact:{ naam:"", email:"", tel:"", opmerkingen:"" },
    _hp: ""
  };

  // init details map
  services.forEach(s => { state.details[s.id] = {}; });

  const $ = (sel, root=document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function toast(msg){
    const t = $("#owmc-toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window.__owmc_tto);
    window.__owmc_tto = setTimeout(()=>t.classList.remove("show"), 2400);
  }
  function setStep(n){
    state.step = n;
    render();
    window.scrollTo({top: 0, behavior: "smooth"});
  }

  function requiredOk(){
    if(state.step === 1){
      return state.diensten.size > 0;
    }
    if(state.step === 2){
      for(const id of state.diensten){
        const s = services.find(x => x.id === id);
        if(!s) continue;
        const qs = Array.isArray(s.questions) ? s.questions : [];
        for(const q of qs){
          if(q.required){
            const v = state.details[id]?.[q.key];
            if(v === undefined || v === null || String(v).trim() === "") return false;
          }
        }
      }
      return true;
    }
    if(state.step === 3){
      return !!state.pand.type && !!state.pand.eigendom && !!state.pand.postcode && !!state.pand.stad;
    }
    if(state.step === 4){
      const c = state.contact;
      return !!c.naam && !!c.email && !!c.tel;
    }
    return true;
  }

  function serializePayload(){
    const diensten = Array.from(state.diensten);
    const details = {};
    diensten.forEach(id => { details[id] = state.details[id] || {}; });

    return {
      company: (cfg.company && cfg.company.slug) ? cfg.company.slug : 'default',
      diensten,
      details,
      pand: state.pand,
      contact: state.contact,
      _hp: state._hp,
      meta: {
        userAgent: navigator.userAgent,
        createdAt: new Date().toISOString(),
        page: location.href,
        wizardVersion: meta.version || 1
      }
    };
  }

  async function submit(){
    if(!requiredOk()){
      toast(cfg.i18n?.required || "Vul eerst alle verplichte velden in.");
      return;
    }
    const payload = serializePayload();

    try{
      const res = await fetch(cfg.restUrl, {
        method:"POST",
        headers: {
          "Content-Type":"application/json",
          "X-LEAD-TOKEN": cfg.token || ""
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(()=> ({}));
      if(!res.ok){
        throw new Error(data?.message || ("Submit failed: " + res.status));
      }
      toast(cfg.i18n?.sent || "Verzonden! We nemen zo snel mogelijk contact op.");
      renderSuccess();
    }catch(err){
      console.error(err);
      toast(cfg.i18n?.failed || "Verzenden mislukt. Controleer instellingen.");
    }
  }

  function renderStepper(){
    const el = $("#owmc-stepper");
    if (!el) return;
    el.innerHTML = "";
    steps.forEach((s, idx) => {
      const isDone = state.step > s.n;
      const isActive = state.step === s.n;

      const dot = document.createElement("div");
      dot.className = "owmc-dot " + (isDone ? "done" : isActive ? "active" : "");
      dot.textContent = isDone ? "✓" : String(s.n);

      const label = document.createElement("div");
      label.className = "owmc-label";
      label.textContent = s.label;

      const stepEl = document.createElement("div");
      stepEl.className = "owmc-step";
      stepEl.appendChild(dot);
      stepEl.appendChild(label);

      el.appendChild(stepEl);

      if(idx < steps.length - 1){
        const line = document.createElement("div");
        line.className = "owmc-line " + (isDone ? "done" : "");
        el.appendChild(line);
      }
    });
  }

  function chip(text, active){
    return `<div class="owmc-chip ${active ? "active" : ""}" data-chip="${esc(text)}">${esc(text)}</div>`;
  }

  function step1(){
    const cards = services.map(s => `
      <div class="owmc-svc ${state.diensten.has(s.id) ? "selected" : ""}" data-toggle="${esc(s.id)}" role="button" tabindex="0" aria-pressed="${state.diensten.has(s.id)}">
        <div class="owmc-icon" aria-hidden="true">${esc(s.icon || "•")}</div>
        <div class="owmc-title">${esc(s.title || s.id)}</div>
        <div class="owmc-desc">${esc(s.desc || "")}</div>
      </div>
    `).join("");

    const title = meta.step1?.title || cfg.copy?.pageTitle || "Welke werken wenst u?";
    const sub = meta.step1?.subtitle || cfg.copy?.pageSubtitle || "Selecteer één of meerdere diensten. Daarna stellen we enkele korte vragen om uw aanvraag correct te kunnen inschatten.";

    return `
      <div class="owmc-h1">${esc(title)}</div>
      <p class="owmc-sub">${esc(sub)}</p>

      <div class="owmc-grid">${cards}</div>

      <div class="owmc-divider"></div>

      <div class="owmc-actions">
        <button class="owmc-btn" id="owmc-prev" disabled>← Vorige</button>
        <button class="owmc-btn primary" id="owmc-next" ${requiredOk() ? "" : "disabled"}>Volgende →</button>
      </div>
    `;
  }

  function renderField(serviceId, q){
    const id = `q_${serviceId}_${q.key}`;
    const value = state.details[serviceId]?.[q.key] ?? "";
    const req = q.required ? " *" : "";
    const label = `${esc(q.label || q.key)}${req}`;

    if(q.type === "select"){
      const options = Array.isArray(q.options) ? q.options : [];
      return `
        <div class="owmc-field">
          <div class="owmc-label2">${label}</div>
          <select class="owmc-select" id="${esc(id)}">
            <option value="">Selecteer...</option>
            ${options.map(o => `<option value="${esc(o)}" ${String(value)===String(o)?"selected":""}>${esc(o)}</option>`).join("")}
          </select>
        </div>`;
    }

    if(q.type === "chips"){
      const options = Array.isArray(q.options) ? q.options : [];
      return `
        <div class="owmc-field">
          <div class="owmc-label2">${label}</div>
          <div class="owmc-chips" data-chip-group="${esc(id)}">
            ${options.map(o => chip(o, String(value)===String(o))).join("")}
          </div>
        </div>`;
    }

    if(q.type === "textarea"){
      return `
        <div class="owmc-field">
          <div class="owmc-label2">${label}</div>
          <textarea class="owmc-textarea" id="${esc(id)}" placeholder="${esc(q.placeholder || "")}">${esc(value)}</textarea>
        </div>`;
    }

    // default: text/number
    const t = q.type === "number" ? "number" : "text";
    const inputmode = q.type === "number" ? ' inputmode="numeric"' : '';
    return `
      <div class="owmc-field">
        <div class="owmc-label2">${label}</div>
        <input class="owmc-input" id="${esc(id)}" type="${t}"${inputmode} placeholder="${esc(q.placeholder || "")}" value="${esc(value)}" />
      </div>`;
  }

  function step2(){
    const blocks = [];
    for(const id of state.diensten){
      const s = services.find(x => x.id === id);
      if(!s) continue;
      const qs = Array.isArray(s.questions) ? s.questions : [];
      blocks.push(`
        <div class="owmc-sectionTitle">${esc(s.title || id)}</div>
        ${qs.map(q => renderField(id, q)).join("")}
      `);
    }

    const title = meta.step2?.title || "Projectdetails";
    const sub = meta.step2?.subtitle || "Nog enkele korte vragen zodat we snel en correct kunnen inschatten.";

    return `
      <div class="owmc-h1">${esc(title)}</div>
      <p class="owmc-sub">${esc(sub)}</p>

      ${blocks.length ? blocks.join('<div class="owmc-divider"></div>') : '<p class="owmc-sub">Geen diensten geselecteerd.</p>'}

      <div class="owmc-divider"></div>

      <div class="owmc-actions">
        <button class="owmc-btn" id="owmc-prev">← Vorige</button>
        <button class="owmc-btn primary" id="owmc-next" ${requiredOk() ? "" : "disabled"}>Volgende →</button>
      </div>
    `;
  }

  function step3(){
    const loc = schema.location || {};
    const labels = loc.labels || {};
    const propertyTypes = Array.isArray(loc.propertyTypes) ? loc.propertyTypes : ["Woning","Appartement","Commercieel","Industrieel"];
    const ownershipOptions = Array.isArray(loc.ownershipOptions) ? loc.ownershipOptions : ["Eigenaar","Huurder","Syndicus"];

    const title = meta.step3?.title || "Locatie";
    const sub = meta.step3?.subtitle || "Geef ons de basisinfo over de werf.";

    return `
      <div class="owmc-h1">${esc(title)}</div>
      <p class="owmc-sub">${esc(sub)}</p>

      <div class="owmc-field">
        <div class="owmc-label2">${esc(labels.type || "Type pand")} *</div>
        <div class="owmc-chips" data-chip-group="pand_type">
          ${propertyTypes.map(o => chip(o, state.pand.type===o)).join("")}
        </div>
      </div>

      <div class="owmc-field">
        <div class="owmc-label2">${esc(labels.ownership || "Eigendom")} *</div>
        <select class="owmc-select" id="pand_eigendom">
          <option value="">Selecteer...</option>
          ${ownershipOptions.map(o => `<option value="${esc(o)}" ${state.pand.eigendom===o?"selected":""}>${esc(o)}</option>`).join("")}
        </select>
      </div>

      <div class="owmc-field">
        <div class="owmc-label2">${esc(labels.postcode || "Postcode")} *</div>
        <input class="owmc-input" id="pand_postcode" type="text" inputmode="numeric" placeholder="bijv. 9032" value="${esc(state.pand.postcode)}"/>
      </div>

      <div class="owmc-field">
        <div class="owmc-label2">${esc(labels.city || "Stad/Gemeente")} *</div>
        <input class="owmc-input" id="pand_stad" type="text" placeholder="bijv. Wondelgem" value="${esc(state.pand.stad)}"/>
      </div>

      <div class="owmc-divider"></div>

      <div class="owmc-actions">
        <button class="owmc-btn" id="owmc-prev">← Vorige</button>
        <button class="owmc-btn primary" id="owmc-next" ${requiredOk() ? "" : "disabled"}>Volgende →</button>
      </div>
    `;
  }

  function step4(){
    const c = schema.contact || {};
    const labels = c.labels || {};
    const title = meta.step4?.title || "Contact";
    const sub = meta.step4?.subtitle || "Na verzending nemen we zo snel mogelijk contact op voor verdere instructies en planning.";

    return `
      <div class="owmc-h1">${esc(title)}</div>
      <p class="owmc-sub">${esc(sub)}</p>

      <div class="owmc-field">
        <div class="owmc-label2">${esc(labels.name || "Naam")} *</div>
        <input class="owmc-input" id="c_naam" type="text" placeholder="Jan Janssen" value="${esc(state.contact.naam)}"/>
      </div>

      <div class="owmc-field">
        <div class="owmc-label2">${esc(labels.email || "E-mailadres")} *</div>
        <input class="owmc-input" id="c_email" type="email" placeholder="jan@voorbeeld.be" value="${esc(state.contact.email)}"/>
      </div>

      <div class="owmc-field">
        <div class="owmc-label2">${esc(labels.tel || "Telefoonnummer")} *</div>
        <input class="owmc-input" id="c_tel" type="tel" placeholder="+32 4XX XX XX XX" value="${esc(state.contact.tel)}"/>
      </div>

      <div class="owmc-field" style="display:none;">
        <div class="owmc-label2">Laat leeg (anti-spam)</div>
        <input class="owmc-input" id="c_hp" type="text" value="" autocomplete="off"/>
      </div>

      <div class="owmc-field">
        <div class="owmc-label2">${esc(labels.notes || "Extra opmerkingen")}</div>
        <textarea class="owmc-textarea" id="c_opm" placeholder="Beschrijf kort uw situatie, timing, extra info...">${esc(state.contact.opmerkingen)}</textarea>
      </div>

      <div class="owmc-divider"></div>

      <div class="owmc-actions">
        <button class="owmc-btn" id="owmc-prev">← Vorige</button>
        <button class="owmc-btn primary" id="owmc-submit" ${requiredOk() ? "" : "disabled"}>Verzenden ✈</button>
      </div>
    `;
  }

  function render(){
    const year = $("#owmc-year");
    if (year) year.textContent = String(new Date().getFullYear());
    renderStepper();

    const v = $("#owmc-view");
    if (!v) return;

    if(state.step === 1) v.innerHTML = step1();
    if(state.step === 2) v.innerHTML = step2();
    if(state.step === 3) v.innerHTML = step3();
    if(state.step === 4) v.innerHTML = step4();

    bind();
  }

  function renderSuccess(){
    renderStepper();
    const v = $("#owmc-view");
    if (!v) return;
    v.innerHTML = `
      <div class="owmc-h1">${esc(cfg.copy?.thankyouTitle || 'Bedankt!')}</div>
      <p class="owmc-sub">${esc(cfg.copy?.thankyouText || 'Uw aanvraag is goed ontvangen. We nemen zo snel mogelijk contact op voor verdere instructies en planning.')}</p>
      <div class="owmc-divider"></div>
      <button class="owmc-btn primary" id="owmc-again">${esc(cfg.i18n?.newRequest || 'Nieuwe aanvraag')}</button>
    `;
    $("#owmc-again")?.addEventListener("click", ()=>{
      state.step = 1;
      state.diensten = new Set();
      state.details = {};
      services.forEach(s => { state.details[s.id] = {}; });
      state.pand = { type:"", eigendom:"", postcode:"", stad:"" };
      state.contact = { naam:"", email:"", tel:"", opmerkingen:"" };
      state._hp = "";
      render();
    });
  }

  function bind(){
    // Step 1 toggles
    document.querySelectorAll("[data-toggle]").forEach(el=>{
      const id = el.getAttribute("data-toggle");
      const onToggle = () => {
        if(state.diensten.has(id)) state.diensten.delete(id);
        else state.diensten.add(id);
        render();
      };
      el.addEventListener("click", onToggle);
      el.addEventListener("keydown", (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); onToggle(); }});
    });

    // Dynamic chip groups (service questions + pand_type)
    document.querySelectorAll("[data-chip-group]").forEach(group=>{
      const key = group.getAttribute("data-chip-group");

      group.querySelectorAll("[data-chip]").forEach(ch=>{
        ch.addEventListener("click", ()=>{
          const val = ch.getAttribute("data-chip");

          if(key === "pand_type"){
            state.pand.type = val;
            render();
            return;
          }

          // service question chips: key format q_service_key
          if(key.startsWith("q_")){
            const parts = key.split("_"); // q, serviceId, questionKey...
            const serviceId = parts[1];
            const qKey = parts.slice(2).join("_");
            if(!state.details[serviceId]) state.details[serviceId] = {};
            state.details[serviceId][qKey] = val;
            render();
            return;
          }
        });
      });
    });

    // Attach input listeners for all dynamic question fields
    services.forEach(s=>{
      if(!state.diensten.has(s.id)) return;
      const qs = Array.isArray(s.questions) ? s.questions : [];
      qs.forEach(q=>{
        const id = `q_${s.id}_${q.key}`;
        const el = document.getElementById(id);
        if(!el) return;

        const update = (v) => {
          if(!state.details[s.id]) state.details[s.id] = {};
          state.details[s.id][q.key] = v;
          document.getElementById("owmc-next")?.toggleAttribute("disabled", !requiredOk());
          document.getElementById("owmc-submit")?.toggleAttribute("disabled", !requiredOk());
        };

        el.addEventListener("change", ()=> update(el.value));
        el.addEventListener("input",  ()=> update(el.value));
      });
    });

    // Step 3
    const eig = document.getElementById("pand_eigendom");
    eig?.addEventListener("change", ()=>{ state.pand.eigendom = eig.value; render(); });
    const pc = document.getElementById("pand_postcode");
    pc?.addEventListener("input", ()=>{ state.pand.postcode = pc.value; document.getElementById("owmc-next")?.toggleAttribute("disabled", !requiredOk()); });
    const st = document.getElementById("pand_stad");
    st?.addEventListener("input", ()=>{ state.pand.stad = st.value; document.getElementById("owmc-next")?.toggleAttribute("disabled", !requiredOk()); });

    // Step 4
    const cnaam = document.getElementById("c_naam");
    cnaam?.addEventListener("input", ()=>{ state.contact.naam = cnaam.value; document.getElementById("owmc-submit")?.toggleAttribute("disabled", !requiredOk()); });
    const cemail = document.getElementById("c_email");
    cemail?.addEventListener("input", ()=>{ state.contact.email = cemail.value; document.getElementById("owmc-submit")?.toggleAttribute("disabled", !requiredOk()); });
    const ctel = document.getElementById("c_tel");
    ctel?.addEventListener("input", ()=>{ state.contact.tel = ctel.value; document.getElementById("owmc-submit")?.toggleAttribute("disabled", !requiredOk()); });

    const hp = document.getElementById("c_hp");
    if (hp) hp.addEventListener("input", ()=>{ state._hp = hp.value; });

    const opm = document.getElementById("c_opm");
    if(opm) opm.addEventListener("input", ()=> state.contact.opmerkingen = opm.value);

    // Prev/Next/Submit
    document.getElementById("owmc-prev")?.addEventListener("click", ()=> setStep(Math.max(1, state.step - 1)));
    document.getElementById("owmc-next")?.addEventListener("click", ()=>{
      if(!requiredOk()){
        toast(cfg.i18n?.required || "Vul eerst alle verplichte velden in.");
        return;
      }
      setStep(Math.min(4, state.step + 1));
    });
    document.getElementById("owmc-submit")?.addEventListener("click", submit);
  }

  // init
  render();
})();
