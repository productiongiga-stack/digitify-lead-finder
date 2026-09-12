(function($){
  'use strict';

  // -------------------------
  // Ajax helper
  // -------------------------
  const api = (action, data={}) => $.post(
    DAP.ajaxUrl,
    Object.assign({ action, nonce: DAP.nonce }, data)
  );

  // -------------------------
  // State
  // -------------------------
  const state = {
    tab: null,
    weekKey: null,
    types: [],
    weekData: null,
    todosAll: [],
    checklist: [],
    checklistTodoId: 0,
    dark: false,
  };

  // -------------------------
  // Utils
  // -------------------------
  const pad = (n) => (n < 10 ? '0' : '') + n;

  const escapeHtml = (s) => String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');

  const minutesClamp = (m) => {
    m = parseInt(m ?? 0, 10);
    if (isNaN(m) || m < 0) m = 0;
    if (m > 999999) m = 999999;
    return m;
  };

  const formatMinutes = (mins) => {
    mins = minutesClamp(mins);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}u ${String(m).padStart(2,'0')}m`;
  };

  const parseWeekKey = (weekKey) => {
    const m = String(weekKey || '').match(/^(\d{4})-W(\d{2})$/);
    if (!m) return null;
    return { y: parseInt(m[1], 10), w: parseInt(m[2], 10) };
  };

  // ISO week to Monday (UTC to avoid DST issues)
  const weekKeyToMondayUTC = (weekKey) => {
    const p = parseWeekKey(weekKey);
    if (!p) return null;
    const simple = new Date(Date.UTC(p.y, 0, 4));
    const dow = simple.getUTCDay() || 7;
    const isoWeek1Monday = new Date(simple);
    isoWeek1Monday.setUTCDate(simple.getUTCDate() - dow + 1);
    const monday = new Date(isoWeek1Monday);
    monday.setUTCDate(isoWeek1Monday.getUTCDate() + (p.w - 1) * 7);
    return monday;
  };

  const mondayUTCToWeekKey = (mondayUTC) => {
    // Take any date, compute ISO week key (UTC)
    const d = new Date(Date.UTC(mondayUTC.getUTCFullYear(), mondayUTC.getUTCMonth(), mondayUTC.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${pad(weekNo)}`;
  };

  const shiftWeekKey = (weekKey, deltaWeeks) => {
    const monday = weekKeyToMondayUTC(weekKey);
    if (!monday) return weekKey;
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + (deltaWeeks * 7));
    return mondayUTCToWeekKey(d);
  };

  const typeLabel = (typeKey) => (state.types.find(t => t.type_key === typeKey)?.label) || typeKey;
  const typeColor = (typeKey, fallback) => (state.types.find(t => t.type_key === typeKey)?.color) || (fallback || '#64748b');

  const toInputDateTime = (mysql) => {
    if (!mysql) return '';
    const m = String(mysql).replace(' ', 'T');
    return m.slice(0, 16);
  };

  const todoMinutes = (todo) => {
    // Prefer checklist totals if present, else todo estimate
    const a = minutesClamp(todo?.checklist_minutes_total);
    if (a > 0) return a;
    return minutesClamp(todo?.estimated_minutes);
  };

  const agendaDurationMinutes = (item) => {
    const s = String(item?.start_at || '');
    const e = String(item?.end_at || '');
    if (!s || !e) return 0;
    const st = Date.parse(s.replace(' ', 'T') + 'Z');
    const en = Date.parse(e.replace(' ', 'T') + 'Z');
    if (!isFinite(st) || !isFinite(en) || en <= st) return 0;
    return minutesClamp(Math.round((en - st) / 60000));
  };

  // -------------------------
  // Modals
  // -------------------------
  const openModal = ($m) => $m.attr('aria-hidden', 'false');
  const closeModal = ($m) => $m.attr('aria-hidden', 'true');

  $(document).on('click', '[data-close]', function(){
    closeModal($(this).closest('.dap-modal'));
  });
  $(document).on('click', '.dap-modal', function(e){
    if (e.target === this) closeModal($(this));
  });
  $(document).on('keydown', function(e){
    if (e.key === 'Escape') $('.dap-modal[aria-hidden="false"]').each((_,el)=>closeModal($(el)));
  });

  // -------------------------
  // Bootstrap
  // -------------------------
  async function bootstrap(){
    const res = await api('dap_bootstrap', {}).catch(()=>null);
    if (res?.success) state.types = res.data.types || [];
  }

  // -------------------------
  // Inline todo editing (no popup)
  // -------------------------
  function startInlineTodoEdit($row, todo){
    if ($row.hasClass('dap-inline-active')) return;

    // Close other editors
    $('.dap-inline-active').each(function(){
      const $r = $(this);
      const orig = $r.data('dap-orig-html');
      if (orig) $r.html(orig);
      $r.removeClass('dap-inline-active');
    });

    const id = parseInt(todo?.id || 0, 10);
    if (!id) return;

    const origHtml = $row.html();
    $row.data('dap-orig-html', origHtml).addClass('dap-inline-active');

    const dueInput = toInputDateTime(todo?.due_at);
    const minutesVal = minutesClamp(todo?.estimated_minutes || 0);
    const colorVal = todo?.color || '#64748b';
    const statusVal = String(todo?.status || 'open');

    const editor = `
      <span class="dap-dot" style="background:${escapeHtml(colorVal)}"></span>
      <div class="dap-inline-editor" style="flex:1;min-width:0;">
        <input type="text" class="dap-ie-title" value="${escapeHtml(todo?.title || '')}" style="min-width:220px;flex:1;" />
        <input type="number" min="0" step="1" class="dap-ie-min" value="${escapeHtml(minutesVal)}" style="width:110px;" title="Minuten" />
        <select class="dap-ie-status" style="width:140px;">
          <option value="open" ${statusVal==='open'?'selected':''}>Open</option>
          <option value="done" ${statusVal==='done'?'selected':''}>Afgerond</option>
        </select>
        <input type="datetime-local" class="dap-ie-due" value="${escapeHtml(dueInput)}" style="width:190px;" />
        <input type="color" class="dap-ie-color" value="${escapeHtml(colorVal)}" title="Kleur" />
        <div class="dap-inline-actions">
          <button type="button" class="dap-inline-btn primary dap-ie-save">Opslaan</button>
          <button type="button" class="dap-inline-btn dap-ie-cancel">Annuleren</button>
          <button type="button" class="dap-inline-open" title="Details">⋯</button>
        </div>
      </div>
    `;

    $row.html(editor);

    $row.find('.dap-ie-cancel').on('click', function(e){
      e.preventDefault(); e.stopPropagation();
      $row.html(origHtml).removeClass('dap-inline-active');
    });

    $row.find('.dap-inline-open').on('click', function(e){
      e.preventDefault(); e.stopPropagation();
      fillTodoModal(todo);
      openModal($('#dap-modal-todo'));
    });

    $row.find('.dap-ie-save').on('click', async function(e){
      e.preventDefault(); e.stopPropagation();
      const title = String($row.find('.dap-ie-title').val() || '').trim();
      const minutes = minutesClamp($row.find('.dap-ie-min').val());
      const status = String($row.find('.dap-ie-status').val() || 'open');
      const dueRaw = String($row.find('.dap-ie-due').val() || '').trim();
      const dueAt = dueRaw ? dueRaw.replace('T',' ') + ':00' : '';
      const color = String($row.find('.dap-ie-color').val() || '#64748b');
      if (!title) return alert('Titel is verplicht.');
      const res = await api('dap_todo_update', { id, title, estimatedMinutes: minutes, status, dueAt, color }).catch(()=>null);
      if (!res?.success) return alert('Opslaan mislukt.');
      if (state.tab === 'todos') await loadTodos();
      if (state.tab === 'week') await loadWeek(state.weekKey);
    });
  }

  async function loadWeek(weekKey){
    const res = await api('dap_get_week', { weekKey }).catch(()=>null);
    if (!res?.success) return;
    state.weekData = res.data;
    state.types = res.data.types || state.types;
    fillTypesSelect();
    renderLegend();
    renderWeek();
  }

  async function loadTodos(){
    const res = await api('dap_todo_list', {}).catch(()=>null);
    if (!res?.success) return;
    state.todosAll = res.data.todos || [];
    state.types = res.data.types || state.types;
    fillTypesSelect();
    renderLegend();
    renderTodos();
  }

  // -------------------------
  // Legend
  // -------------------------
  function renderLegend(){
    const $legend = $('#dap-color-legend');
    if (!$legend.length) return;
    const types = (state.types || []).filter(t=>String(t.is_active)==='1');
    const items = types.length ? types : [
      { type_key:'meeting', label:'Meeting', color:'#2563eb', is_active:'1' },
      { type_key:'todo', label:'To-do', color:'#64748b', is_active:'1' }
    ];
    $legend.empty();
    items.forEach(t=>{
      const label = t.label || t.type_key;
      const c = t.color || '#64748b';
      $legend.append(
        `<span class="dap-legend-item" data-type="${escapeHtml(t.type_key)}">
          <span class="dap-legend-dot" style="background:${escapeHtml(c)}"></span>
          <span class="dap-legend-label">${escapeHtml(label)}</span>
        </span>`
      );
    });
  }

  // -------------------------
  // Week render
  // -------------------------
  function renderWeek(){
    if (!state.weekData) return;
    $('#dap-week-title').text(state.weekData.weekTitle || '');
    $('#dap-week-range').text(state.weekData.weekRange || '');

    const monday = weekKeyToMondayUTC(state.weekKey);
    if (!monday) return;

    const dayNames = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
    const byDay = {};
    for (let i=0;i<7;i++){
      const d = new Date(monday);
      d.setUTCDate(d.getUTCDate()+i);
      const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
      byDay[key] = { items: [], todos: [], idx: i, date: d };
    }

    (state.weekData.items || []).forEach(it=>{
      const k = String(it.start_at || '').slice(0,10);
      if (byDay[k]) byDay[k].items.push(it);
    });
    (state.weekData.todos || []).forEach(td=>{
      const k = String(td.due_at || '').slice(0,10);
      if (k && byDay[k]) byDay[k].todos.push(td);
    });

    // Totals
    let weekTotal = 0;
    let weekOpen = 0;

    const $days = $('#dap-week-days');
    $days.empty();

    Object.keys(byDay).sort().forEach(dayKey=>{
      const bucket = byDay[dayKey];
      const d = bucket.date;
      const dateLabel = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}`;

      const items = bucket.items.slice().sort((a,b)=>String(a.start_at||'').localeCompare(String(b.start_at||'')));
      const todos = bucket.todos.slice().sort((a,b)=>String(a.status||'').localeCompare(String(b.status||'')));

      const dayAgendaTotal = items.reduce((s,it)=>s + agendaDurationMinutes(it), 0);
      const dayAgendaOpen = items
        .filter(it=>!['done','cancelled'].includes(String(it.status||'open')))
        .reduce((s,it)=>s + agendaDurationMinutes(it), 0);

      const dayTodoTotal = todos.reduce((s,t)=>s + todoMinutes(t), 0);
      const dayTodoOpen = todos.filter(t=>String(t.status||'open')!=='done').reduce((s,t)=>s + todoMinutes(t), 0);

      const dayTotal = dayAgendaTotal + dayTodoTotal;
      const dayOpen = dayAgendaOpen + dayTodoOpen;

      weekTotal += dayTotal;
      weekOpen += dayOpen;

      const $day = $(
        `<div class="dap-day" data-day="${escapeHtml(dayKey)}" data-date="${escapeHtml(dayKey)}">
          <div class="dap-day-head">
            <div>
              <div class="dap-day-title">${dayNames[bucket.idx]}</div>
              <div class="dap-day-date">${escapeHtml(dateLabel)}</div>
            </div>
            <div class="dap-day-hours">
              <span class="dap-hour-pill"><small>Open</small> <strong>${escapeHtml(formatMinutes(dayOpen))}</strong></span>
              <span class="dap-hour-pill"><small>Totaal</small> <strong>${escapeHtml(formatMinutes(dayTotal))}</strong></span>
            </div>
          </div>
          <div class="dap-day-body">
            <div>
              <div class="dap-mini-title">Agenda</div>
              <div class="dap-mini-list dap-mini-list--items"></div>
            </div>
            <div>
              <div class="dap-mini-title">To-do’s</div>
              <div class="dap-mini-list dap-mini-list--todos"></div>
            </div>
          </div>
        </div>`
      );

      const $itemsList = $day.find('.dap-mini-list--items');
      if (!items.length){
        $itemsList.append(`<div class="dap-muted">—</div>`);
      } else {
        items.forEach(item=>{
          const dot = item.color || typeColor(item.type_key);
          const time = item.start_at ? String(item.start_at).slice(11,16) : '';
          $itemsList.append(
            `<div class="dap-mini-item" data-item="${escapeHtml(JSON.stringify(item))}">
              <span class="dap-dot" style="background:${escapeHtml(dot)}"></span>
              <div class="dap-mini-main">
                <div class="dap-mini-name">${escapeHtml(item.title)}</div>
                <div class="dap-mini-meta">
                  <span>${escapeHtml(time)}</span>
                  <span>${escapeHtml(typeLabel(item.type_key))}</span>
                </div>
              </div>
            </div>`
          );
        });
      }

      const $todosList = $day.find('.dap-mini-list--todos');
      if (!todos.length){
        $todosList.append(`<div class="dap-muted">—</div>`);
      } else {
        todos.forEach(todo=>{
          const dot = todo.color || '#64748b';
          const mins = todoMinutes(todo);
          const status = String(todo.status || 'open');
          $todosList.append(
            `<div class="dap-mini-item" draggable="true" data-todo-id="${escapeHtml(todo.id)}" data-todo="${escapeHtml(JSON.stringify(todo))}">
              <span class="dap-dot" style="background:${escapeHtml(dot)}"></span>
              <div class="dap-mini-main">
                <div class="dap-mini-name">${escapeHtml(todo.title)}${status==='done'?' ✅':''}</div>
                <div class="dap-mini-meta">
                  <span>${escapeHtml(formatMinutes(mins))}</span>
                  <span>${escapeHtml(status)}</span>
                </div>
              </div>
              <button class="dap-inline-open" type="button" title="Details">⋯</button>
            </div>`
          );
        });
      }

      $days.append($day);
    });

    $('#dap-week-total').text(formatMinutes(weekTotal));
    $('#dap-week-open').text(`Open: ${formatMinutes(weekOpen)}`);
  }

  // Click week cards
  $(document).on('click', '.dap-mini-item[data-item]', function(){
    const item = JSON.parse($(this).attr('data-item') || '{}');
    fillItemModal(item);
    openModal($('#dap-modal-item'));
  });

  // Week: inline edit by default (no popup)
  $(document).on('click', '.dap-mini-item[data-todo]', function(e){
    if ($(e.target).closest('.dap-inline-open').length) return;
    const todo = JSON.parse($(this).attr('data-todo') || '{}');
    startInlineTodoEdit($(this), todo);
  });

  // Keep a small "details" button for checklist/notes
  $(document).on('click', '.dap-mini-item[data-todo] .dap-inline-open', function(e){
    e.preventDefault(); e.stopPropagation();
    const $row = $(this).closest('.dap-mini-item');
    const todo = JSON.parse($row.attr('data-todo') || '{}');
    fillTodoModal(todo);
    openModal($('#dap-modal-todo'));
  });

  // -------------------------
  // Drag & Drop to-do's between days (week)
  // -------------------------
  let dragTodo = null;
  $(document).on('dragstart', '.dap-mini-item[data-todo]', function(e){
    try{ dragTodo = JSON.parse($(this).attr('data-todo') || '{}'); }catch(_){ dragTodo = null; }
    $(this).addClass('is-dragging');
    e.originalEvent.dataTransfer.effectAllowed = 'move';
    e.originalEvent.dataTransfer.setData('text/plain', String(dragTodo?.id || ''));
  });
  $(document).on('dragend', '.dap-mini-item[data-todo]', function(){
    $(this).removeClass('is-dragging');
    $('.dap-day').removeClass('is-dropzone');
  });

  $(document).on('dragover', '.dap-day', function(e){
    if (!dragTodo?.id) return;
    e.preventDefault();
    $(this).addClass('is-dropzone');
  });
  $(document).on('dragleave', '.dap-day', function(){
    $(this).removeClass('is-dropzone');
  });
  $(document).on('drop', '.dap-day', async function(e){
    if (!dragTodo?.id) return;
    e.preventDefault();
    const dayKey = String($(this).attr('data-day') || '').trim();
    $(this).removeClass('is-dropzone');
    const due = String(dragTodo?.due_at || '');
    const time = (due && due.length >= 16) ? due.slice(11,19) : '09:00:00';
    const dueAt = `${dayKey} ${time}`;
    const res = await api('dap_todo_update', { id: parseInt(dragTodo.id,10), dueAt }).catch(()=>null);
    dragTodo = null;
    if (!res?.success) return alert('Verplaatsen mislukt.');
    await loadWeek(state.weekKey);
  });

  // -------------------------
  // To-do render + filters
  // -------------------------
  function getTodoFilters(){
    return {
      q: String($('#dap-todo-filter-q').val() || '').trim().toLowerCase(),
      status: String($('#dap-todo-filter-status').val() || 'all'),
      due: String($('#dap-todo-filter-due').val() || 'all'),
      hasEmail: !!$('#dap-todo-filter-hasemail').prop('checked'),
      sort: String($('#dap-todo-filter-sort').val() || 'due_asc'),
    };
  }

  function dueBucket(todo){
    const due = String(todo?.due_at || '');
    if (!due) return 'nodue';
    const today = String(DAP.now || '').slice(0,10);
    const dueDate = due.slice(0,10);
    if (dueDate < today) return 'overdue';
    if (dueDate === today) return 'today';
    // week: compare ISO week key
    const monday = weekKeyToMondayUTC(state.weekKey || mondayUTCToWeekKey(new Date()));
    const end = new Date(monday);
    end.setUTCDate(end.getUTCDate() + 6);
    const k = dueDate;
    const from = `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth()+1)}-${pad(monday.getUTCDate())}`;
    const to = `${end.getUTCFullYear()}-${pad(end.getUTCMonth()+1)}-${pad(end.getUTCDate())}`;
    if (k >= from && k <= to) return 'week';
    return 'later';
  }

  function renderTodos(){
    const $list = $('#dap-todo-list');
    if (!$list.length) return;
    const f = getTodoFilters();
    let rows = (state.todosAll || []).slice();

    if (f.q){
      rows = rows.filter(t=>{
        const hay = `${t.title||''} ${t.contact_email||''}`.toLowerCase();
        return hay.includes(f.q);
      });
    }
    if (f.status !== 'all') rows = rows.filter(t=>String(t.status||'open') === f.status);
    if (f.hasEmail) rows = rows.filter(t=>!!String(t.contact_email||'').trim());
    if (f.due !== 'all') rows = rows.filter(t=>dueBucket(t) === f.due);

    // Sort
    const sorters = {
      due_asc: (a,b)=>String(a.due_at||'9999').localeCompare(String(b.due_at||'9999')),
      due_desc: (a,b)=>String(b.due_at||'').localeCompare(String(a.due_at||'')),
      minutes_desc: (a,b)=>todoMinutes(b)-todoMinutes(a),
      minutes_asc: (a,b)=>todoMinutes(a)-todoMinutes(b),
      created_desc: (a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')),
    };
    rows.sort(sorters[f.sort] || sorters.due_asc);

    // Totals
    const totalAll = rows.reduce((s,t)=>s+todoMinutes(t), 0);
    const totalOpen = rows.filter(t=>String(t.status||'open')!=='done').reduce((s,t)=>s+todoMinutes(t), 0);
    $('#dap-todo-totals').text(`Open: ${formatMinutes(totalOpen)} • Totaal: ${formatMinutes(totalAll)} • Items: ${rows.length}`);

    $list.empty();
    if (!rows.length){
      $list.append(`<div class="dap-muted" style="padding:12px 10px;">Geen to-do’s gevonden.</div>`);
      return;
    }

    rows.forEach(todo=>{
      const dot = todo.color || typeColor(todo.type_key, '#64748b');
      const mins = todoMinutes(todo);
      const status = String(todo.status || 'open');
      const due = todo.due_at ? String(todo.due_at).slice(0,16).replace('T',' ') : '';
      const email = String(todo.contact_email || '').trim();
      const emailLine = email ? `<span class="dap-pill"><small>E-mail</small> ${escapeHtml(email)}</span>` : '';
      $list.append(
        `<div class="dap-item" data-todo="${escapeHtml(JSON.stringify(todo))}">
          <span class="dap-dot" style="background:${escapeHtml(dot)}"></span>
          <div class="dap-item-main">
            <div class="dap-item-title">${escapeHtml(todo.title)}${status==='done'?' ✅':''}</div>
            <div class="dap-item-meta">
              <span class="dap-pill"><small>Min.</small> ${escapeHtml(formatMinutes(mins))}</span>
              <span class="dap-pill"><small>Status</small> ${escapeHtml(status)}</span>
              ${due ? `<span class="dap-pill"><small>Deadline</small> ${escapeHtml(due)}</span>` : `<span class="dap-pill"><small>Deadline</small> —</span>`}
              ${emailLine}
            </div>
          </div>
          <button class="dap-inline-open" type="button" title="Details">⋯</button>
        </div>`
      );
    });
  }

  $(document).on('click', '#dap-todo-filters input, #dap-todo-filters select', function(){
    renderTodos();
  });
  $(document).on('input', '#dap-todo-filter-q', function(){
    renderTodos();
  });

  // Click todo row
  $(document).on('click', '.dap-item[data-todo]', function(){
    const todo = JSON.parse($(this).attr('data-todo') || '{}');
    startInlineTodoEdit($(this), todo);
  });

  $(document).on('click', '.dap-item[data-todo] .dap-inline-open', function(e){
    e.preventDefault(); e.stopPropagation();
    const $row = $(this).closest('.dap-item');
    const todo = JSON.parse($row.attr('data-todo') || '{}');
    fillTodoModal(todo);
    openModal($('#dap-modal-todo'));
  });

  // -------------------------
  // Item modal
  // -------------------------
  function fillItemModal(item){
    $('#dap-item-id').val(item?.id || '');
    $('#dap-item-title').val(item?.title || '');
    $('#dap-item-desc').val(item?.description || '');
    $('#dap-item-start').val(toInputDateTime(item?.start_at));
    $('#dap-item-end').val(toInputDateTime(item?.end_at));
    $('#dap-item-status').val(item?.status || 'open');
    $('#dap-item-email').val(item?.contact_email || '');
    $('#dap-item-type').val(item?.type_key || 'meeting');
    $('#dap-item-color').val(item?.color || typeColor(item?.type_key, '#2563eb'));
    $('#dap-item-delete').toggle(!!item?.id);
  }

  function fillTypesSelect(){
    const $sel = $('#dap-item-type');
    if (!$sel.length) return;
    $sel.empty();
    (state.types || []).filter(t=>String(t.is_active)==='1').forEach(t=>{
      $sel.append(`<option value="${escapeHtml(t.type_key)}">${escapeHtml(t.label)}</option>`);
    });
  }

  $('#dap-open-item-modal').on('click', function(){
    fillTypesSelect();
    fillItemModal({ type_key: 'meeting', status:'open', color:typeColor('meeting', '#2563eb') });
    openModal($('#dap-modal-item'));
  });

  $('#dap-item-type').on('change', function(){
    const typeKey = String($(this).val()||'');
    const c = typeColor(typeKey, '#64748b');
    $('#dap-item-color').val(c);
  });

  $('#dap-item-save').on('click', async function(){
    const id = parseInt($('#dap-item-id').val() || 0, 10);
    const startRaw = String($('#dap-item-start').val() || '').trim();
    const endRaw = String($('#dap-item-end').val() || '').trim();
    const payload = {
      title: $('#dap-item-title').val(),
      description: $('#dap-item-desc').val(),
      startAt: startRaw ? startRaw.replace('T',' ') + ':00' : '',
      endAt: endRaw ? endRaw.replace('T',' ') + ':00' : '',
      status: $('#dap-item-status').val(),
      typeKey: $('#dap-item-type').val(),
      color: $('#dap-item-color').val(),
      email: $('#dap-item-email').val(),
    };
    const action = id ? 'dap_item_update' : 'dap_item_create';
    if (id) payload.id = id;
    const res = await api(action, payload).catch(()=>null);
    if (!res?.success){
      alert('Opslaan mislukt. Controleer velden en probeer opnieuw.');
      return;
    }
    closeModal($('#dap-modal-item'));
    await loadWeek(state.weekKey);
  });

  $('#dap-item-delete').on('click', async function(){
    const id = parseInt($('#dap-item-id').val() || 0, 10);
    if (!id) return;
    if (!confirm('Dit agenda item verwijderen?')) return;
    const res = await api('dap_item_delete', { id }).catch(()=>null);
    if (!res?.success) return alert('Verwijderen mislukt.');
    closeModal($('#dap-modal-item'));
    await loadWeek(state.weekKey);
  });

  // -------------------------
  // Todo modal
  // -------------------------
  function fillTodoModal(todo){
    $('#dap-todo-id').val(todo?.id || '');
    $('#dap-todo-title').val(todo?.title || '');
    $('#dap-todo-notes').val(todo?.notes || '');
    $('#dap-todo-due').val(toInputDateTime(todo?.due_at));
    $('#dap-todo-status').val(todo?.status || 'open');
    $('#dap-todo-color').val(todo?.color || '#64748b');
    $('#dap-todo-email').val(todo?.contact_email || '');
    $('#dap-todo-minutes').val(minutesClamp(todo?.estimated_minutes || 0));
    $('#dap-todo-delete').toggle(!!todo?.id);

    // checklist
    state.checklistTodoId = parseInt(todo?.id || 0, 10);
    state.checklist = [];
    renderChecklist();
    if (state.checklistTodoId > 0) {
      loadChecklist(state.checklistTodoId);
      $('#dap-checklist-empty').hide();
    } else {
      $('#dap-checklist-empty').show();
    }
  }

  $('#dap-open-todo-modal').on('click', function(){
    fillTodoModal({ status:'open', color:'#64748b', estimated_minutes:0 });
    openModal($('#dap-modal-todo'));
  });

  $('#dap-todo-save').on('click', async function(){
    const id = parseInt($('#dap-todo-id').val() || 0, 10);
    const dueRaw = String($('#dap-todo-due').val() || '').trim();
    const payload = {
      title: $('#dap-todo-title').val(),
      notes: $('#dap-todo-notes').val(),
      dueAt: dueRaw ? dueRaw.replace('T',' ') + ':00' : '',
      status: $('#dap-todo-status').val(),
      color: $('#dap-todo-color').val(),
      email: $('#dap-todo-email').val(),
      estimatedMinutes: minutesClamp($('#dap-todo-minutes').val()),
      typeKey: 'todo',
    };
    const action = id ? 'dap_todo_update' : 'dap_todo_create';
    if (id) payload.id = id;
    const res = await api(action, payload).catch(()=>null);
    if (!res?.success){
      alert('Opslaan mislukt.');
      return;
    }
    // If create, store new id so checklist becomes available
    if (!id && res.data?.todoId){
      $('#dap-todo-id').val(res.data.todoId);
      state.checklistTodoId = parseInt(res.data.todoId, 10);
      $('#dap-checklist-empty').hide();
    }

    // Refresh list / week view depending on active tab
    if (state.tab === 'todos') await loadTodos();
    if (state.tab === 'week') await loadWeek(state.weekKey);
    alert('Opgeslagen ✅');
  });

  $('#dap-todo-delete').on('click', async function(){
    const id = parseInt($('#dap-todo-id').val() || 0, 10);
    if (!id) return;
    if (!confirm('Deze to-do verwijderen?')) return;
    const res = await api('dap_todo_delete', { id }).catch(()=>null);
    if (!res?.success) return alert('Verwijderen mislukt.');
    closeModal($('#dap-modal-todo'));
    if (state.tab === 'todos') await loadTodos();
    if (state.tab === 'week') await loadWeek(state.weekKey);
  });

  // -------------------------
  // Checklist
  // -------------------------
  async function loadChecklist(todoId){
    const res = await api('dap_todo_checklist_list', { todoId }).catch(()=>null);
    if (!res?.success) return;
    state.checklist = res.data.items || [];
    renderChecklist();
  }

  function renderChecklist(){
    const $list = $('#dap-checklist-list');
    if (!$list.length) return;
    $list.empty();

    const items = (state.checklist || []).slice().sort((a,b)=>(parseInt(a.sort_order||0,10)-parseInt(b.sort_order||0,10)) || (parseInt(a.id,10)-parseInt(b.id,10)));
    const total = items.reduce((s,i)=>s + minutesClamp(i.estimated_minutes), 0);
    const done = items.filter(i=>String(i.is_done)==='1').reduce((s,i)=>s + minutesClamp(i.estimated_minutes), 0);
    $('#dap-checklist-progress').text(items.length ? `${done}/${total} (${formatMinutes(done)} / ${formatMinutes(total)})` : '');

    if (!items.length){
      $list.append(`<div class="dap-muted">Nog geen checklist items.</div>`);
      return;
    }

    items.forEach(it=>{
      const isDone = String(it.is_done) === '1';
      $list.append(
        `<div class="dap-check" data-id="${escapeHtml(it.id)}">
          <div class="dap-check-left ${isDone ? 'is-done':''}">
            <input type="checkbox" class="dap-check-toggle" ${isDone?'checked':''} />
            <input type="text" class="dap-check-label" value="${escapeHtml(it.label)}" />
          </div>
          <div class="dap-check-right">
            <input type="number" min="0" step="1" class="dap-check-min" value="${escapeHtml(minutesClamp(it.estimated_minutes))}" title="Minuten (schatting)" />
            <button class="button-link-delete dap-check-del" title="Verwijderen">✕</button>
          </div>
        </div>`
      );
    });
  }

  $('#dap-checklist-add').on('click', async function(){
    const todoId = parseInt($('#dap-todo-id').val() || 0, 10);
    if (!todoId) return alert('Sla de to-do eerst op.');
    const label = String($('#dap-checklist-new').val() || '').trim();
    const minutes = minutesClamp($('#dap-checklist-new-minutes').val());
    if (!label) return;
    const res = await api('dap_todo_checklist_add', { todoId, label, minutes }).catch(()=>null);
    if (!res?.success) return alert('Toevoegen mislukt.');
    $('#dap-checklist-new').val('');
    $('#dap-checklist-new-minutes').val('');
    await loadChecklist(todoId);
    if (state.tab === 'week') await loadWeek(state.weekKey);
  });

  $(document).on('change', '.dap-check-toggle', async function(){
    const $row = $(this).closest('.dap-check');
    const id = parseInt($row.attr('data-id') || 0, 10);
    if (!id) return;
    const isDone = $(this).prop('checked') ? 1 : 0;
    const res = await api('dap_todo_checklist_toggle', { id, isDone }).catch(()=>null);
    if (!res?.success) return;
    await loadChecklist(parseInt($('#dap-todo-id').val()||0,10));
    if (state.tab === 'week') await loadWeek(state.weekKey);
  });

  // Update label / minutes (debounced)
  let chkTimer = null;
  $(document).on('input', '.dap-check-label, .dap-check-min', function(){
    clearTimeout(chkTimer);
    chkTimer = setTimeout(async ()=>{
      const $row = $(this).closest('.dap-check');
      const id = parseInt($row.attr('data-id') || 0, 10);
      if (!id) return;
      const label = String($row.find('.dap-check-label').val() || '').trim();
      const minutes = minutesClamp($row.find('.dap-check-min').val());
      const res = await api('dap_todo_checklist_update', { id, label, minutes }).catch(()=>null);
      if (!res?.success) return;
      await loadChecklist(parseInt($('#dap-todo-id').val()||0,10));
      if (state.tab === 'week') await loadWeek(state.weekKey);
    }, 450);
  });

  $(document).on('click', '.dap-check-del', async function(){
    const $row = $(this).closest('.dap-check');
    const id = parseInt($row.attr('data-id') || 0, 10);
    if (!id) return;
    if (!confirm('Checklist item verwijderen?')) return;
    const res = await api('dap_todo_checklist_delete', { id }).catch(()=>null);
    if (!res?.success) return;
    await loadChecklist(parseInt($('#dap-todo-id').val()||0,10));
    if (state.tab === 'week') await loadWeek(state.weekKey);
  });

  // -------------------------
  // CRM helpers (optional)
  // -------------------------
  async function crmLookupEmail(email){
    const res = await api('dap_crm_lookup', { email }).catch(()=>null);
    if (!res?.success) return null;
    return res.data?.contact || null;
  }

  $('#dap-todo-email').on('blur', async function(){
    const email = String($(this).val() || '').trim();
    if (!email) { $('#dap-todo-crmmeta').hide().text(''); return; }
    const c = await crmLookupEmail(email);
    if (!c) { $('#dap-todo-crmmeta').show().text('Niet gevonden in CRM Core (wordt gelogd zodra CRM Core actief is).'); return; }
    const name = c.name || c.full_name || c.company || c.email || 'Contact';
    $('#dap-todo-crmmeta').show().text(`CRM: ${name}`);
  });

  $('#dap-todo-email').on('input', async function(){
    const q = String($(this).val() || '').trim();
    if (q.length < 2) return;
    const res = await api('dap_crm_search', { q, limit: 10 }).catch(()=>null);
    if (!res?.success) return;
    const contacts = res.data?.contacts || [];
    const $dl = $('#dap-crm-emails');
    $dl.empty();
    contacts.forEach(c=>{
      const em = (c.email || c.contact_email || '').trim();
      if (!em) return;
      $dl.append(`<option value="${escapeHtml(em)}"></option>`);
    });
  });

  // -------------------------
  // Week navigation
  // -------------------------
  async function switchWeek(delta){
    const $days = $('#dap-week-days');
    $days.removeClass('dap-week-switch-in').addClass('dap-week-switch-out');
    state.weekKey = shiftWeekKey(state.weekKey, delta);
    $('.dap-content').attr('data-week', state.weekKey);
    await loadWeek(state.weekKey);
    updateUrl({ week: state.weekKey });
    requestAnimationFrame(()=>{
      $days.removeClass('dap-week-switch-out').addClass('dap-week-switch-in');
    });
  }
  $('#dap-prev-week').on('click', async function(){ await switchWeek(-1); });
  $('#dap-next-week').on('click', async function(){ await switchWeek(1); });

  function updateUrl(params){
    try{
      const url = new URL(window.location.href);
      Object.keys(params).forEach(k=>url.searchParams.set(k, params[k]));
      window.history.replaceState({}, '', url.toString());
    }catch(e){}
  }

  // -------------------------
  // Init
  // -------------------------
  $(async function(){
    state.tab = String($('.dap-content').data('tab') || 'week');
    state.weekKey = String($('.dap-content').data('week') || '');

    // Dark mode from local storage
    try{ state.dark = localStorage.getItem('dap_dark_mode') === '1'; }catch(e){ state.dark = false; }
    applyDarkMode(state.dark);

    await bootstrap();
    fillTypesSelect();

    if (state.tab === 'week') {
      await loadWeek(state.weekKey);
      $('#dap-week-days').addClass('dap-week-switch-in');
    }
    if (state.tab === 'todos') {
      await loadTodos();
    }
  });

  function applyDarkMode(isOn){
    $('.dap-wrap').toggleClass('dap-dark', !!isOn);
    $('#dap-dark-toggle').attr('aria-pressed', isOn ? 'true' : 'false');
  }

  $(document).on('click', '#dap-dark-toggle', function(){
    state.dark = !state.dark;
    applyDarkMode(state.dark);
    try{ localStorage.setItem('dap_dark_mode', state.dark ? '1' : '0'); }catch(e){}
  });

})(jQuery);
