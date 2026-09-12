
/* global jQuery, OWMC_DEFAULT_SCHEMA */
(function($){
  const $companySlug = $("#owmc-company-slug");
  const $json = $("#owmc-json");
  const $status = $("#owmc-json-status");

  function setStatus(msg, ok){
    if(!$status.length) return;
    $status.text(msg).css({ color: ok ? "#1a7f37" : "#b42318", fontWeight: 800 });
  }

  function safeParse(v){
    try { return { ok:true, val: JSON.parse(v) }; } catch(e){ return { ok:false, err: e.message }; }
  }

  function normalizeSchema(s){
    if(!s || typeof s !== "object") s = {};
    if(!s.meta) s.meta = {};
    if(!Array.isArray(s.services)) s.services = [];
    if(!s.location) s.location = {};
    if(!s.location.labels) s.location.labels = {};
    if(!Array.isArray(s.location.propertyTypes)) s.location.propertyTypes = ["Woning","Appartement","Commercieel","Industrieel"];
    if(!Array.isArray(s.location.ownershipOptions)) s.location.ownershipOptions = ["Eigenaar","Huurder","Syndicus"];
    if(!s.contact) s.contact = {};
    if(!s.contact.labels) s.contact.labels = { name:"Naam", email:"E-mailadres", tel:"Telefoonnummer", notes:"Extra opmerkingen" };
    if(!s.meta.stepLabels || s.meta.stepLabels.length !== 4) s.meta.stepLabels = ["Diensten","Details","Locatie","Contact"];
    s.meta.version = s.meta.version || 1;
    return s;
  }

  function uid(prefix){
    return prefix + "_" + Math.random().toString(16).slice(2, 9);
  }

  function getSchema(){
    const r = safeParse($json.val());
    if(!r.ok){
      setStatus("JSON fout: " + r.err, false);
      return normalizeSchema(OWMC_DEFAULT_SCHEMA || {});
    }
    const s = normalizeSchema(r.val);
    // minimal validation
    if(!Array.isArray(s.services) || s.services.length === 0){
      setStatus("JSON ok, maar 'services' is leeg. Voeg minstens 1 dienst toe.", false);
    } else {
      setStatus("Schema geladen ✓", true);
    }
    return s;
  }

  function setSchema(s){
    $json.val(JSON.stringify(s, null, 2));
  }

  // ====== Rendering ======
  let schema = null;
  let selectedServiceId = null;
  let selectedQuestionIndex = null;

  function render(){
    schema = getSchema();
    if(!selectedServiceId && schema.services[0]) selectedServiceId = schema.services[0].id;
    if(selectedServiceId && !schema.services.find(x => x.id === selectedServiceId)){
      selectedServiceId = schema.services[0]?.id || null;
    }
    selectedQuestionIndex = null;
    renderMeta();
    renderServices();
    renderServiceEditor();
    renderLocationContact();
  }

  function renderMeta(){
    $("#owmc-step1-title").val(schema.meta.step1?.title || "");
    $("#owmc-step1-sub").val(schema.meta.step1?.subtitle || "");
    $("#owmc-step2-title").val(schema.meta.step2?.title || "");
    $("#owmc-step2-sub").val(schema.meta.step2?.subtitle || "");
    $("#owmc-step3-title").val(schema.meta.step3?.title || "");
    $("#owmc-step3-sub").val(schema.meta.step3?.subtitle || "");
    $("#owmc-step4-title").val(schema.meta.step4?.title || "");
    $("#owmc-step4-sub").val(schema.meta.step4?.subtitle || "");

    $("#owmc-step-labels").val(schema.meta.stepLabels.join(" | "));
  }

  function renderServices(){
    const $list = $("#owmc-services-list");
    $list.empty();
    schema.services.forEach(s => {
      const active = s.id === selectedServiceId;
      const $item = $(`
        <div class="owmc-item" data-id="${escapeHtml(s.id)}">
          <div class="owmc-itemMain">
            <div class="owmc-itemTitle">${escapeHtml((s.icon ? s.icon + " " : "") + (s.title || s.id))}</div>
            <div class="owmc-itemMeta">${escapeHtml(s.desc || "")} <span class="owmc-mutedSmall">· id: ${escapeHtml(s.id)}</span></div>
          </div>
          <div class="owmc-itemActions">
            <button type="button" class="owmc-iconBtn owmc-edit" title="Bewerken">✎</button>
            <button type="button" class="owmc-iconBtn danger owmc-del" title="Verwijderen">🗑</button>
          </div>
        </div>
      `);
      if(active) $item.css({ outline: "3px solid rgba(247,198,0,.22)", borderColor: "rgba(247,198,0,.55)" });
      $list.append($item);
    });

    // sortable
    $list.sortable({
      handle: ".owmc-item",
      placeholder: "owmc-item",
      update: function(){
        const ids = $list.children(".owmc-item").map((_, el)=>$(el).data("id")).get();
        schema.services = ids.map(id => schema.services.find(s => s.id === id)).filter(Boolean);
        persistAndRerender(false);
      }
    });

    // actions
    $list.off("click").on("click", ".owmc-edit", function(){
      const id = $(this).closest(".owmc-item").data("id");
      selectedServiceId = id;
      selectedQuestionIndex = null;
      renderServiceEditor();
    }).on("click", ".owmc-del", function(){
      const id = $(this).closest(".owmc-item").data("id");
      if(!confirm("Dienst verwijderen?")) return;
      schema.services = schema.services.filter(s => s.id !== id);
      if(selectedServiceId === id) selectedServiceId = schema.services[0]?.id || null;
      persistAndRerender(true);
    }).on("click", ".owmc-itemMain", function(){
      const id = $(this).closest(".owmc-item").data("id");
      selectedServiceId = id;
      selectedQuestionIndex = null;
      renderServiceEditor();
      renderServices();
    });
  }

  function renderServiceEditor(){
    const s = schema.services.find(x => x.id === selectedServiceId);
    const $wrap = $("#owmc-service-editor");
    if(!s){
      $wrap.html(`<div class="owmc-mutedSmall">Selecteer een dienst om te bewerken.</div>`);
      return;
    }

    const qs = Array.isArray(s.questions) ? s.questions : [];
    const $html = $(`
      <div>
        <div class="owmc-panelHead" style="border:none;padding:0 0 12px 0;">
          <div>
            <h2>Dienst bewerken</h2>
            <p>Pas titel, beschrijving, icoon en vragen aan.</p>
          </div>
          <div class="owmc-pill">Selected: <code>${escapeHtml(s.id)}</code></div>
        </div>

        <div class="owmc-formGrid">
          <div class="owmc-fieldRow">
            <label>ID (uniek)</label>
            <input class="owmc-inputWide" id="svc-id" value="${escapeAttr(s.id)}" />
            <div class="owmc-mutedSmall">Tip: enkel letters/cijfers/koppelteken (bv. <code>afbraak</code>).</div>
          </div>
          <div class="owmc-fieldRow">
            <label>Icoon (emoji)</label>
            <input class="owmc-inputWide" id="svc-icon" value="${escapeAttr(s.icon || "")}" placeholder="🏗️" />
          </div>
          <div class="owmc-fieldRow">
            <label>Titel</label>
            <input class="owmc-inputWide" id="svc-title" value="${escapeAttr(s.title || "")}" />
          </div>
          <div class="owmc-fieldRow">
            <label>Beschrijving</label>
            <input class="owmc-inputWide" id="svc-desc" value="${escapeAttr(s.desc || "")}" />
          </div>
        </div>

        <div class="owmc-sep"></div>

        <div class="owmc-qaHeader">
          <h3>Vragen</h3>
          <div class="owmc-toolbar">
            <button type="button" class="button button-secondary" id="q-add">+ Vraag toevoegen</button>
          </div>
        </div>

        <div class="owmc-listBox" id="owmc-questions-list"></div>

        <div class="owmc-sep"></div>

        <div id="owmc-question-editor"></div>
      </div>
    `);

    $wrap.empty().append($html);

    // render questions list
    const $qList = $("#owmc-questions-list");
    qs.forEach((q, idx) => {
      const req = q.required ? `<span class="owmc-badgeReq">Required</span>` : "";
      const $qi = $(`
        <div class="owmc-item" data-idx="${idx}">
          <div class="owmc-itemMain">
            <div class="owmc-itemTitle">${escapeHtml(q.label || q.key || ("Vraag " + (idx+1)))} ${req}</div>
            <div class="owmc-itemMeta">${escapeHtml(q.type || "text")} · key: ${escapeHtml(q.key || "")}</div>
          </div>
          <div class="owmc-itemActions">
            <button type="button" class="owmc-iconBtn owmc-q-edit" title="Bewerken">✎</button>
            <button type="button" class="owmc-iconBtn danger owmc-q-del" title="Verwijderen">🗑</button>
          </div>
        </div>
      `);
      if(selectedQuestionIndex === idx) $qi.css({ outline: "3px solid rgba(247,198,0,.22)" });
      $qList.append($qi);
    });

    $qList.sortable({
      handle: ".owmc-item",
      update: function(){
        const order = $qList.children(".owmc-item").map((_, el)=>parseInt($(el).data("idx"),10)).get();
        s.questions = order.map(i => qs[i]).filter(Boolean);
        selectedQuestionIndex = null;
        persistAndRerender(false);
      }
    });

    // bind service fields
    $("#svc-id").on("input", function(){
      const newId = slugify($(this).val());
      $(this).val(newId);
    });

    $("#svc-id,#svc-icon,#svc-title,#svc-desc").on("change input", function(){
      const oldId = s.id;
      const newId = slugify($("#svc-id").val());
      s.id = newId || oldId;
      s.icon = $("#svc-icon").val();
      s.title = $("#svc-title").val();
      s.desc = $("#svc-desc").val();
      // ensure unique id
      ensureUniqueServiceIds(schema);
      // keep selection aligned
      selectedServiceId = s.id;
      persistAndRerender(false);
    });

    // add question
    $("#q-add").on("click", function(){
      if(!Array.isArray(s.questions)) s.questions = [];
      s.questions.push({
        key: "vraag_" + (s.questions.length + 1),
        label: "Nieuwe vraag",
        type: "text",
        required: true,
        placeholder: ""
      });
      selectedQuestionIndex = s.questions.length - 1;
      persistAndRerender(true);
    });

    // question actions
    $qList.on("click", ".owmc-q-edit", function(){
      selectedQuestionIndex = parseInt($(this).closest(".owmc-item").data("idx"),10);
      renderQuestionEditor(s);
    }).on("click", ".owmc-q-del", function(){
      const idx = parseInt($(this).closest(".owmc-item").data("idx"),10);
      if(!confirm("Vraag verwijderen?")) return;
      s.questions.splice(idx, 1);
      selectedQuestionIndex = null;
      persistAndRerender(true);
    }).on("click", ".owmc-itemMain", function(){
      selectedQuestionIndex = parseInt($(this).closest(".owmc-item").data("idx"),10);
      renderQuestionEditor(s);
    });

    renderQuestionEditor(s);
    renderServices();
  }

  function renderQuestionEditor(service){
    const qs = Array.isArray(service.questions) ? service.questions : [];
    const q = (selectedQuestionIndex !== null) ? qs[selectedQuestionIndex] : null;
    const $qe = $("#owmc-question-editor");
    if(!q){
      $qe.html(`<div class="owmc-mutedSmall">Klik op een vraag om te bewerken.</div>`);
      return;
    }

    const optionsStr = Array.isArray(q.options) ? q.options.join("\n") : "";

    $qe.html(`
      <div class="owmc-panel" style="box-shadow:none;border-radius:12px;">
        <div class="owmc-panelHead">
          <div>
            <h2>Vraag bewerken</h2>
            <p>Type, key, label, verplichting en opties.</p>
          </div>
          <div class="owmc-pill">#${selectedQuestionIndex+1}</div>
        </div>
        <div class="owmc-panelBody">
          <div class="owmc-formGrid">
            <div class="owmc-fieldRow">
              <label>Key (uniek binnen dienst)</label>
              <input class="owmc-inputWide" id="q-key" value="${escapeAttr(q.key || "")}" />
            </div>
            <div class="owmc-fieldRow">
              <label>Type</label>
              <select class="owmc-selectWide" id="q-type">
                ${["text","number","select","chips","textarea"].map(t => `<option value="${t}" ${q.type===t?"selected":""}>${t}</option>`).join("")}
              </select>
            </div>
            <div class="owmc-fieldRow" style="grid-column: 1 / -1;">
              <label>Label</label>
              <input class="owmc-inputWide" id="q-label" value="${escapeAttr(q.label || "")}" />
            </div>
            <div class="owmc-fieldRow">
              <label>Required</label>
              <select class="owmc-selectWide" id="q-required">
                <option value="1" ${q.required ? "selected":""}>Ja</option>
                <option value="0" ${!q.required ? "selected":""}>Nee</option>
              </select>
            </div>
            <div class="owmc-fieldRow">
              <label>Placeholder</label>
              <input class="owmc-inputWide" id="q-placeholder" value="${escapeAttr(q.placeholder || "")}" />
            </div>
          </div>

          <div class="owmc-sep"></div>

          <div class="owmc-fieldRow">
            <label>Opties (1 per lijn) — enkel voor select/chips</label>
            <textarea class="owmc-textareaWide" id="q-options" placeholder="Optie 1\nOptie 2">${escapeHtml(optionsStr)}</textarea>
            <div class="owmc-mutedSmall">Voor <code>select</code> en <code>chips</code>. Voor andere types mag dit leeg.</div>
          </div>
        </div>
      </div>
    `);

    $("#q-key").on("input", function(){
      $(this).val(slugify($(this).val()).replace(/-/g,"_"));
    });

    $("#q-key,#q-type,#q-label,#q-required,#q-placeholder,#q-options").on("change input", function(){
      q.key = ($("#q-key").val() || "").trim();
      q.type = $("#q-type").val();
      q.label = $("#q-label").val();
      q.required = $("#q-required").val() === "1";
      q.placeholder = $("#q-placeholder").val();
      const opts = ($("#q-options").val() || "").split("\n").map(s=>s.trim()).filter(Boolean);
      q.options = (q.type === "select" || q.type === "chips") ? opts : undefined;
      persistAndRerender(false);
    });
  }

  function renderLocationContact(){
    // location/contact mini editor
    $("#loc-propertyTypes").val(schema.location.propertyTypes.join("\n"));
    $("#loc-ownership").val(schema.location.ownershipOptions.join("\n"));

    $("#loc-label-type").val(schema.location.labels.type || "Type pand");
    $("#loc-label-ownership").val(schema.location.labels.ownership || "Eigendom");
    $("#loc-label-postcode").val(schema.location.labels.postcode || "Postcode");
    $("#loc-label-city").val(schema.location.labels.city || "Stad/Gemeente");

    $("#c-label-name").val(schema.contact.labels.name || "Naam");
    $("#c-label-email").val(schema.contact.labels.email || "E-mailadres");
    $("#c-label-tel").val(schema.contact.labels.tel || "Telefoonnummer");
    $("#c-label-notes").val(schema.contact.labels.notes || "Extra opmerkingen");
  }

  // ====== Persist helper ======
  function persistAndRerender(full){
    setSchema(schema);
    if(full){
      render();
    }else{
      // just update services list highlight and status
      setStatus("Wijzigingen klaar om op te slaan ✓", true);
      renderServices();
    }
  }

  // ====== Global actions ======
  $("#owmc-add-service").on("click", function(){
    schema = getSchema();
    const newId = uniqueId(schema, "dienst");
    schema.services.push({
      id: newId,
      title: "Nieuwe dienst",
      desc: "Beschrijving",
      icon: "✨",
      questions: []
    });
    selectedServiceId = newId;
    selectedQuestionIndex = null;
    persistAndRerender(true);
  });

  $("#owmc-apply-meta").on("click", function(){
    schema = getSchema();
    schema.meta.stepLabels = ($("#owmc-step-labels").val() || "").split("|").map(s=>s.trim()).filter(Boolean);
    if(schema.meta.stepLabels.length !== 4) schema.meta.stepLabels = ["Diensten","Details","Locatie","Contact"];

    schema.meta.step1 = { title: $("#owmc-step1-title").val(), subtitle: $("#owmc-step1-sub").val() };
    schema.meta.step2 = { title: $("#owmc-step2-title").val(), subtitle: $("#owmc-step2-sub").val() };
    schema.meta.step3 = { title: $("#owmc-step3-title").val(), subtitle: $("#owmc-step3-sub").val() };
    schema.meta.step4 = { title: $("#owmc-step4-title").val(), subtitle: $("#owmc-step4-sub").val() };

    persistAndRerender(false);
  });

  $("#owmc-apply-loc").on("click", function(){
    schema = getSchema();
    schema.location.propertyTypes = ($("#loc-propertyTypes").val() || "").split("\n").map(s=>s.trim()).filter(Boolean);
    schema.location.ownershipOptions = ($("#loc-ownership").val() || "").split("\n").map(s=>s.trim()).filter(Boolean);

    schema.location.labels.type = $("#loc-label-type").val();
    schema.location.labels.ownership = $("#loc-label-ownership").val();
    schema.location.labels.postcode = $("#loc-label-postcode").val();
    schema.location.labels.city = $("#loc-label-city").val();

    schema.contact.labels.name = $("#c-label-name").val();
    schema.contact.labels.email = $("#c-label-email").val();
    schema.contact.labels.tel = $("#c-label-tel").val();
    schema.contact.labels.notes = $("#c-label-notes").val();

    persistAndRerender(false);
  });

  $("#owmc-format-json").on("click", function(){
    const r = safeParse($json.val());
    if(!r.ok){ setStatus("Kan niet formatteren: " + r.err, false); return; }
    $json.val(JSON.stringify(r.val, null, 2));
    setStatus("JSON geformatteerd ✓", true);
    render();
  });

  $("#owmc-reset-default").on("click", function(){
    if(!confirm("Reset naar default schema?")) return;
    $json.val(JSON.stringify(OWMC_DEFAULT_SCHEMA || {}, null, 2));
    setStatus("Reset naar default ✓", true);
    render();
  });

  // ====== Utils ======
  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function escapeAttr(s){ return escapeHtml(s); }
  function slugify(s){
    return String(s ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  function uniqueId(schema, base){
    const existing = new Set(schema.services.map(s=>s.id));
    let id = slugify(base);
    if(!existing.has(id)) return id;
    let i = 2;
    while(existing.has(id + "-" + i)) i++;
    return id + "-" + i;
  }
  function ensureUniqueServiceIds(schema){
    const seen = new Set();
    schema.services.forEach(s=>{
      let id = slugify(s.id || "");
      if(!id) id = uniqueId(schema, "dienst");
      if(!seen.has(id)){ seen.add(id); s.id = id; return; }
      let i=2;
      while(seen.has(id+"-"+i)) i++;
      s.id = id+"-"+i;
      seen.add(s.id);
    });
  }

  // init
  render();
})(jQuery);
