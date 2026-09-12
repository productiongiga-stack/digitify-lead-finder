/**
 * Offerte Wizard v2 — Dashboard JS
 * Funnel chart animation, KPI refresh, company filter interactions.
 * Depends on: OWMC_Admin (wp_localize_script)
 */
(function () {
  'use strict';

  const cfg   = window.OWMC_Admin || {};
  const ajax  = cfg.ajaxUrl || '/wp-admin/admin-ajax.php';
  const nonce = cfg.nonce  || '';

  /* ── Funnel bar animation ──────────────────────────────────────────────── */

  function animateFunnelBars() {
    // Bars are rendered server-side with data-pct attribute.
    // We animate them from 0 to target width on load.
    document.querySelectorAll('.owmc-funnel-bar[data-pct]').forEach(bar => {
      const target = parseFloat(bar.dataset.pct) || 0;
      bar.style.width = '0%';
      // Trigger reflow then animate
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bar.style.transition = 'width .7s cubic-bezier(.4,0,.2,1)';
          bar.style.width = target + '%';
        });
      });
    });
  }

  /* ── KPI number count-up ───────────────────────────────────────────────── */

  function countUpNumbers() {
    document.querySelectorAll('.owmc-kpi-value[data-count]').forEach(el => {
      const target = parseFloat(el.dataset.count) || 0;
      const isFloat = el.dataset.count.includes('.');
      const prefix  = el.dataset.prefix || '';
      const suffix  = el.dataset.suffix || '';
      const duration = 800;
      const start = performance.now();

      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = target * eased;
        el.textContent = prefix + (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ── Company filter ────────────────────────────────────────────────────── */

  function initCompanyFilter() {
    const sel = document.getElementById('owmc-dashboard-company-filter');
    if (!sel) return;

    sel.addEventListener('change', () => {
      const url = new URL(window.location.href);
      if (sel.value) {
        url.searchParams.set('company', sel.value);
      } else {
        url.searchParams.delete('company');
      }
      window.location.href = url.toString();
    });
  }

  /* ── Activity feed: relative timestamps ───────────────────────────────── */

  function initRelativeTimes() {
    document.querySelectorAll('[data-timestamp]').forEach(el => {
      const ts = parseInt(el.dataset.timestamp, 10) * 1000;
      if (!ts) return;

      function update() {
        const diff = (Date.now() - ts) / 1000;
        let text;
        if (diff < 60)          text = 'zojuist';
        else if (diff < 3600)   text = Math.round(diff / 60) + ' min geleden';
        else if (diff < 86400)  text = Math.round(diff / 3600) + ' uur geleden';
        else if (diff < 604800) text = Math.round(diff / 86400) + ' dag' + (Math.round(diff / 86400) === 1 ? '' : 'en') + ' geleden';
        else {
          // Fall back to formatted date
          const d = new Date(ts);
          text = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
        }
        el.textContent = text;
      }
      update();
      // Refresh every minute
      setInterval(update, 60000);
    });
  }

  /* ── KPI refresh (every 5 minutes) ────────────────────────────────────── */

  function initKpiRefresh() {
    const kpiRow = document.querySelector('.owmc-kpi-row');
    if (!kpiRow) return;

    const companyFilter = document.getElementById('owmc-dashboard-company-filter');

    function refresh() {
      const companyId = companyFilter ? companyFilter.value : '';
      const body = new FormData();
      body.append('action', 'owmc_dashboard_kpis');
      body.append('_nonce', nonce);
      if (companyId) body.append('company_id', companyId);

      fetch(ajax, { method: 'POST', body, credentials: 'same-origin' })
        .then(r => r.json())
        .then(res => {
          if (!res.success || !res.data) return;
          const d = res.data;

          setKpi('owmc-kpi-leads',      d.total,      '',   '');
          setKpi('owmc-kpi-conversion', d.conversion, '',   '%');
          setKpi('owmc-kpi-avg-value',  d.avg_value,  '€',  '');
          setKpi('owmc-kpi-open-rate',  d.open_rate,  '',   '%');
        })
        .catch(() => {}); // Fail silently — KPIs are non-critical
    }

    setInterval(refresh, 5 * 60 * 1000);
  }

  function setKpi(id, value, prefix, suffix) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (prefix || '') + (value ?? '—') + (suffix || '');
  }

  /* ── Mini sparkline (canvas) ───────────────────────────────────────────── */

  function initSparklines() {
    document.querySelectorAll('canvas[data-sparkline]').forEach(canvas => {
      const raw = canvas.dataset.sparkline;
      let points;
      try { points = JSON.parse(raw); } catch { return; }
      if (!points.length) return;

      const ctx = canvas.getContext('2d');
      const w   = canvas.width;
      const h   = canvas.height;
      const max = Math.max(...points, 1);

      ctx.clearRect(0, 0, w, h);

      const step = w / (points.length - 1 || 1);

      // Draw fill
      ctx.beginPath();
      ctx.moveTo(0, h - (points[0] / max) * (h - 4) - 2);
      points.forEach((v, i) => {
        ctx.lineTo(i * step, h - (v / max) * (h - 4) - 2);
      });
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(247,198,0,.15)';
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.moveTo(0, h - (points[0] / max) * (h - 4) - 2);
      points.forEach((v, i) => {
        ctx.lineTo(i * step, h - (v / max) * (h - 4) - 2);
      });
      ctx.strokeStyle = '#f7c600';
      ctx.lineWidth   = 2;
      ctx.lineJoin    = 'round';
      ctx.stroke();
    });
  }

  /* ── Period selector ───────────────────────────────────────────────────── */

  function initPeriodSelector() {
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('days', btn.dataset.period);
        window.location.href = url.toString();
      });
    });

    // Highlight active period button
    const days = new URL(window.location.href).searchParams.get('days') || '30';
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.classList.toggle('owmc-btn--primary',   btn.dataset.period === days);
      btn.classList.toggle('owmc-btn--secondary', btn.dataset.period !== days);
    });
  }

  /* ── Init ──────────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    animateFunnelBars();
    countUpNumbers();
    initCompanyFilter();
    initRelativeTimes();
    initKpiRefresh();
    initSparklines();
    initPeriodSelector();
  });

})();
