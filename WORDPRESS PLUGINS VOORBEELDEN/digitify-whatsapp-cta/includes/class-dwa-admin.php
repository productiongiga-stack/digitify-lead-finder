<?php
if (!defined('ABSPATH')) {
	exit;
}

class DWA_Admin {

	public function __construct() {
		add_action('admin_menu', array($this, 'add_menu_page'));
		add_action('admin_init', array($this, 'register_settings'));
		add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
	}

	// WhatsApp SVG as base64 for menu icon
	private function get_menu_icon() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#a7aaad" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378L2 18l4.336-1.138a9.859 9.859 0 004.709 1.201h.004c5.454 0 9.893-4.434 9.893-9.893 0-2.643-1.03-5.127-2.9-6.995C16.14 1.03 13.657 0 11.014 0c-5.454 0-9.893 4.434-9.893 9.893 0 1.744.454 3.451 1.317 4.951L2 18l4.238-1.113a9.898 9.898 0 004.813 1.234"/></svg>';
		return 'data:image/svg+xml;base64,' . base64_encode($svg);
	}

	public function add_menu_page() {
		add_menu_page(
			__('WhatsApp CTA Settings', 'dwa'),
			__('WhatsApp CTA', 'dwa'),
			'manage_options',
			'dwa-settings',
			array($this, 'render_admin_page'),
			$this->get_menu_icon(),
			80
		);
	}

	public function register_settings() {
		register_setting(
			'dwa-settings-group',
			'dwa_settings',
			array(
				'sanitize_callback' => array('DWA_Settings_Validator', 'sanitize'),
				'show_in_rest'      => false,
			)
		);
	}

	public function render_admin_page() {
		if (!current_user_can('manage_options')) {
			return;
		}

		$settings = get_option('dwa_settings', array());

		settings_errors('dwa_settings');
		?>
		<div class="wrap dwa-admin-page">
			<div class="dwa-admin-header">
				<div class="dwa-admin-header__logo">
					<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#ffffff" width="28" height="28"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378L2 18l4.336-1.138a9.859 9.859 0 004.709 1.201h.004c5.454 0 9.893-4.434 9.893-9.893 0-2.643-1.03-5.127-2.9-6.995C16.14 1.03 13.657 0 11.014 0c-5.454 0-9.893 4.434-9.893 9.893 0 1.744.454 3.451 1.317 4.951L2 18l4.238-1.113a9.898 9.898 0 004.813 1.234"/></svg>
				</div>
				<div class="dwa-admin-header__text">
					<h1>WhatsApp CTA</h1>
					<p>by Digitify</p>
				</div>
			</div>

			<form method="post" action="options.php" class="dwa-admin-form">
				<?php settings_fields('dwa-settings-group'); ?>

				<div class="dwa-admin-grid">

					<!-- LEFT COLUMN -->
					<div class="dwa-admin-col dwa-admin-col--main">

						<!-- General Settings -->
						<div class="dwa-admin-card">
							<div class="dwa-admin-card__header">
								<span class="dwa-admin-card__icon">⚙️</span>
								<h2>General Settings</h2>
							</div>
							<div class="dwa-admin-card__body">
								<div class="dwa-field-row">
									<label class="dwa-field-label">Enable Plugin</label>
									<div class="dwa-field-control">
										<?php $this->field_toggle_inline('enabled', 'Activate the WhatsApp CTA button', $settings); ?>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_whatsapp_number">WhatsApp Number <span class="dwa-required">*</span></label>
									<div class="dwa-field-control">
										<input type="text" id="dwa_whatsapp_number" name="dwa_settings[whatsapp_number]" value="<?php echo esc_attr(isset($settings['whatsapp_number']) ? $settings['whatsapp_number'] : ''); ?>" placeholder="e.g. 32470123456" class="dwa-input">
										<p class="dwa-help-text">International format, no +, spaces or dashes.<br>🇧🇪 Belgium: <code>32470123456</code> &nbsp; 🇳🇱 Netherlands: <code>31612345678</code></p>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_company_name">Company Name</label>
									<div class="dwa-field-control">
										<input type="text" id="dwa_company_name" name="dwa_settings[company_name]" value="<?php echo esc_attr(isset($settings['company_name']) ? $settings['company_name'] : ''); ?>" placeholder="Your company name" class="dwa-input">
										<p class="dwa-help-text">Used in <code>{{company_name}}</code> variable</p>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label">Auto-show in Footer</label>
									<div class="dwa-field-control">
										<?php $this->field_toggle_inline('auto_show_footer', 'Automatically inject button in footer', $settings); ?>
									</div>
								</div>
							</div>
						</div>

						<!-- Display Settings -->
						<div class="dwa-admin-card">
							<div class="dwa-admin-card__header">
								<span class="dwa-admin-card__icon">📱</span>
								<h2>Display Settings</h2>
							</div>
							<div class="dwa-admin-card__body">
								<div class="dwa-field-row">
									<label class="dwa-field-label">Show on Mobile</label>
									<div class="dwa-field-control">
										<?php $this->field_toggle_inline('show_on_mobile', 'Visible on smartphones and tablets', $settings); ?>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label">Show on Desktop</label>
									<div class="dwa-field-control">
										<?php $this->field_toggle_inline('show_on_desktop', 'Visible on desktop browsers', $settings); ?>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_button_position">Button Position</label>
									<div class="dwa-field-control">
										<select id="dwa_button_position" name="dwa_settings[button_position]" class="dwa-select">
											<?php
											$pos = isset($settings['button_position']) ? $settings['button_position'] : 'bottom-right';
											foreach (array('bottom-right' => 'Bottom Right', 'bottom-left' => 'Bottom Left') as $v => $l) {
												printf('<option value="%s" %s>%s</option>', esc_attr($v), selected($pos, $v, false), esc_html($l));
											}
											?>
										</select>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_button_size">Button Size</label>
									<div class="dwa-field-control dwa-field-control--inline">
										<input type="number" id="dwa_button_size" name="dwa_settings[button_size]" value="<?php echo intval(isset($settings['button_size']) ? $settings['button_size'] : 56); ?>" min="30" max="100" class="dwa-input dwa-input--small">
										<span class="dwa-unit">px</span>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_icon_size">Icon Size</label>
									<div class="dwa-field-control dwa-field-control--inline">
										<input type="number" id="dwa_icon_size" name="dwa_settings[icon_size]" value="<?php echo intval(isset($settings['icon_size']) ? $settings['icon_size'] : 28); ?>" min="16" max="48" class="dwa-input dwa-input--small">
										<span class="dwa-unit">px</span>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_border_radius">Border Radius</label>
									<div class="dwa-field-control dwa-field-control--inline">
										<input type="number" id="dwa_border_radius" name="dwa_settings[border_radius]" value="<?php echo intval(isset($settings['border_radius']) ? $settings['border_radius'] : 50); ?>" min="0" max="50" class="dwa-input dwa-input--small">
										<span class="dwa-unit">px</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Link Configuration -->
						<div class="dwa-admin-card">
							<div class="dwa-admin-card__header">
								<span class="dwa-admin-card__icon">🔗</span>
								<h2>Link Configuration</h2>
							</div>
							<div class="dwa-admin-card__body">
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_link_type">Link Type</label>
									<div class="dwa-field-control">
										<select id="dwa_link_type" name="dwa_settings[link_type]" class="dwa-select">
											<?php
											$lt = isset($settings['link_type']) ? $settings['link_type'] : 'wa.me';
											foreach (array('wa.me' => 'wa.me (Recommended)', 'api.whatsapp.com' => 'api.whatsapp.com') as $v => $l) {
												printf('<option value="%s" %s>%s</option>', esc_attr($v), selected($lt, $v, false), esc_html($l));
											}
											?>
										</select>
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label">Open in New Tab</label>
									<div class="dwa-field-control">
										<?php $this->field_toggle_inline('open_in_new_tab', 'Open WhatsApp link in new tab/window', $settings); ?>
									</div>
								</div>
							</div>
						</div>

						<!-- Questions & Options -->
						<div class="dwa-admin-card">
							<div class="dwa-admin-card__header">
								<span class="dwa-admin-card__icon">💬</span>
								<h2>Questions & Options</h2>
							</div>
							<div class="dwa-admin-card__body">
								<p class="dwa-section-intro">These options appear as buttons inside the popup. Click a question to open WhatsApp with a pre-filled message.</p>
								<p class="dwa-help-text" style="margin-bottom:16px;">Available variables in messages: <code>{{site_name}}</code>, <code>{{company_name}}</code>, <code>{{page_title}}</code>, <code>{{page_url}}</code>, <code>{{option_label}}</code></p>
								<div id="dwa-questions-container" class="dwa-questions-list">
									<?php
									$questions = isset($settings['questions']) ? $settings['questions'] : array();
									foreach ($questions as $index => $question) :
										?>
										<div class="dwa-question-item">
											<div class="dwa-question-item__drag">
												<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="9" cy="6" r="1.5" fill="#999"/><circle cx="15" cy="6" r="1.5" fill="#999"/><circle cx="9" cy="12" r="1.5" fill="#999"/><circle cx="15" cy="12" r="1.5" fill="#999"/><circle cx="9" cy="18" r="1.5" fill="#999"/><circle cx="15" cy="18" r="1.5" fill="#999"/></svg>
											</div>
											<div class="dwa-question-item__fields">
												<input type="text" name="dwa_settings[questions][<?php echo intval($index); ?>][label]" value="<?php echo esc_attr($question['label']); ?>" placeholder="Button label" class="dwa-input dwa-input--label">
												<textarea name="dwa_settings[questions][<?php echo intval($index); ?>][message]" rows="2" placeholder="WhatsApp message" class="dwa-input dwa-input--message"><?php echo esc_textarea($question['message']); ?></textarea>
											</div>
											<button type="button" class="dwa-question-remove-btn" aria-label="Remove question">
												<svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
											</button>
										</div>
									<?php endforeach; ?>
								</div>
								<button type="button" id="dwa-add-question-btn" class="dwa-btn dwa-btn--add">
									<svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
									Add Question
								</button>
							</div>
						</div>

						<!-- Page Exclusions -->
						<div class="dwa-admin-card">
							<div class="dwa-admin-card__header">
								<span class="dwa-admin-card__icon">🚫</span>
								<h2>Page Exclusions</h2>
							</div>
							<div class="dwa-admin-card__body">
								<div class="dwa-field-row dwa-field-row--stacked">
									<label class="dwa-field-label" for="dwa_exclude_pages">Exclude Pages</label>
									<?php
									$exclude_val = isset($settings['exclude_pages']) ? $settings['exclude_pages'] : '';
									if (is_array($exclude_val)) {
										$exclude_val = implode("\n", array_map('strval', $exclude_val));
									}
									?>
									<textarea id="dwa_exclude_pages" name="dwa_settings[exclude_pages]" rows="5" class="dwa-textarea"><?php echo esc_textarea($exclude_val); ?></textarea>
									<p class="dwa-help-text">Enter post/page IDs or slugs — one per line or comma-separated.<br>Example: <code>5</code>, <code>contact</code>, <code>about-us</code></p>
								</div>
							</div>
						</div>

					</div><!-- .dwa-admin-col--main -->

					<!-- RIGHT COLUMN -->
					<div class="dwa-admin-col dwa-admin-col--side">

						<!-- Button Text -->
						<div class="dwa-admin-card">
							<div class="dwa-admin-card__header">
								<span class="dwa-admin-card__icon">🎨</span>
								<h2>Button Styling</h2>
							</div>
							<div class="dwa-admin-card__body">
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_button_text">Button Text</label>
									<div class="dwa-field-control">
										<input type="text" id="dwa_button_text" name="dwa_settings[button_text]" value="<?php echo esc_attr(isset($settings['button_text']) ? $settings['button_text'] : 'Need Help?'); ?>" maxlength="50" class="dwa-input">
									</div>
								</div>
								<div class="dwa-color-grid">
									<?php
									$colors = array(
										'button_color'      => 'Button Color',
										'button_text_color' => 'Text Color',
										'button_icon_color' => 'Icon Color',
									);
									$defaults_color = array(
										'button_color'      => '#25d366',
										'button_text_color' => '#ffffff',
										'button_icon_color' => '#ffffff',
									);
									foreach ($colors as $key => $label) {
										$val = isset($settings[$key]) ? $settings[$key] : $defaults_color[$key];
										?>
										<div class="dwa-color-item">
											<input type="color" name="dwa_settings[<?php echo esc_attr($key); ?>]" value="<?php echo esc_attr($val); ?>" class="dwa-color-picker">
											<label><?php echo esc_html($label); ?></label>
										</div>
										<?php
									}
									?>
								</div>
							</div>
						</div>

						<!-- Popup Styling -->
						<div class="dwa-admin-card">
							<div class="dwa-admin-card__header">
								<span class="dwa-admin-card__icon">💬</span>
								<h2>Popup Styling</h2>
							</div>
							<div class="dwa-admin-card__body">
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_popup_title">Popup Title</label>
									<div class="dwa-field-control">
										<input type="text" id="dwa_popup_title" name="dwa_settings[popup_title]" value="<?php echo esc_attr(isset($settings['popup_title']) ? $settings['popup_title'] : 'Chat with us'); ?>" maxlength="100" class="dwa-input">
									</div>
								</div>
								<div class="dwa-field-row">
									<label class="dwa-field-label" for="dwa_popup_intro_text">Intro Text</label>
									<div class="dwa-field-control">
										<textarea id="dwa_popup_intro_text" name="dwa_settings[popup_intro_text]" rows="2" class="dwa-input"><?php echo esc_textarea(isset($settings['popup_intro_text']) ? $settings['popup_intro_text'] : ''); ?></textarea>
									</div>
								</div>
								<div class="dwa-color-grid">
									<?php
									$popup_colors = array(
										'popup_header_color' => 'Header Color',
										'popup_bg_color'     => 'Background',
										'popup_text_color'   => 'Text Color',
										'popup_button_color' => 'Option Button',
									);
									$defaults_popup = array(
										'popup_header_color' => '#25d366',
										'popup_bg_color'     => '#ffffff',
										'popup_text_color'   => '#333333',
										'popup_button_color' => '#25d366',
									);
									foreach ($popup_colors as $key => $label) {
										$val = isset($settings[$key]) ? $settings[$key] : $defaults_popup[$key];
										?>
										<div class="dwa-color-item">
											<input type="color" name="dwa_settings[<?php echo esc_attr($key); ?>]" value="<?php echo esc_attr($val); ?>" class="dwa-color-picker">
											<label><?php echo esc_html($label); ?></label>
										</div>
										<?php
									}
									?>
								</div>
							</div>
						</div>

						<!-- Save button -->
						<div class="dwa-admin-save">
							<?php submit_button('Save Settings', 'primary large', 'submit', false); ?>
						</div>

					</div><!-- .dwa-admin-col--side -->

				</div><!-- .dwa-admin-grid -->
			</form>
		</div>
		<?php
	}

	private function field_toggle_inline($name, $label, $settings) {
		$value = isset($settings[$name]) ? (int) $settings[$name] : 0;
		?>
		<label class="dwa-toggle">
			<input type="checkbox" name="dwa_settings[<?php echo esc_attr($name); ?>]" value="1" <?php checked($value, 1); ?>>
			<span class="dwa-toggle__track"></span>
			<span class="dwa-toggle__label"><?php echo esc_html($label); ?></span>
		</label>
		<?php
	}

	public function enqueue_admin_scripts($hook) {
		// Hook is 'toplevel_page_dwa-settings' for add_menu_page()
		if ('toplevel_page_dwa-settings' !== $hook) {
			return;
		}

		wp_enqueue_style('dwa-admin-css', DWA_URL . 'assets/css/admin.css', array(), DWA_VERSION);
		wp_enqueue_script('dwa-admin-js', DWA_URL . 'assets/js/admin.js', array(), DWA_VERSION, true);
		wp_localize_script('dwa-admin-js', 'dwaAdmin', array(
			'nonce' => wp_create_nonce('dwa-admin-nonce'),
		));
	}
}
