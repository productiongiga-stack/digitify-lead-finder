(function($){
  const api = (action, data, files) => new Promise((resolve,reject)=>{
    const fd = new FormData();
    fd.append('action', action);
    fd.append('nonce', DOL.nonce);
    if (data) Object.keys(data).forEach(k=>fd.append(k, data[k]));
    if (files) Object.keys(files).forEach(k=>fd.append(k, files[k]));
    $.ajax({url:DOL.ajax, method:'POST', data:fd, processData:false, contentType:false})
      .done(res=>resolve(res))
      .fail(xhr=>reject(xhr.responseJSON || {message:'Request failed'}));
  });

  const openModal = (id)=>{ $(id).attr('aria-hidden','false'); };
  const closeModal = (id)=>{ $(id).attr('aria-hidden','true'); };
  $(document).on('click','[data-dol-close]',function(){
    closeModal('#dolLeadModal'); closeModal('#dolPreviewModal'); closeModal('#dolTemplateModal');
  });
  $(document).on('click','.dol-modal-backdrop',function(){
    const $m=$(this).closest('.dol-modal'); $m.attr('aria-hidden','true');
  });

  // Leads
  const $leadsRoot = $('#dol-leads');
  let leads = [];
  let templates = [];
  let currentLead = null;

  const renderLeads = ()=>{
    const q = ($('#dolSearch').val()||'').toLowerCase();
    const st = $('#dolStatusFilter').val();
    const tag = ($('#dolTagFilter').val()||'').toLowerCase().trim();

    const rows = leads
      .filter(l=>{
        const hay = ((l.name||'')+' '+(l.email||'')+' '+(l.tags||'')).toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (st && l.status!==st) return false;
        if (tag && !((l.tags||'').toLowerCase().split(',').map(s=>s.trim()).includes(tag))) return false;
        return true;
      })
      .map(l=>{
        const last = l.last_contacted_at ? l.last_contacted_at : '—';
        return `<tr>
          <td><b>${escapeHtml(l.name||'—')}</b></td>
          <td>${escapeHtml(l.email||'')}</td>
          <td><span class="dol-badge" data-status="${escapeHtml(l.status||'nieuw')}">${escapeHtml(l.status||'nieuw')}</span></td>
          <td>${escapeHtml(l.tags||'')}</td>
          <td>${escapeHtml(String(l.contact_count||0))}</td>
          <td>${escapeHtml(last)}</td>
          <td style="text-align:right;"><button class="button dolOpenLead" data-email="${escapeHtml(l.email)}">Open</button></td>
        </tr>`;
      }).join('');

    $('#dolLeadsTable tbody').html(rows || `<tr><td colspan="7" class="dol-muted">Geen leads gevonden.</td></tr>`);
  };

  const loadLeads = ()=> api('dol_get_leads', {}).then(res=>{
    leads = (res.data && res.data.leads) ? res.data.leads : [];
    renderLeads();
  });

  const loadTemplates = ()=> api('dol_get_templates', {}).then(res=>{
    templates = (res.data && res.data.templates) ? res.data.templates : [];
    const opts = templates.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    $('#dolTemplate').html(opts);
  });

  const loadTimeline = (email)=> api('dol_get_timeline', {email}).then(res=>{
    const items = (res.data && res.data.items) ? res.data.items : [];
    if (!items.length) {
      $('#dolTimeline').html(`<div class="dol-muted">Nog geen acties.</div>`);
      return;
    }
    const html = items.map(it=>{
      const meta = it.meta ? safeJson(it.meta) : null;
      const info = meta && meta.info ? meta.info : (meta && meta.url ? meta.url : '');
      return `<div class="dol-timeline-item">
        <div class="dol-timeline-dot"></div>
        <div>
          <div><b>${escapeHtml(it.type)}</b> ${info?`<span class="dol-muted">— ${escapeHtml(info)}</span>`:''}</div>
          <div class="dol-timeline-meta">${escapeHtml(it.created_at)}</div>
        </div>
      </div>`;
    }).join('');
    $('#dolTimeline').html(html);
  });

  const setLeadForm = (l)=>{
    currentLead = l;
    $('#dolLeadModalTitle').text(l ? (l.name || l.email) : 'Nieuwe lead');
    $('#dolLeadModalSubtitle').text(l ? l.email : '');
    $('#dolName').val(l ? (l.name||'') : '');
    $('#dolEmail').val(l ? (l.email||'') : '');
    $('#dolPhone').val(l ? (l.phone||'') : '');
    $('#dolTags').val(l ? (l.tags||'') : '');
    $('#dolStatus').val(l ? (l.status||'nieuw') : 'nieuw');
    $('#dolMessage').val('');
    $('#dolCtaUrl').val(window.location.origin);
  };

  const openLead = (email)=>{
    const l = leads.find(x=>x.email===email);
    setLeadForm(l);
    openModal('#dolLeadModal');
    loadTimeline(email);
  };

  const escapeHtml = (s)=> String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const safeJson = (s)=>{ try{return JSON.parse(s);}catch(e){return null;} };

  if ($leadsRoot.length) {
    // extra AJAX endpoints registered in PHP
    $(document).on('input change', '#dolSearch,#dolStatusFilter,#dolTagFilter', renderLeads);

    $('#dolNewLead').on('click', ()=>{
      setLeadForm(null);
      openModal('#dolLeadModal');
      $('#dolTimeline').html(`<div class="dol-muted">Nog geen acties.</div>`);
    });

    $(document).on('click', '.dolOpenLead', function(){
      openLead($(this).data('email'));
    });

    $('#dolSaveLead').on('click', async ()=>{
      const email = $('#dolEmail').val().trim();
      if (!email) return alert('E-mail is verplicht.');
      const data = {
        email,
        name: $('#dolName').val(),
        phone: $('#dolPhone').val(),
        tags: $('#dolTags').val(),
        status: $('#dolStatus').val(),
      };
      try{
        const res = await api('dol_save_lead', data);
        await api('dol_get_leads', {}).then(r=>{leads=r.data.leads;});
        renderLeads();
        if (currentLead && currentLead.email) loadTimeline(email);
        alert('Opgeslagen.');
      }catch(e){ alert(e.message || 'Fout'); }
    });

    $('#dolPreview').on('click', async ()=>{
      const template_id = $('#dolTemplate').val();
      const payload = {
        template_id,
        email: $('#dolEmail').val(),
        name: $('#dolName').val(),
        message: $('#dolMessage').val(),
        cta_url: $('#dolCtaUrl').val(),
      };
      try{
        const res = await api('dol_template_preview', payload);
        const iframe = document.getElementById('dolPreviewFrame');
        iframe.srcdoc = res.data.html;
        openModal('#dolPreviewModal');
      }catch(e){ alert(e.message || 'Fout'); }
    });

    $('#dolSend').on('click', async ()=>{
      const email = $('#dolEmail').val().trim();
      if (!email) return alert('E-mail is verplicht.');
      const payload = {
        email,
        template_id: $('#dolTemplate').val(),
        message: $('#dolMessage').val(),
        cta_url: $('#dolCtaUrl').val(),
      };
      try{
        const res = await api('dol_send_email', payload);
        alert('Mail verzonden.');
        await api('dol_get_leads', {}).then(r=>{leads=r.data.leads;});
        renderLeads();
        loadTimeline(email);
      }catch(e){ alert(e.message || 'Fout bij verzenden'); }
    });

    $('#dolCsv').on('change', async function(){
      if (!this.files || !this.files[0]) return;
      try{
        const res = await api('dol_import_csv', {}, {file:this.files[0]});
        alert(`Import klaar: ${res.data.inserted} toegevoegd, ${res.data.updated} bijgewerkt, ${res.data.skipped} overgeslagen.`);
        await loadLeads();
      }catch(e){ alert(e.message || 'Import fout'); }
      this.value = '';
    });

    // initial
    loadTemplates().then(loadLeads);
  }

  // Templates
  const $tplRoot = $('#dol-templates');
  if ($tplRoot.length) {
    const openTpl = (t)=>{
      $('#dolTplId').val(t ? t.id : 0);
      $('#dolTplName').val(t ? t.name : '');
      $('#dolTplSubject').val(t ? t.subject : '');
      $('#dolTplHtml').val(t ? t.html : '');
      openModal('#dolTemplateModal');
    };

    $('#dolNewTemplate').on('click', ()=>openTpl(null));

    $(document).on('click', '.dolEditTemplate', function(){
      openTpl({
        id: $(this).data('id'),
        name: $(this).data('name'),
        subject: $(this).data('subject'),
        html: $(this).data('html'),
      });
    });

    $('#dolSaveTemplate').on('click', async ()=>{
      try{
        await api('dol_save_template', {
          id: $('#dolTplId').val(),
          name: $('#dolTplName').val(),
          subject: $('#dolTplSubject').val(),
          html: $('#dolTplHtml').val(),
        });
        location.reload();
      }catch(e){ alert(e.message || 'Opslaan fout'); }
    });
  }

})(jQuery);
