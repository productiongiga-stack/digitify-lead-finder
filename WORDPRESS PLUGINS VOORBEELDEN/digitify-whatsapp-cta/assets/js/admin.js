/* Digitify WhatsApp CTA – Admin JS */
(function () {
	'use strict';

	function init() {
		setupRepeatableQuestions();
	}

	function setupRepeatableQuestions() {
		var container = document.getElementById('dwa-questions-container');
		var addBtn    = document.getElementById('dwa-add-question-btn');

		if (!container || !addBtn) {
			return;
		}

		// Bind existing remove buttons
		bindRemoveButtons(container);

		addBtn.addEventListener('click', function () {
			var items = container.querySelectorAll('.dwa-question-item');
			var index = items.length;

			var item = document.createElement('div');
			item.className = 'dwa-question-item dwa-question-item--new';
			item.innerHTML =
				'<div class="dwa-question-item__drag">'
				+ '<svg viewBox="0 0 24 24" fill="none" width="14" height="14">'
				+ '<circle cx="9" cy="6" r="1.5" fill="#999"/><circle cx="15" cy="6" r="1.5" fill="#999"/>'
				+ '<circle cx="9" cy="12" r="1.5" fill="#999"/><circle cx="15" cy="12" r="1.5" fill="#999"/>'
				+ '<circle cx="9" cy="18" r="1.5" fill="#999"/><circle cx="15" cy="18" r="1.5" fill="#999"/>'
				+ '</svg>'
				+ '</div>'
				+ '<div class="dwa-question-item__fields">'
				+ '<input type="text" name="dwa_settings[questions][' + index + '][label]" value="" placeholder="Button label" class="dwa-input dwa-input--label">'
				+ '<textarea name="dwa_settings[questions][' + index + '][message]" rows="2" placeholder="WhatsApp message" class="dwa-input dwa-input--message"></textarea>'
				+ '</div>'
				+ '<button type="button" class="dwa-question-remove-btn" aria-label="Remove question">'
				+ '<svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
				+ '</button>';

			container.appendChild(item);

			// Bind the new remove button
			var removeBtn = item.querySelector('.dwa-question-remove-btn');
			if (removeBtn) {
				bindRemove(removeBtn);
			}

			// Focus the new label input
			var labelInput = item.querySelector('input[type="text"]');
			if (labelInput) {
				labelInput.focus();
			}

			// Animate entry
			requestAnimationFrame(function () {
				item.classList.remove('dwa-question-item--new');
			});
		});
	}

	function bindRemoveButtons(container) {
		var btns = container.querySelectorAll('.dwa-question-remove-btn');
		for (var i = 0; i < btns.length; i++) {
			bindRemove(btns[i]);
		}
	}

	function bindRemove(btn) {
		btn.addEventListener('click', function () {
			var item = btn.closest('.dwa-question-item');
			if (item) {
				item.remove();
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
