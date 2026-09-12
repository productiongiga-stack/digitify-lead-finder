<?php
if (!defined('ABSPATH')) {
	exit;
}

class DWA_Frontend {
	private static $footer_rendered = false;

	public function __construct() {
		add_action('wp_footer', array($this, 'render_footer'), 20);
		add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
		add_shortcode('whatsapp_cta', array($this, 'render_shortcode'));
	}

	// -------------------------------------------------------------------------
	// Rendering gating
	// -------------------------------------------------------------------------

	public function should_render() {
		$settings = get_option('dwa_settings', array());

		if (empty($settings['enabled'])) {
			return false;
		}
		if (empty($settings['whatsapp_number'])) {
			return false;
		}

		$is_mobile    = wp_is_mobile();
		$show_mobile  = !empty($settings['show_on_mobile']);
		$show_desktop = !empty($settings['show_on_desktop']);

		if ($is_mobile && !$show_mobile) {
			return false;
		}
		if (!$is_mobile && !$show_desktop) {
			return false;
		}

		if (!empty($settings['exclude_pages'])) {
			if ($this->is_excluded($settings['exclude_pages'])) {
				return false;
			}
		}

		return apply_filters('dwa_should_render', true);
	}

	private function is_excluded($exclude_raw) {
		$items = is_string($exclude_raw)
			? preg_split('/[\n,]+/', $exclude_raw)
			: (array) $exclude_raw;

		$post_id   = get_queried_object_id();
		$post_slug = '';
		$queried   = get_queried_object();
		if ($queried instanceof WP_Post) {
			$post_slug = $queried->post_name;
		}

		foreach ($items as $item) {
			$item = trim($item);
			if ('' === $item) {
				continue;
			}
			if (is_numeric($item)) {
				if ((int) $item === $post_id) {
					return true;
				}
			} elseif ($item === $post_slug) {
				return true;
			}
		}
		return false;
	}

	// -------------------------------------------------------------------------
	// Footer auto-injection
	// -------------------------------------------------------------------------

	public function render_footer() {
		if (self::$footer_rendered) {
			return;
		}

		$settings = get_option('dwa_settings', array());
		if (empty($settings['auto_show_footer'])) {
			return;
		}
		if (!$this->should_render()) {
			return;
		}

		echo $this->render_widget('dwa-footer', 'floating');
		self::$footer_rendered = true;
	}

	// -------------------------------------------------------------------------
	// Shortcode [whatsapp_cta]
	// -------------------------------------------------------------------------

	public function render_shortcode($atts) {
		$atts = shortcode_atts(
			array(
				'mode'  => 'inline',
				'class' => '',
			),
			$atts,
			'whatsapp_cta'
		);

		if (!$this->should_render()) {
			return '';
		}

		static $sc_count = 0;
		$sc_count++;
		$instance_id = 'dwa-sc-' . absint(get_the_ID()) . '-' . $sc_count;
		$mode        = in_array($atts['mode'], array('floating', 'inline'), true) ? $atts['mode'] : 'inline';

		return $this->render_widget($instance_id, $mode, sanitize_html_class($atts['class']));
	}

	// -------------------------------------------------------------------------
	// Core widget
	// -------------------------------------------------------------------------

