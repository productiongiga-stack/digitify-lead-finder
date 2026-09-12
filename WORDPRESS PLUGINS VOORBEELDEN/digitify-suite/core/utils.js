/**
 * Digitify Suite — Utility Functions
 * Shared helpers used across all modules.
 *
 * Migrated from: Helpers.php (CRM Core), various escapeHtml/formatDate
 * functions scattered across plugin JS files.
 */

/** Escape HTML to prevent XSS */
export function escHtml(str) {
  const el = document.createElement('div');
  el.textContent = String(str ?? '');
  return el.innerHTML;
}

/** Generate a unique ID */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Format date to dd/mm/yyyy */
export function formatDate(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Format date to dd/mm/yyyy HH:mm */
export function formatDateTime(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '—';
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Format date to relative string (e.g. "2 uur geleden") */
export function timeAgo(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return 'zojuist';
  if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} dagen geleden`;
  return formatDate(d);
}

/** Format currency (EUR) */
export function formatCurrency(amount, currency = 'EUR') {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

/** Normalize email (dedupe logic from CRM Core ContactRepository) */
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Simple debounce */
export function debounce(fn, ms = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Show a toast notification */
export function toast(message, duration = 3000) {
  const el = document.createElement('div');
  el.className = 'ds-toast';
  el.textContent = message;
  const container = document.getElementById('ds-toast-container') || document.body;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = '300ms ease';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/** Open a modal */
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

/** Close a modal */
export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/** Get color for pipeline stage */
export function pipelineColor(stage) {
  const map = {
    'Nieuw': 'var(--ds-pipeline-new)',
    'Gecontacteerd': 'var(--ds-pipeline-contacted)',
    'Offerte verzonden': 'var(--ds-pipeline-quoted)',
    'Gewonnen': 'var(--ds-pipeline-won)',
    'Verloren': 'var(--ds-pipeline-lost)',
  };
  return map[stage] || 'var(--ds-text-muted)';
}

/** Generate avatar color from string */
export function avatarColor(name) {
  const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < String(name).length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/** Get initials from name */
export function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}
