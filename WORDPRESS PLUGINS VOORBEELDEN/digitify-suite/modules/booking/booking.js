/**
 * Digitify Suite — Booking Module
 *
 * Migrated from:
 * - digitify-booking plugin:
 *   - class-booking-handler.php — slot calculation, booking creation
 *   - class-booking-widget.php — public booking widget UI
 *   - booking.js — calendar rendering, slot selection, form submit
 *   - class-google-calendar.php — Google Calendar sync (placeholder)
 *   - class-crm-adapter.php — CRM contact upsert on booking
 *   - booking.css — widget styling
 *
 * WordPress AJAX calls replaced by direct repository calls.
 * Google Calendar integration prepared as @API placeholder.
 */

import { bookings, eventTypes, availability, contacts, timeline as timelineRepo } from '../../data/db.js';
import { escHtml, formatDate, formatDateTime, timeAgo, toast, uid, normalizeEmail } from '../../core/utils.js';
import store from '../../core/store.js';

const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const DAYS = ['Ma','Di','Wo','Do','Vr','Za','Zo'];

export function renderBooking(params, container) {
  if (params.sub === 'new') return renderBookingWidget(container);
  if (params.id) return renderBookingDetail(params.id, container);
  return renderBookingList(container);
}

function renderBookingList(container) {
  const allBookings = bookings.getAll().sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  const types = eventTypes.getAll();
  const upcoming = allBookings.filter(b => new Date(b.start_time) > new Date());
  const past = allBookings.filter(b => new Date(b.start_time) <= new Date());

  container.innerHTML = `
    <div class="ds-content-inner">
      <div class="ds-toolbar">
        <h3 style="font-weight:700">Boekingen</h3>
        <div style="flex:1"></div>
        <a href="#/booking/new" class="ds-btn ds-btn-primary">+ Nieuwe boeking</a>
      </div>

      <!-- Event Types -->
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        ${types.filter(t => t.active).map(t => `
          <div class="ds-card" style="padding:14px 18px;display:flex;align-items:center;gap:10px;flex:1;min-width:180px">
            <div style="width:12px;height:12px;border-radius:50%;background:${escHtml(t.color)}"></div>
            <div>
              <div style="font-weight:600;font-size:13px">${escHtml(t.title)}</div>
              <div style="font-size:11px;color:var(--ds-text-muted)">${t.duration} min · ${escHtml(t.location || 'Online')}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Upcoming -->
      <h4 style="font-weight:700;margin-bottom:12px">Komende afspraken (${upcoming.length})</h4>
      ${upcoming.length ? `
      <div class="ds-table-wrap" style="margin-bottom:24px">
        <table class="ds-table">
          <thead><tr><th>Bezoeker</th><th>Type</th><th>Datum/Tijd</th><th>Status</th><th>Meet link</th></tr></thead>
          <tbody>
            ${upcoming.map(b => bookingRow(b)).join('')}
          </tbody>
        </table>
      </div>` : '<div class="ds-empty" style="padding:16px"><p>Geen komende boekingen.</p></div>'}

      <!-- Past -->
      <h4 style="font-weight:700;margin-bottom:12px">Afgelopen afspraken (${past.length})</h4>
      ${past.length ? `
      <div class="ds-table-wrap">
        <table class="ds-table">
          <thead><tr><th>Bezoeker</th><th>Type</th><th>Datum/Tijd</th><th>Status</th></tr></thead>
          <tbody>
            ${past.map(b => `
              <tr style="opacity:.7">
                <td><div style="font-weight:600">${escHtml(b.attendee_name)}</div><div style="font-size:12px;color:var(--ds-text-muted)">${escHtml(b.attendee_email)}</div></td>
                <td>${escHtml(b.event_type_title || '')}</td>
                <td>${formatDateTime(b.start_time)}</td>
                <td><span class="ds-badge ds-badge-neutral">${escHtml(b.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>
  `;
}

function bookingRow(b) {
  const statusMap = { confirmed: 'success', pending: 'warning', cancelled: 'danger', completed: 'neutral' };
  return `
    <tr>
      <td>
        <div style="font-weight:600">${escHtml(b.attendee_name)}</div>
        <div style="font-size:12px;color:var(--ds-text-muted)">${escHtml(b.attendee_email)} · ${escHtml(b.attendee_phone || '')}</div>
      </td>
      <td>${escHtml(b.event_type_title || '')}</td>
      <td style="font-weight:500">${formatDateTime(b.start_time)}</td>
      <td><span class="ds-badge ds-badge-${statusMap[b.status] || 'neutral'}">${escHtml(b.status)}</span></td>
      <td>${b.meet_link ? `<a href="${escHtml(b.meet_link)}" target="_blank" class="ds-btn ds-btn-ghost ds-btn-sm">🎥 Meet</a>` : '—'}</td>
    </tr>
  `;
}

function renderBookingWidget(container) {
  const types = eventTypes.getAll().filter(t => t.active);
  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth() + 1;
  let selectedType = types[0] || null;
  let selectedDate = null;
  let selectedSlot = null;

  function render() {
    container.innerHTML = `
      <div class="ds-content-inner" style="max-width:640px">
        <div style="margin-bottom:16px">
          <a href="#/booking" class="ds-btn ds-btn-ghost ds-btn-sm">← Terug</a>
        </div>

        <div class="ds-card">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">Nieuwe Boeking</h2>

          <!-- Step 1: Select event type -->
          <div class="ds-form-group">
            <label class="ds-form-label">Type afspraak</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap" id="bk-types">
              ${types.map(t => `
                <button class="ds-btn ${selectedType?.id === t.id ? 'ds-btn-primary' : 'ds-btn-secondary'} ds-btn-sm bk-type-btn" data-id="${t.id}">
                  ${escHtml(t.title)} (${t.duration} min)
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Step 2: Calendar (migrated from booking.js renderCalendar) -->
          <div class="ds-form-group">
            <label class="ds-form-label">Selecteer datum</label>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
              <button class="ds-btn ds-btn-ghost ds-btn-sm" id="bk-prev-month">←</button>
              <span style="font-weight:600;min-width:160px;text-align:center" id="bk-month-label">${MONTHS[calMonth - 1]} ${calYear}</span>
              <button class="ds-btn ds-btn-ghost ds-btn-sm" id="bk-next-month">→</button>
            </div>
            <div class="ds-calendar-grid" id="bk-calendar">
              ${renderCalendarGrid(calYear, calMonth, selectedDate)}
            </div>
          </div>

          <!-- Step 3: Time slots -->
          <div class="ds-form-group" id="bk-slots-wrap" style="${selectedDate ? '' : 'display:none'}">
            <label class="ds-form-label">Beschikbare tijden</label>
            <div id="bk-slots" style="display:flex;gap:6px;flex-wrap:wrap">
              ${selectedDate ? renderSlots(selectedDate, selectedType, selectedSlot) : ''}
            </div>
          </div>

          <!-- Step 4: Contact form (migrated from booking.js form section) -->
          <div id="bk-form-wrap" style="${selectedSlot ? '' : 'display:none'}">
            <hr style="border:none;border-top:1px solid var(--ds-border);margin:16px 0">
            <h3 style="font-weight:700;margin-bottom:12px">Uw gegevens</h3>
            <form id="bk-form">
              <div class="ds-form-row">
                <div class="ds-form-group">
                  <label class="ds-form-label">Naam *</label>
                  <input type="text" name="name" class="ds-input" required placeholder="Uw naam">
                </div>
                <div class="ds-form-group">
                  <label class="ds-form-label">E-mail *</label>
                  <input type="email" name="email" class="ds-input" required placeholder="email@voorbeeld.be">
                </div>
              </div>
              <div class="ds-form-row">
                <div class="ds-form-group">
                  <label class="ds-form-label">Telefoon *</label>
                  <input type="tel" name="phone" class="ds-input" required placeholder="+32 470 12 34 56">
                </div>
              </div>
              <div class="ds-form-group">
                <label class="ds-form-label">Opmerkingen</label>
                <textarea name="notes" class="ds-textarea" rows="2" placeholder="Eventuele opmerkingen..."></textarea>
              </div>
              <button type="submit" class="ds-btn ds-btn-primary ds-btn-lg" style="width:100%">Afspraak boeken</button>
            </form>
          </div>
        </div>
      </div>
    `;

    // Event handlers
    container.querySelectorAll('.bk-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedType = types.find(t => t.id === Number(btn.dataset.id));
        selectedDate = null;
        selectedSlot = null;
        render();
      });
    });

    container.querySelector('#bk-prev-month').addEventListener('click', () => {
      calMonth--;
      if (calMonth < 1) { calMonth = 12; calYear--; }
      container.querySelector('#bk-month-label').textContent = `${MONTHS[calMonth - 1]} ${calYear}`;
      container.querySelector('#bk-calendar').innerHTML = renderCalendarGrid(calYear, calMonth, selectedDate);
      bindDayClicks();
    });

    container.querySelector('#bk-next-month').addEventListener('click', () => {
      calMonth++;
      if (calMonth > 12) { calMonth = 1; calYear++; }
      container.querySelector('#bk-month-label').textContent = `${MONTHS[calMonth - 1]} ${calYear}`;
      container.querySelector('#bk-calendar').innerHTML = renderCalendarGrid(calYear, calMonth, selectedDate);
      bindDayClicks();
    });

    bindDayClicks();
    bindSlotClicks();
    bindForm();
  }

  function bindDayClicks() {
    container.querySelectorAll('.ds-calendar-day:not(.disabled)').forEach(day => {
      day.addEventListener('click', () => {
        selectedDate = day.dataset.date;
        selectedSlot = null;
        const slotsWrap = container.querySelector('#bk-slots-wrap');
        slotsWrap.style.display = '';
        container.querySelector('#bk-slots').innerHTML = renderSlots(selectedDate, selectedType, selectedSlot);
        container.querySelector('#bk-form-wrap').style.display = 'none';
        container.querySelectorAll('.ds-calendar-day').forEach(d => d.classList.remove('today'));
        day.classList.add('today');
        bindSlotClicks();
      });
    });
  }

  function bindSlotClicks() {
    container.querySelectorAll('.bk-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSlot = btn.dataset.time;
        container.querySelectorAll('.bk-slot-btn').forEach(b => b.classList.remove('ds-btn-primary'));
        btn.classList.add('ds-btn-primary');
        btn.classList.remove('ds-btn-secondary');
        container.querySelector('#bk-form-wrap').style.display = '';
      });
    });
  }

  function bindForm() {
    const form = container.querySelector('#bk-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));

      // Create booking (replaces WordPress AJAX digitify_create_booking)
      const startTime = `${selectedDate}T${selectedSlot}:00`;
      const duration = selectedType?.duration || 30;
      const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();

      const booking = bookings.create({
        event_type_id: selectedType?.id,
        event_type_title: selectedType?.title || 'Afspraak',
        attendee_name: data.name,
        attendee_email: normalizeEmail(data.email),
        attendee_phone: data.phone,
        attendee_notes: data.notes || '',
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        duration,
        uid: 'bk_' + uid(),
        // @API: Google Calendar event creation would happen here
        google_event_id: null,
        meet_link: null,
      });

      // CRM adapter: upsert contact (migrated from class-crm-adapter.php)
      const existing = contacts.findOneBy('email', normalizeEmail(data.email));
      const contactId = existing
        ? (contacts.update(existing.id, { name: data.name, tel: data.phone }), existing.id)
        : contacts.create({ email: normalizeEmail(data.email), name: data.name, tel: data.phone, status: 'lead', pipeline_stage: 'Nieuw', source: 'booking', company_id: store.get('activeCompanyId') }).id;

      // Log timeline event
      timelineRepo.create({
        contact_id: contactId,
        event_type: 'booking_created',
        summary: `Boeking: ${selectedType?.title || 'Afspraak'} op ${formatDate(startTime)}`,
        source_app: 'booking',
        occurred_at: new Date().toISOString(),
      });

      toast('Boeking succesvol aangemaakt!');
      location.hash = '#/booking';
    });
  }

  render();
}

