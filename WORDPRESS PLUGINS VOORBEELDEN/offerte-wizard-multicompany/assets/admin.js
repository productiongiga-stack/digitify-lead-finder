
(function($){
  function safeParse(v){
    try { return { ok:true, val: JSON.parse(v) }; } catch(e){ return { ok:false, err: e.message }; }
  }
  function setStatus(msg, ok){
    const el = $("#owmc-json-status");
    if(!el.length) return;
    el.text(msg);
    el.css({ color: ok ? "#1a7f37" : "#b42318", fontWeight: ok ? 700 : 700 });
  }
  function validateLive(){
    const ta = $("#owmc-json");
    if(!ta.length) return;
    const r = safeParse(ta.val());
    if(r.ok){
      if(!r.val.services || !Array.isArray(r.val.services) || r.val.services.length === 0){
        setStatus("JSON ok, maar 'services' ontbreekt of is leeg.", false);
      }else{
        setStatus("JSON ok ✓", true);
      }
    }else{
      setStatus("JSON fout: " + r.err, false);
    }
  }
  $(document).on("input", "#owmc-json", function(){ validateLive(); });

  $(document).on("click", "#owmc-format-json", function(){
    const ta = $("#owmc-json"); if(!ta.length) return;
    const r = safeParse(ta.val());
    if(!r.ok){ setStatus("Kan niet formatteren: " + r.err, false); return; }
    ta.val(JSON.stringify(r.val, null, 2));
    validateLive();
  });

  $(document).on("click", "#owmc-reset-default", function(){
    if(!confirm("Reset naar default schema? Je huidige wijzigingen gaan verloren (tot je opslaat).")) return;
    const ta = $("#owmc-json"); if(!ta.length) return;
    const def = window.OWMC_DEFAULT_SCHEMA || null;
    if(def){
      ta.val(JSON.stringify(def, null, 2));
      validateLive();
    }else{
      alert("Default schema niet gevonden.");
    }
  });

  $(document).on("click", "#owmc-copy-default", function(){
    const def = window.OWMC_DEFAULT_SCHEMA || null;
    if(!def){ alert("Default schema niet gevonden."); return; }
    const txt = JSON.stringify(def, null, 2);
    navigator.clipboard?.writeText(txt).then(()=> alert("Default schema gekopieerd.")).catch(()=> {
      prompt("Kopieer dit:", txt);
    });
  });

  $(function(){
    // If we are on builder page, inject default schema from a hidden script tag (added by PHP if present)
    validateLive();
  });
})(jQuery);