	public function render_widget($instance_id, $mode = 'floating', $extra_class = '') {
		$settings = get_option('dwa_settings', array());

		$button_color       = isset($settings['button_color'])       ? $settings['button_color']       : '#25d366';
		$button_icon_color  = isset($settings['button_icon_color'])  ? $settings['button_icon_color']  : '#ffffff';
		$button_size        = isset($settings['button_size'])        ? max(30, min(100, intval($settings['button_size']))) : 56;
		$icon_size          = isset($settings['icon_size'])          ? max(16, min(48,  intval($settings['icon_size'])))  : 28;
		$border_radius      = isset($settings['border_radius'])      ? max(0,  min(50,  intval($settings['border_radius']))) : 50;
		$position           = isset($settings['button_position'])    ? $settings['button_position']    : 'bottom-right';
		$phone              = isset($settings['whatsapp_number'])    ? $settings['whatsapp_number']    : '';
		$link_type          = isset($settings['link_type'])          ? $settings['link_type']          : 'wa.me';
		$open_new_tab       = !empty($settings['open_in_new_tab'])   ? '1' : '0';
		$popup_button_color = isset($settings['popup_button_color']) ? $settings['popup_button_color'] : '#25d366';
		$questions          = isset($settings['questions']) && is_array($settings['questions']) ? $settings['questions'] : array();

		$id = esc_attr($instance_id);

		// Per-instance <style> block – immune to any theme/Elementor overrides
		$style_block = '<style id="dwa-s-' . $id . '">'
			. $this->build_widget_css(
				$id,
				sanitize_hex_color($button_color)       ?: '#25d366',
				sanitize_hex_color($button_icon_color)  ?: '#ffffff',
				$button_size, $icon_size, $border_radius,
				$position,
				sanitize_hex_color($popup_button_color) ?: '#25d366',
				$mode
			)
			. '</style>';

		$container_class = 'dwa-cta dwa-' . esc_attr($position);
		if ('inline' === $mode) {
			$container_class .= ' dwa-cta--inline';
		}
		if (!empty($extra_class)) {
			$container_class .= ' ' . $extra_class;
		}

		$html  = $style_block;
		$html .= '<div'
			. ' class="' . esc_attr($container_class) . '"'
			. ' id="' . $id . '"'
			. ' data-phone="' . esc_attr($phone) . '"'
			. ' data-link-type="' . esc_attr($link_type) . '"'
			. ' data-new-tab="' . esc_attr($open_new_tab) . '"'
			. '>';

		// Chat bubbles (quick replies)
		if (!empty($questions)) {
			$html .= '<div class="dwa-bubbles" role="menu" aria-label="' . esc_attr__('WhatsApp opties', 'dwa') . '">';
			foreach ($questions as $q) {
				$label   = isset($q['label'])   ? $q['label']   : '';
				$message = isset($q['message']) ? $q['message'] : '';
				if ('' === $label) {
					continue;
				}
				$resolved = $this->replace_variables($message, $label);
				$html .= '<button type="button" class="dwa-bubble" role="menuitem"'
					. ' data-message="' . esc_attr($resolved) . '"'
					. ' tabindex="-1"'
					. '>';
				$html .= '<span class="dwa-bubble__text">' . esc_html($label) . '</span>';
				$html .= '<svg class="dwa-bubble__arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" aria-hidden="true">'
					. '<path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
					. '<path d="M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
					. '</svg>';
				$html .= '</button>';
			}
			$html .= '</div>';
		}

		// Trigger button
		$html .= '<button'
			. ' class="dwa-trigger"'
			. ' type="button"'
			. ' aria-label="' . esc_attr__('Open WhatsApp Chat', 'dwa') . '"'
			. ' aria-expanded="false"'
			. '>';
		$html .= '<span class="dwa-ring" aria-hidden="true"></span>';
		$html .= '<span class="dwa-trigger__icon dwa-trigger__icon--wa" aria-hidden="true">'
			. $this->get_phone_svg($button_icon_color)
			. '</span>';
		$html .= '<span class="dwa-trigger__icon dwa-trigger__icon--close" aria-hidden="true">'
			. '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">'
			. '<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
			. '</svg>'
			. '</span>';
		$html .= '</button>';

		$html .= '</div>';

		return apply_filters('dwa_button_html', $html, $instance_id, $settings);
	}

	// -------------------------------------------------------------------------
	// Per-instance CSS block
	// Theme-agnostic: uses #ID selector + !important so no external stylesheet
	// (including Elementor, page builders, aggressive theme resets) can override.
	// The <style> tag is output in the body/footer, AFTER all <head> stylesheets,
	// so it wins any cascade tie among equal-specificity !important rules too.
	// -------------------------------------------------------------------------