function renderCalendarGrid(year, month, selectedDate) {
  const today = new Date();
  const todayStr = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const offset = (firstDow + 6) % 7;

  let html = DAYS.map(d => `<div class="ds-calendar-header">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) html += '<div></div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const nowStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isPast = ds < nowStr;
    const isToday = ds === nowStr;
    const isSelected = ds === selectedDate;
    const classes = ['ds-calendar-day'];
    if (isPast) classes.push('disabled');
    if (isToday || isSelected) classes.push('today');
    html += `<div class="${classes.join(' ')}" data-date="${ds}" ${isPast ? '' : 'style="cursor:pointer"'}>${day}</div>`;
  }

  return html;
}

function renderSlots(date, eventType, selectedSlot) {
  // Generate time slots based on availability (migrated from class-booking-handler.php)
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const adjustedDow = dayOfWeek === 0 ? 7 : dayOfWeek; // 1=Mon...7=Sun
  const avail = availability.getAll().find(a => a.day_of_week === adjustedDow && a.active);

  if (!avail) return '<p style="color:var(--ds-text-muted);font-size:13px">Niet beschikbaar op deze dag.</p>';

  const duration = eventType?.duration || 30;
  const [startH, startM] = avail.start_time.split(':').map(Number);
  const [endH, endM] = avail.end_time.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const slots = [];
  for (let m = startMinutes; m + duration <= endMinutes; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const min = String(m % 60).padStart(2, '0');
    slots.push(`${h}:${min}`);
  }

  return slots.map(s => `
    <button class="ds-btn ${selectedSlot === s ? 'ds-btn-primary' : 'ds-btn-secondary'} ds-btn-sm bk-slot-btn" data-time="${s}">${s}</button>
  `).join('');
}

function renderBookingDetail(id, container) {
  const booking = bookings.getById(Number(id));
  if (!booking) {
    container.innerHTML = '<div class="ds-empty"><div class="ds-empty-icon">🔍</div><div class="ds-empty-title">Boeking niet gevonden</div></div>';
    return;
  }
  // Redirect to list for now
  renderBookingList(container);
}
