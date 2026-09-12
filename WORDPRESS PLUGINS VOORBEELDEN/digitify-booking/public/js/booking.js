/* Digitify Booking — Frontend JS v1.3.0 */
(function ($) {
  'use strict';

  var cfg     = window.digitifyBooking || {};
  var ajaxUrl = cfg.ajaxUrl || '';
  var nonce   = cfg.nonce   || '';
  var strings = cfg.strings || {};

  var MONTHS = ['Januari','Februari','Maart','April','Mei','Juni',
                'Juli','Augustus','September','Oktober','November','December'];
  var DAYS   = ['Ma','Di','Wo','Do','Vr','Za','Zo'];

  /* ═══════════════════════════════════════════════
   * Event list → inline widget load
   * ═════════════════════════════════════════════*/
  $(document).on('click', '.dg-event-card', function (e) {
    var $card   = $(this);
    var $list   = $card.closest('.dg-event-list');
    var listMode = ($list.data('dg-list-mode') || '').toString().toLowerCase();
    var embedSrc = $card.data('embed-src');
    var $root   = $('#dg-booking-modal-root');

    // Prefer iframe mode for best CSS isolation (default).
    if (listMode === 'iframe' && embedSrc) {
      e.preventDefault();
      var iframeId = 'dg-iframe-list-' + ($card.data('event-id') || '') + '-' + String(Math.random()).slice(2);
      $root.html(
        '<div class="dg-iframe-wrap">'
        + '<iframe src="' + escAttr(embedSrc) + '" class="dg-booking-iframe" id="' + escAttr(iframeId) + '" frameborder="0" scrolling="no" loading="lazy" title="Afspraak boeken"></iframe>'
        + '</div>'
      );
      // Smooth scroll to widget.
      if ($root.length) {
        $('html, body').animate({ scrollTop: $root.offset().top - 40 }, 300);
      }
      // Listen for auto-height messages.
      window.addEventListener('message', function (ev) {
        if (ev.data && typeof ev.data.digitifyHeight === 'number') {
          var f = document.getElementById(iframeId);
          if (f) { f.style.height = (ev.data.digitifyHeight + 24) + 'px'; }
        }
      });
      return;
    }

    // Fallback: load inline widget via AJAX (legacy behaviour).
    e.preventDefault();
    var eventId = $card.data('event-id');
    $root.html('<div class="dg-booking-widget" style="min-height:120px;align-items:center;justify-content:center"><p style="padding:24px;text-align:center;color:#6b7280">' + escHtml(strings.loading || 'Laden...') + '</p></div>');
    $.post(ajaxUrl, { action: 'digitify_get_event_widget', nonce: nonce, event_id: eventId })
      .done(function (res) {
        if (res.success) {
          $root.html(res.data.html);
          initWidget($root.find('.dg-booking-widget'));
          $('html, body').animate({ scrollTop: $root.offset().top - 40 }, 300);
        }
      });
  });

  /* ═══════════════════════════════════════════════
   * Boot on DOM ready
   * ═════════════════════════════════════════════*/
  $(function () {
    // Init all widgets present on page load
    $('.dg-booking-widget').each(function () {
      initWidget($(this));
    });

    // Cancel confirmation page
    $(document).on('click', '#dg-confirm-cancel', function () {
      var uid  = $(this).data('uid');
      var $btn = $(this);
      $btn.text('Bezig…').prop('disabled', true);

      $.post(ajaxUrl, { action: 'digitify_cancel_booking', nonce: nonce, uid: uid })
        .done(function (res) {
          var msg = res.success
            ? '<div style="color:#15803d;background:#dcfce7;border-radius:8px;padding:14px 18px;margin-top:12px">✓ Je afspraak is geannuleerd.</div>'
            : '<div style="color:#b91c1c;background:#fee2e2;border-radius:8px;padding:14px 18px;margin-top:12px">✕ ' + escHtml(res.data || 'Er ging iets mis.') + '</div>';
          $('#dg-cancel-result').html(msg);
          $('.dg-cancel-actions').hide();
        })
        .fail(function () {
          $('#dg-cancel-result').html('<div style="color:#b91c1c">Verbindingsfout. Probeer opnieuw.</div>');
          $btn.text('Ja, annuleren').prop('disabled', false);
        });
    });
  });

  /* ═══════════════════════════════════════════════
   * Widget initialisation
   * ═════════════════════════════════════════════*/
  function initWidget ($w) {
    if ($w.data('dg-init')) return;
    $w.data('dg-init', true);

    var eventId      = $w.data('event-id');
    var calYear      = parseInt($w.data('cal-year'),  10) || new Date().getFullYear();
    var calMonth     = parseInt($w.data('cal-month'), 10) || (new Date().getMonth() + 1);
    var selectedDate = null;
    var selectedLabel = '';

    // Render initial calendar month
    renderCalendar($w, calYear, calMonth);

    /* ── Month navigation ── */
    $w.on('click', '.dg-prev-month', function () {
      calMonth--;
      if (calMonth < 1) { calMonth = 12; calYear--; }
      renderCalendar($w, calYear, calMonth);
    });

    $w.on('click', '.dg-next-month', function () {
      calMonth++;
      if (calMonth > 12) { calMonth = 1; calYear++; }
      renderCalendar($w, calYear, calMonth);
    });

    /* ── Day click → show time panel ── */
    $w.on('click', '.dg-day:not([disabled])', function () {
      var $day = $(this);
      var date = $day.data('date');
      if (!date) return;

      selectedDate  = date;
      selectedLabel = fmtDate(date);

      $w.find('.dg-day').removeClass('dg-day-selected');
      $day.addClass('dg-day-selected');

      // Open time panel
      var $panel = $w.find('#dg-time-panel');
      $panel.addClass('dg-time-panel-open');
      $w.find('#dg-time-date-label').text(selectedLabel);

      loadSlots($w, eventId, date);
      notifyHeight();
    });

    /* ── Slot click → booking form ── */
    $w.on('click', '.dg-slot-btn', function () {
      var startTime = $(this).data('start');
      var timeLabel = $(this).data('time');

      $w.find('#dg-start-time').val(startTime);
      $w.find('#dg-selected-display').html(
        '<span style="opacity:.6;font-size:12px">📅</span> ' +
        escHtml(selectedLabel) + ' &mdash; ' + escHtml(timeLabel)
      );

      showStep($w, 2);
      notifyHeight();
    });

    /* ── Back to calendar ── */
    $w.on('click', '#dg-back-to-calendar', function () {
      clearErrors($w);
      showStep($w, 1);
      notifyHeight();
    });

    /* ── Form submit ── */
    $w.on('submit', '#dg-booking-form', function (e) {
      e.preventDefault();
      if (!validateForm($w)) return;

      var $form = $(this);
      var $btn  = $form.find('#dg-submit-btn');

      setSubmitLoading($btn, true);

      $.post(ajaxUrl, {
        action:        'digitify_create_booking',
        nonce:         nonce,
        event_type_id: $form.find('[name="event_type_id"]').val(),
        start_time:    $form.find('[name="start_time"]').val(),
        name:          $.trim($form.find('[name="name"]').val()),
        email:         $.trim($form.find('[name="email"]').val()),
        phone:         $.trim($form.find('[name="phone"]').val()),
        notes:         $form.find('[name="notes"]').val(),
      })
        .done(function (res) {
          if (res.success) {
            renderConfirmation(
              $w, res.data,
              $.trim($form.find('[name="name"]').val()),
              $.trim($form.find('[name="email"]').val())
            );
            showStep($w, 3);
            notifyHeight();
          } else {
            showBannerError($w, res.data || strings.booking_error);
            setSubmitLoading($btn, false);
          }
        })
        .fail(function () {
          showBannerError($w, strings.booking_error);
          setSubmitLoading($btn, false);
        });
    });

    /* ── New booking ── */
    $w.on('click', '#dg-new-booking', function (e) {
      e.preventDefault();
      var form = $w.find('#dg-booking-form')[0];
      if (form) form.reset();
      clearErrors($w);
      $w.find('.dg-day').removeClass('dg-day-selected');
      $w.find('#dg-slots-container').html(
        '<p class="dg-slots-placeholder">' + escHtml(strings.select_date || 'Selecteer een datum') + '</p>'
      );
      $w.find('#dg-time-panel').removeClass('dg-time-panel-open');
      selectedDate  = null;
      selectedLabel = '';
      showStep($w, 1);
      notifyHeight();
    });
  }

  /* ═══════════════════════════════════════════════
   * Render calendar month (client-side)
   * ═════════════════════════════════════════════*/
  function renderCalendar ($w, year, month) {
    var today     = new Date();
    var todayStr  = pad(today.getFullYear()) + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    var daysInMon = new Date(year, month, 0).getDate();
    var firstDow  = new Date(year, month - 1, 1).getDay(); // 0=Sun
    var offset    = (firstDow + 6) % 7;                    // Monday-first offset

    // Disable "prev" if we're already on current or past month
    var isCurrentOrPast = (year < today.getFullYear()) ||
                          (year === today.getFullYear() && month <= today.getMonth() + 1);

    $w.find('#dg-month-label').text(MONTHS[month - 1] + ' ' + year);
    $w.find('.dg-prev-month').prop('disabled', isCurrentOrPast);

    var html = '';

    // Day-of-week headers
    for (var d = 0; d < 7; d++) {
      html += '<span class="dg-dow">' + DAYS[d] + '</span>';
    }

    // Empty leading cells
    for (var i = 0; i < offset; i++) {
      html += '<span></span>';
    }

    // Day buttons
    for (var day = 1; day <= daysInMon; day++) {
      var ds      = pad(year) + '-' + pad(month) + '-' + pad(day);
      var isPast  = ds < todayStr;
      var isToday = ds === todayStr;
      var cls     = 'dg-day';
      if (isPast)  cls += ' dg-day-past';
      else         cls += ' dg-day-available';
      if (isToday) cls += ' dg-day-today';

      html += '<button class="' + cls + '" data-date="' + ds + '"'
            + (isPast ? ' disabled' : '') + '>'
            + day + '</button>';
    }

    $w.find('#dg-cal-grid').html(html);
  }

  /* ═══════════════════════════════════════════════
   * Load time slots via AJAX
   * ═════════════════════════════════════════════*/
  function loadSlots ($w, eventId, date) {
    var $c = $w.find('#dg-slots-container');
    $c.html('<p class="dg-slots-loading">' + escHtml(strings.loading || 'Laden...') + '</p>');

    $.post(ajaxUrl, { action: 'digitify_get_slots', nonce: nonce, event_type_id: eventId, date: date })
      .done(function (res) {
        if (!res.success || !res.data || res.data.length === 0) {
          $c.html('<p class="dg-slots-empty">' + escHtml(strings.no_slots || 'Geen tijdsloten beschikbaar.') + '</p>');
          return;
        }

        var html = '<div class="dg-slots-list">';
        $.each(res.data, function (_, slot) {
          html += '<button class="dg-slot-btn"'
                + ' data-start="'   + escAttr(slot.start) + '"'
                + ' data-time="'    + escAttr(slot.time)  + '">'
                + escHtml(slot.time) + '</button>';
        });
        html += '</div>';
        $c.html(html);

        $w.find('.dg-day[data-date="' + date + '"]').addClass('dg-day-has-slots');
        notifyHeight();
      })
      .fail(function () {
        $c.html('<p class="dg-slots-empty">Laden mislukt. Probeer opnieuw.</p>');
      });
  }

  /* ═══════════════════════════════════════════════
   * Form validation
   * ═════════════════════════════════════════════*/
  function validateForm ($w) {
    clearErrors($w);
    var $form = $w.find('#dg-booking-form');
    var name  = $.trim($form.find('[name="name"]').val());
    var email = $.trim($form.find('[name="email"]').val());
    var phone = $.trim($form.find('[name="phone"]').val());
    var ok    = true;

    if (!name || name.length < 2) {
      setFieldErr($w, 'name', 'Naam is verplicht (min. 2 tekens).');
      ok = false;
    }
    if (!email) {
      setFieldErr($w, 'email', 'E-mailadres is verplicht.');
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setFieldErr($w, 'email', 'Vul een geldig e-mailadres in.');
      ok = false;
    }
    if (!phone) {
      setFieldErr($w, 'phone', 'Telefoonnummer is verplicht.');
      ok = false;
    } else if (!/^[+\d][\d\s\-().]{5,19}$/.test(phone)) {
      setFieldErr($w, 'phone', 'Vul een geldig nummer in (bijv. +32 470 12 34 56).');
      ok = false;
    }

    return ok;
  }

  function setFieldErr ($w, field, msg) {
    $w.find('[name="' + field + '"]').addClass('dg-input-error');
    $w.find('#dg-error-' + field).text(msg);
  }

  function clearErrors ($w) {
    $w.find('.dg-input-error').removeClass('dg-input-error');
    $w.find('.dg-field-error').text('');
    $w.find('#dg-form-error-banner').hide().text('');
  }

  function showBannerError ($w, msg) {
    $w.find('#dg-form-error-banner').text('✕ ' + msg).show();
  }

  /* ═══════════════════════════════════════════════
   * Pending confirmation screen
   * ═════════════════════════════════════════════*/
  function renderConfirmation ($w, data, name, email) {
    var start    = new Date((data.start || '').replace(' ', 'T'));
    var dateStr  = isNaN(start)
      ? ''
      : start.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var timeStr  = isNaN(start)
      ? ''
      : start.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });

    var html = row('Naam',   name)
             + row('E-mail', email)
             + row('Datum',  dateStr)
             + row('Tijd',   timeStr);

    $w.find('#dg-confirm-details').html(html);
  }

  function row (label, value) {
    return '<div class="dg-summary-row"><strong>' + escHtml(label) + '</strong><span>' + escHtml(value) + '</span></div>';
  }

  /* ═══════════════════════════════════════════════
   * Helpers
   * ═════════════════════════════════════════════*/
  function showStep ($w, step) {
    $w.find('.dg-step').addClass('dg-step-hidden');
    $w.find('[data-step="' + step + '"]').removeClass('dg-step-hidden');

    // Update stepper in topbar
    var $items = $w.find('.dg-stepper-item');
    $items.removeClass('dg-stepper-active dg-stepper-done');
    $items.each(function () {
      var s = parseInt($(this).data('stepper'), 10);
      if (!s) return;
      if (s < step) $(this).addClass('dg-stepper-done');
      if (s === step) $(this).addClass('dg-stepper-active');
    });
  }

  function setSubmitLoading ($btn, loading) {
    $btn.find('.dg-btn-text').text(loading ? (strings.loading || 'Laden...') : (strings.confirm_btn || 'Aanvragen'));
    $btn.find('.dg-btn-spin').toggle(loading);
    $btn.prop('disabled', loading);
  }

  function notifyHeight () {
    if (window.parent !== window) {
      setTimeout(function () {
        var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.parent.postMessage({ digitifyHeight: h }, '*');
      }, 60);
    }
  }

  function fmtDate (dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    return isNaN(d) ? dateStr : d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function pad (n) {
    return String(n).padStart(2, '0');
  }

  function escHtml (s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr (s) { return escHtml(s); }

})(jQuery);