	private function build_widget_css($id, $btn_color, $icon_color, $size, $icon_sz, $radius, $position, $bubble_btn_color, $mode) {
		$is_left  = 'bottom-left' === $position;
		$pos_prop = $is_left ? 'left' : 'right';
		$align    = $is_left ? 'flex-start' : 'flex-end';
		$bubble_r = $is_left ? '18px 18px 18px 4px' : '18px 18px 4px 18px';
		$close_sz = max(12, (int) round($icon_sz * 0.7));
		$is_inline = 'inline' === $mode;

		$pos_css = $is_inline
			? 'position:relative!important;bottom:auto!important;right:auto!important;left:auto!important;display:inline-flex!important;animation:none!important;'
			: "position:fixed!important;bottom:24px!important;{$pos_prop}:24px!important;display:flex!important;animation:dwa-boot 0.5s cubic-bezier(.34,1.56,.64,1) both!important;";

		$bubble_hover_move = $is_left ? 'translateX(3px)' : 'translateX(-3px)';

		return "
@keyframes dwa-boot{0%{opacity:0;transform:scale(0) translateY(16px)}70%{opacity:1;transform:scale(1.08) translateY(-4px)}100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes dwa-ring-pulse{0%{transform:scale(1);opacity:.55}70%{transform:scale(1.7);opacity:0}100%{transform:scale(1.7);opacity:0}}
#{$id}{{$pos_css}z-index:99999!important;flex-direction:column!important;align-items:{$align}!important;gap:10px!important;pointer-events:none!important;margin:0!important;padding:0!important;border:none!important;background:none!important;box-shadow:none!important;box-sizing:border-box!important;}
#{$id} .dwa-bubbles{display:flex!important;flex-direction:column!important;align-items:{$align}!important;gap:8px!important;pointer-events:none!important;margin:0!important;padding:0!important;background:none!important;border:none!important;box-shadow:none!important;box-sizing:border-box!important;}
#{$id} .dwa-bubble{pointer-events:none!important;display:inline-flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;max-width:min(320px,calc(100vw - 100px))!important;padding:11px 15px 11px 17px!important;background:#fff!important;background-color:#fff!important;color:#1a1a1a!important;border:none!important;margin:0!important;font-size:14px!important;font-weight:500!important;line-height:1.4!important;white-space:nowrap!important;border-radius:{$bubble_r}!important;box-shadow:0 3px 14px rgba(0,0,0,.13),0 1px 3px rgba(0,0,0,.08)!important;opacity:0!important;transform:translateY(12px) scale(.88)!important;transition:opacity .28s ease,transform .32s cubic-bezier(.34,1.56,.64,1),background .18s ease,color .18s ease,box-shadow .18s ease!important;will-change:opacity,transform!important;cursor:pointer!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif!important;box-sizing:border-box!important;text-decoration:none!important;-webkit-tap-highlight-color:transparent!important;touch-action:manipulation!important;letter-spacing:normal!important;text-transform:none!important;outline:none!important;}
#{$id} .dwa-bubble__text{flex:1!important;color:inherit!important;background:none!important;border:none!important;padding:0!important;margin:0!important;}
#{$id} .dwa-bubble__arrow{flex-shrink:0!important;opacity:.5!important;transition:opacity .15s ease,transform .15s ease!important;color:currentColor!important;stroke:currentColor!important;display:block!important;}
#{$id} .dwa-bubble:hover{background:{$bubble_btn_color}!important;background-color:{$bubble_btn_color}!important;color:#fff!important;box-shadow:0 6px 20px rgba(37,211,102,.3),0 2px 6px rgba(0,0,0,.1)!important;transform:{$bubble_hover_move} scale(1.02)!important;}
#{$id} .dwa-bubble:hover .dwa-bubble__arrow{opacity:1!important;transform:translateX(3px)!important;}
#{$id} .dwa-bubble:active{transform:scale(.98)!important;}
#{$id}.dwa-open .dwa-bubble{opacity:1!important;transform:translateY(0) scale(1)!important;pointer-events:all!important;}
#{$id}.dwa-open .dwa-bubble:nth-last-child(1){transition-delay:0ms!important;}
#{$id}.dwa-open .dwa-bubble:nth-last-child(2){transition-delay:55ms!important;}
#{$id}.dwa-open .dwa-bubble:nth-last-child(3){transition-delay:110ms!important;}
#{$id}.dwa-open .dwa-bubble:nth-last-child(4){transition-delay:165ms!important;}
#{$id}.dwa-open .dwa-bubble:nth-last-child(5){transition-delay:220ms!important;}
#{$id}.dwa-open .dwa-bubble:nth-last-child(6){transition-delay:275ms!important;}
#{$id}:not(.dwa-open) .dwa-bubble:nth-child(1){transition-delay:0ms!important;}
#{$id}:not(.dwa-open) .dwa-bubble:nth-child(2){transition-delay:40ms!important;}
#{$id}:not(.dwa-open) .dwa-bubble:nth-child(3){transition-delay:80ms!important;}
#{$id}:not(.dwa-open) .dwa-bubble:nth-child(4){transition-delay:120ms!important;}
#{$id}:not(.dwa-open) .dwa-bubble:nth-child(5){transition-delay:160ms!important;}
#{$id}:not(.dwa-open) .dwa-bubble:nth-child(6){transition-delay:200ms!important;}
#{$id} .dwa-trigger{position:relative!important;pointer-events:all!important;width:{$size}px!important;height:{$size}px!important;min-width:{$size}px!important;border-radius:{$radius}px!important;background:{$btn_color}!important;background-color:{$btn_color}!important;display:flex!important;align-items:center!important;justify-content:center!important;border:none!important;padding:0!important;margin:0!important;box-shadow:0 4px 20px rgba(37,211,102,.4)!important;cursor:pointer!important;overflow:visible!important;box-sizing:border-box!important;-webkit-tap-highlight-color:transparent!important;touch-action:manipulation!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif!important;transition:transform .35s cubic-bezier(.34,1.56,.64,1),box-shadow .25s ease!important;-webkit-appearance:none!important;appearance:none!important;}
#{$id} .dwa-trigger:hover{transform:scale(1.1) translateY(-2px)!important;box-shadow:0 8px 28px rgba(37,211,102,.55)!important;}
#{$id} .dwa-trigger:active{transform:scale(.97)!important;}
#{$id} .dwa-trigger:focus-visible{outline:3px solid {$btn_color}!important;outline-offset:4px!important;}
#{$id}.dwa-open .dwa-trigger{transform:rotate(45deg)!important;}
#{$id}.dwa-open .dwa-trigger:hover{transform:rotate(45deg) scale(1.08)!important;}
#{$id} .dwa-ring{position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:0!important;border-radius:inherit!important;background:{$btn_color}!important;opacity:0!important;animation:dwa-ring-pulse 2.8s ease-out infinite!important;pointer-events:none!important;display:block!important;box-sizing:border-box!important;margin:0!important;padding:0!important;border:none!important;}
#{$id}.dwa-open .dwa-ring{animation:none!important;}
#{$id} .dwa-trigger__icon{position:absolute!important;display:flex!important;align-items:center!important;justify-content:center!important;width:{$icon_sz}px!important;height:{$icon_sz}px!important;transition:opacity .2s ease,transform .25s cubic-bezier(.34,1.56,.64,1)!important;box-sizing:border-box!important;margin:0!important;padding:0!important;background:none!important;border:none!important;}
#{$id} .dwa-trigger__icon--wa{opacity:1!important;transform:scale(1) rotate(0deg)!important;}
#{$id} .dwa-trigger__icon--close{opacity:0!important;transform:scale(.4) rotate(-45deg)!important;color:{$icon_color}!important;}
#{$id} .dwa-trigger__icon--close svg{width:{$close_sz}px!important;height:{$close_sz}px!important;stroke:{$icon_color}!important;display:block!important;}
#{$id}.dwa-open .dwa-trigger__icon--wa{opacity:0!important;transform:scale(.4) rotate(45deg)!important;}
#{$id}.dwa-open .dwa-trigger__icon--close{opacity:1!important;transform:scale(1) rotate(0deg)!important;}
#{$id} .dwa-wa-svg{width:100%!important;height:100%!important;display:block!important;max-width:none!important;max-height:none!important;}
@media(max-width:480px){#{$id}{bottom:16px!important;{$pos_prop}:16px!important;}#{$id} .dwa-bubble{font-size:13px!important;padding:10px 13px 10px 15px!important;max-width:calc(100vw - 80px)!important;}}
@media print{#{$id}{display:none!important;}}
";
	}

	// Keep for backward compatibility
	public function render_button_html($instance_id) {
		return $this->render_widget($instance_id, 'floating');
	}

	public function render_popup_html($instance_id) {
		return '';
	}

	// -------------------------------------------------------------------------
	// Variable replacement
	// -------------------------------------------------------------------------

	public function replace_variables($text, $option_label = '') {
		$replacements = array(
			'{{site_name}}'    => get_bloginfo('name'),
			'{{company_name}}' => $this->get_company_name(),
			'{{page_title}}'   => get_the_title(),
			'{{page_url}}'     => get_the_permalink(),
			'{{option_label}}' => $option_label,
		);
		$replaced = str_replace(array_keys($replacements), array_values($replacements), $text);
		return apply_filters('dwa_variables', $replaced, $text, $replacements);
	}

	private function get_company_name() {
		$settings = get_option('dwa_settings', array());
		return isset($settings['company_name']) ? sanitize_text_field($settings['company_name']) : '';
	}

	// -------------------------------------------------------------------------
	// Enqueue
	// -------------------------------------------------------------------------

	public function enqueue_scripts() {
		if (!$this->should_render()) {
			return;
		}
		wp_enqueue_style('dwa-frontend', DWA_URL . 'assets/css/frontend.css', array(), DWA_VERSION);
		wp_enqueue_script('dwa-frontend', DWA_URL . 'assets/js/frontend.js', array(), DWA_VERSION, true);
	}

	// -------------------------------------------------------------------------
	// SVG helpers
	// -------------------------------------------------------------------------

	private function get_phone_svg($color = '#ffffff') {
		$color = sanitize_hex_color($color);
		if (empty($color)) {
			$color = '#ffffff';
		}
		return '<svg class="dwa-wa-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="' . esc_attr($color) . '" aria-hidden="true">'
			. '<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>'
			. '</svg>';
	}

	private function get_whatsapp_svg($color = '#ffffff', $size = 0) {
		$color = sanitize_hex_color($color);
		if (empty($color)) {
			$color = '#ffffff';
		}
		$dim = $size ? 'width="' . intval($size) . '" height="' . intval($size) . '"' : '';
		return '<svg class="dwa-wa-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="' . esc_attr($color) . '" ' . $dim . ' aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378L2 18l4.336-1.138a9.859 9.859 0 004.709 1.201h.004c5.454 0 9.893-4.434 9.893-9.893 0-2.643-1.03-5.127-2.9-6.995C16.14 1.03 13.657 0 11.014 0c-5.454 0-9.893 4.434-9.893 9.893 0 1.744.454 3.451 1.317 4.951L2 18l4.238-1.113a9.898 9.898 0 004.813 1.234"/></svg>';
	}
}
