<?php
if ( ! defined('ABSPATH') ) exit;

$base_url = admin_url('admin.php?page=' . DAP_SLUG);

function dap_tab_url($tab) {
	return admin_url('admin.php?page=' . DAP_SLUG . '&tab=' . $tab);
}

$week_key = isset($_GET['week']) ? sanitize_text_field($_GET['week']) : '';
if ( ! preg_match('/^\d{4}-W\d{2}$/', $week_key) ) {
	$year = (int) wp_date('o', current_time('timestamp'));
	$week = (int) wp_date('W', current_time('timestamp'));
	$week_key = sprintf('%d-W%02d', $year, $week);
}
?>
<div class="wrap dap-wrap">
	<div class="dap-topbar">
		<div class="dap-title">
			<h1>Digitify Agenda Pro</h1>
			<p class="description">Weekagenda + to-do's (met minuten) in een compact, overzichtelijk dag-overzicht.</p>
		</div>
		<div class="dap-badges">
			<button type="button" class="button dap-dark-toggle" id="dap-dark-toggle" aria-pressed="false" title="Dark mode">
				<span class="dashicons dashicons-lightbulb"></span>
				<span class="dap-dark-toggle__label">Dark</span>
			</button>
			<span class="dap-badge">v<?php echo esc_html(DAP_VERSION); ?></span>
			<?php if ( function_exists('digitify_crm_log_event') ): ?>
				<span class="dap-badge ok">CRM Core gekoppeld</span>
			<?php else: ?>
				<span class="dap-badge warn">CRM Core niet gevonden</span>
			<?php endif; ?>
		</div>
	</div>

	<nav class="nav-tab-wrapper dap-tabs">
		<?php foreach ( $tabs as $k => $label ): ?>
			<a class="nav-tab <?php echo $tab === $k ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url( dap_tab_url($k) ); ?>">
				<?php echo esc_html($label); ?>
			</a>
		<?php endforeach; ?>
	</nav>

	<div class="dap-content" data-week="<?php echo esc_attr($week_key); ?>" data-tab="<?php echo esc_attr($tab); ?>">

		<?php if ( $tab === 'week' ): ?>
			<div class="dap-row dap-row--space">
				<div class="dap-weeknav">
					<button class="button" id="dap-prev-week">&larr; Vorige week</button>
					<div class="dap-weekmeta">
						<div id="dap-week-title" class="dap-weektitle">—</div>
						<div id="dap-week-range" class="dap-weekrange">—</div>
					</div>
					<button class="button" id="dap-next-week">Volgende week &rarr;</button>
				</div>
				<div class="dap-actions">
					<div class="dap-kpi" title="Agenda-duur + To-do minuten binnen deze week">
						<span class="dap-kpi-label">Tijd deze week</span>
						<strong id="dap-week-total">—</strong>
						<span class="dap-kpi-sub" id="dap-week-open">—</span>
					</div>
					<button class="button button-primary" id="dap-open-item-modal">+ Agenda item</button>
					<button class="button" id="dap-open-todo-modal">+ To-do (optioneel klant e-mail)</button>
				</div>
			</div>

			<div id="dap-color-legend" class="dap-legend" aria-label="Kleurenlegende"></div>

			<div class="dap-card" style="margin-top:14px;">
				<div class="dap-card-head">
					<h2>Weekoverzicht per dag</h2>
				<div class="dap-muted">Agenda items + to-do’s gegroepeerd per dag. To-do’s tellen mee met hun <strong>minuten</strong>.</div>
				</div>
				<div id="dap-week-days" class="dap-days"></div>
			</div>

		<?php elseif ( $tab === 'todos' ): ?>
			<div class="dap-row dap-row--space">
				<div>
				<h2 class="dap-h2">To-do’s (met minuten)</h2>
				<p class="dap-muted">Takenlijst met geschatte minuten. Handig voor planning en weekload.</p>
				</div>
				<div class="dap-actions">
					<button class="button button-primary" id="dap-open-todo-modal">+ To-do (optioneel klant e-mail)</button>
				</div>
			</div>
			<div class="dap-card">
				<div class="dap-card-head">
					<div id="dap-todo-totals" class="dap-muted"></div>

			<div class="dap-filterbar" id="dap-todo-filters">
				<div class="dap-filter">
					<label>Zoek</label>
					<input type="search" id="dap-todo-filter-q" placeholder="Titel of e-mail…" />
				</div>
				<div class="dap-filter">
					<label>Status</label>
					<select id="dap-todo-filter-status">
						<option value="all">Alles</option>
						<option value="open" selected>Open</option>
						<option value="done">Done</option>
					</select>
				</div>
				<div class="dap-filter">
					<label>Deadline</label>
					<select id="dap-todo-filter-due">
						<option value="all">Alles</option>
						<option value="overdue">Over tijd</option>
						<option value="today">Vandaag</option>
						<option value="week">Deze week</option>
						<option value="nodue">Geen deadline</option>
					</select>
				</div>
				<div class="dap-filter dap-filter--check">
					<label>&nbsp;</label>
					<label class="dap-checkline"><input type="checkbox" id="dap-todo-filter-hasemail" /> Enkel met klant e-mail</label>
				</div>
				<div class="dap-filter">
					<label>Sorteer</label>
					<select id="dap-todo-filter-sort">
						<option value="due_asc">Deadline ↑</option>
						<option value="due_desc">Deadline ↓</option>
						<option value="minutes_desc">Minuten ↓</option>
						<option value="minutes_asc">Minuten ↑</option>
						<option value="created_desc">Nieuwste</option>
					</select>
				</div>
			</div>

				</div>
				<div id="dap-todo-list" class="dap-list"></div>
			</div>
		<?php endif; ?>

	</div>

	<!-- Modals -->
	<div class="dap-modal" id="dap-modal-item" aria-hidden="true">
		<div class="dap-modal-card">
			<div class="dap-modal-head">
				<div class="dap-modal-title">Agenda item</div>
				<button class="dap-x" data-close>&times;</button>
			</div>
			<div class="dap-modal-body">
				<input type="hidden" id="dap-item-id" value="" />
				<div class="dap-form-grid">
					<label>Titel
						<input type="text" id="dap-item-title" placeholder="bv. Offerte bespreking" />
					</label>
					<label>Type
						<select id="dap-item-type"></select>
					</label>
					<label>Kleur
						<input type="color" id="dap-item-color" />
					</label>
					<label>Start
						<input type="datetime-local" id="dap-item-start" />
					</label>
					<label>Einde
						<input type="datetime-local" id="dap-item-end" />
					</label>
					<label>Status
						<select id="dap-item-status">
							<option value="open">Open</option>
							<option value="confirmed">Bevestigd</option>
							<option value="done">Afgerond</option>
							<option value="cancelled">Geannuleerd</option>
						</select>
					</label>
					<label>Klant e-mail (voor CRM)
						<input type="email" id="dap-item-email" placeholder="klant@bedrijf.be" />
					</label>
				</div>
				<label>Beschrijving
					<textarea id="dap-item-desc" rows="4" placeholder="Notities…"></textarea>
				</label>
				<div class="dap-inline-actions">
					<button class="button button-primary" id="dap-item-save">Opslaan</button>
					<button class="button" id="dap-item-delete" style="display:none;">Verwijderen</button>
				</div>
			</div>
		</div>
	</div>

	<div class="dap-modal" id="dap-modal-todo" aria-hidden="true">
		<div class="dap-modal-card">
			<div class="dap-modal-head">
				<div class="dap-modal-title">To-do</div>
				<button class="dap-x" data-close>&times;</button>
			</div>
			<div class="dap-modal-body">
				<input type="hidden" id="dap-todo-id" value="" />
				<div class="dap-form-grid">
					<label>Titel
						<input type="text" id="dap-todo-title" placeholder="bv. Bel klant" />
					</label>
					<label>Minuten (schatting)
						<input type="number" min="0" step="1" id="dap-todo-minutes" placeholder="bv. 90" />
						<small class="dap-muted">Wordt automatisch getoond als <strong>u/min</strong> (60 min = 1 uur).</small>
					</label>
					<label>Kleur
						<input type="color" id="dap-todo-color" value="#64748b" class="dap-color" />
					</label>
					<label>Deadline
						<input type="datetime-local" id="dap-todo-due" />
					</label>
					<label>Status
						<select id="dap-todo-status">
							<option value="open">Open</option>
							<option value="done">Afgerond</option>
						</select>
					</label>
					<label>Klant e-mail (optioneel)
						<input type="email" id="dap-todo-email" placeholder="klant@bedrijf.be" list="dap-crm-emails" />
						<small id="dap-todo-crmmeta" class="dap-muted" style="display:block; margin-top:6px;"></small>
						<datalist id="dap-crm-emails"></datalist>
					</label>
				</div>
				<label>Notities
					<textarea id="dap-todo-notes" rows="4" placeholder="Notities…"></textarea>
				</label>

				<div class="dap-checklist">
					<div class="dap-checklist-head">
						<div>
							<strong>Checklist</strong>
							<span id="dap-checklist-progress" class="dap-muted" style="margin-left:8px;"></span>
						</div>
						<div class="dap-checklist-add">
							<input type="text" id="dap-checklist-new" placeholder="Nieuw checklist item…" />
							<input type="number" min="0" step="1" id="dap-checklist-new-minutes" placeholder="Min." title="Minuten (schatting)" />
							<button class="button" id="dap-checklist-add">Toevoegen</button>
						</div>
					</div>
					<div id="dap-checklist-list" class="dap-checklist-list"></div>
					<div id="dap-checklist-empty" class="dap-muted" style="display:none; padding:8px 2px;">Sla deze to-do eerst op om de checklist te gebruiken.</div>
				</div>
				<div class="dap-inline-actions">
					<button class="button button-primary" id="dap-todo-save">Opslaan</button>
					<button class="button" id="dap-todo-delete" style="display:none;">Verwijderen</button>
				</div>
			</div>
		</div>
	</div>
</div>
