/* Digitify WhatsApp CTA – Frontend JS  v1.3 */
(function () {
	'use strict';

	function DWAWidget(root) {
		this.root      = root;
		this.trigger   = root.querySelector('.dwa-trigger');
		this.bubbles   = root.querySelector('.dwa-bubbles');
		this.phone     = root.getAttribute('data-phone') || '';
		this.linkType  = root.getAttribute('data-link-type') || 'wa.me';
		this.newTab    = root.getAttribute('data-new-tab') === '1';
		this.open      = false;
		this._onDocClick = this._handleDocClick.bind(this);
		this._onEsc      = this._handleEsc.bind(this);
		// Set initial hidden state synchronously via inline !important so no
		// theme or page-builder CSS can fight us before the user first clicks.
		this._initBubbles();
		this._bind();
	}

	// ── Initial hidden state ─────────────────────────────────────────────────
	// style.setProperty(prop, value, 'important') creates an inline !important
	// declaration — the highest possible priority in the CSS cascade. No external
	// stylesheet rule (Elementor, theme, etc.) can override it.
	DWAWidget.prototype._initBubbles = function () {
		if (!this.bubbles) { return; }
		var btns = this.bubbles.querySelectorAll('.dwa-bubble');
		for (var i = 0; i < btns.length; i++) {
			btns[i].style.setProperty('opacity',        '0',                             'important');
			btns[i].style.setProperty('transform',      'translateY(12px) scale(0.88)', 'important');
			btns[i].style.setProperty('pointer-events', 'none',                         'important');
		}
	};

	// ── Show / hide helpers ──────────────────────────────────────────────────
	DWAWidget.prototype._showBubble = function (btn, delay) {
		setTimeout(function () {
			btn.style.setProperty('opacity',        '1',                      'important');
			btn.style.setProperty('transform',      'translateY(0) scale(1)', 'important');
			btn.style.setProperty('pointer-events', 'all',                    'important');
		}, delay);
	};

	DWAWidget.prototype._hideBubble = function (btn, delay) {
		setTimeout(function () {
			btn.style.setProperty('opacity',        '0',                             'important');
			btn.style.setProperty('transform',      'translateY(12px) scale(0.88)', 'important');
			btn.style.setProperty('pointer-events', 'none',                         'important');
		}, delay);
	};

	// ── Event binding ────────────────────────────────────────────────────────
	DWAWidget.prototype._bind = function () {
		var self = this;

		if (!this.trigger) { return; }

		this.trigger.addEventListener('click', function (e) {
			e.stopPropagation();

			if (self.bubbles) {
				// Questions are configured → toggle the bubble menu.
				self.open ? self.close() : self.openMenu();
			} else {
				// No questions configured → open WhatsApp directly.
				var url = self._buildUrl('');
				if (url) {
					if (self.newTab) {
						window.open(url, '_blank', 'noopener,noreferrer');
					} else {
						window.location.href = url;
					}
				}
			}
		});

		if (this.bubbles) {
			var btns = this.bubbles.querySelectorAll('.dwa-bubble');
			for (var i = 0; i < btns.length; i++) {
				btns[i].addEventListener('click', this._handleBubble.bind(this, btns[i]));
			}
		}
	};

	// ── Open / close ─────────────────────────────────────────────────────────
	DWAWidget.prototype.openMenu = function () {
		this.open = true;
		this.root.classList.add('dwa-open');
		this.trigger.setAttribute('aria-expanded', 'true');

		if (this.bubbles) {
			var btns = this.bubbles.querySelectorAll('.dwa-bubble');
			for (var i = 0; i < btns.length; i++) {
				btns[i].setAttribute('tabindex', '0');
				// Stagger: closest bubble (last in DOM) appears first at 0 ms.
				this._showBubble(btns[i], (btns.length - 1 - i) * 55);
			}
		}

		document.addEventListener('click', this._onDocClick);
		document.addEventListener('keydown', this._onEsc);
	};

	DWAWidget.prototype.close = function () {
		this.open = false;
		this.root.classList.remove('dwa-open');
		this.trigger.setAttribute('aria-expanded', 'false');

		if (this.bubbles) {
			var btns = this.bubbles.querySelectorAll('.dwa-bubble');
			for (var i = 0; i < btns.length; i++) {
				btns[i].setAttribute('tabindex', '-1');
				// Stagger: topmost bubble (first in DOM) collapses first.
				this._hideBubble(btns[i], i * 40);
			}
		}

		document.removeEventListener('click', this._onDocClick);
		document.removeEventListener('keydown', this._onEsc);
	};

	// ── Handlers ─────────────────────────────────────────────────────────────
	DWAWidget.prototype._handleDocClick = function (e) {
		if (!this.root.contains(e.target)) {
			this.close();
		}
	};

	DWAWidget.prototype._handleEsc = function (e) {
		if (e.key === 'Escape') {
			this.close();
			this.trigger.focus();
		}
	};

	DWAWidget.prototype._handleBubble = function (btn) {
		var message = btn.getAttribute('data-message') || '';
		var url     = this._buildUrl(message);
		if (!url) { return; }

		if (this.newTab) {
			window.open(url, '_blank', 'noopener,noreferrer');
		} else {
			window.location.href = url;
		}

		var self = this;
		setTimeout(function () { self.close(); }, 120);
	};

	DWAWidget.prototype._buildUrl = function (message) {
		var phone = this.phone.replace(/\D/g, '');
		if (!phone || phone.length < 7) { return ''; }

		var enc = encodeURIComponent(message);
		return this.linkType === 'wa.me'
			? 'https://wa.me/' + phone + '?text=' + enc
			: 'https://api.whatsapp.com/send?phone=' + phone + '&text=' + enc;
	};

	// ── Boot ─────────────────────────────────────────────────────────────────
	function boot() {
		var widgets = document.querySelectorAll('.dwa-cta[data-phone]');
		for (var i = 0; i < widgets.length; i++) {
			new DWAWidget(widgets[i]);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
