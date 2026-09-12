<?php
if (!defined('ABSPATH')) {
	exit;
}

class DWA_Settings_Validator {

	public static function sanitize($input) {
		if (!is_array($input)) {
			return array();
		}

		$out = array();

		// --- Booleans ---
		foreach (array('enabled', 'auto_show_footer', 'show_on_mobile', 'show_on_desktop', 'open_in_new_tab') as $key) {
			$out[$key] = isset($input[$key]) ? 1 : 0;
		}

		// --- Phone number (digits only) ---
		$phone = isset($input['whatsapp_number']) ? preg_replace('/\D/', '', $input['whatsapp_number']) : '';
		$out['whatsapp_number'] = strlen($phone) >= 7 ? $phone : '';

		// --- Simple text fields ---
		$out['company_name']    = isset($input['company_name'])    ? sanitize_text_field($input['company_name'])    : '';
		$out['button_text']     = isset($input['button_text'])     ? sanitize_text_field($input['button_text'])     : 'Need Help?';
		$out['popup_title']     = isset($input['popup_title'])     ? sanitize_text_field($input['popup_title'])     : 'Chat with us';
		$out['popup_intro_text'] = isset($input['popup_intro_text']) ? wp_kses_post($input['popup_intro_text']) : '';

		// --- Select fields with whitelists ---
		$positions = array('bottom-right', 'bottom-left');
		$out['button_position'] = isset($input['button_position']) && in_array($input['button_position'], $positions, true)
			? $input['button_position']
			: 'bottom-right';

		$link_types = array('wa.me', 'api.whatsapp.com');
		$out['link_type'] = isset($input['link_type']) && in_array($input['link_type'], $link_types, true)
			? $input['link_type']
			: 'wa.me';

		// --- Numbers with range clamping ---
		$out['button_size']   = self::clamp_int(isset($input['button_size'])   ? $input['button_size']   : 56,  30, 100);
		$out['icon_size']     = self::clamp_int(isset($input['icon_size'])     ? $input['icon_size']     : 28,  16,  48);
		$out['border_radius'] = self::clamp_int(isset($input['border_radius']) ? $input['border_radius'] :  50,  0,  50);

		// --- Colors ---
		$color_keys = array(
			'button_color'       => '#25d366',
			'button_text_color'  => '#ffffff',
			'button_icon_color'  => '#ffffff',
			'popup_bg_color'     => '#ffffff',
			'popup_header_color' => '#25d366',
			'popup_text_color'   => '#333333',
			'popup_button_color' => '#25d366',
		);
		foreach ($color_keys as $key => $default) {
			$val = isset($input[$key]) ? sanitize_hex_color($input[$key]) : '';
			$out[$key] = !empty($val) ? $val : $default;
		}

		// --- Questions (repeatable array) ---
		$out['questions'] = array();
		if (isset($input['questions']) && is_array($input['questions'])) {
			foreach ($input['questions'] as $q) {
				if (!is_array($q)) {
					continue;
				}
				$label   = isset($q['label'])   ? sanitize_text_field($q['label'])   : '';
				$message = isset($q['message']) ? wp_kses_post($q['message'])         : '';
				if ('' === $label && '' === $message) {
					continue;
				}
				$out['questions'][] = array(
					'label'   => $label,
					'message' => $message,
				);
			}
		}

		// --- Exclude pages (stored as raw string; parsed at render-time) ---
		$out['exclude_pages'] = isset($input['exclude_pages'])
			? sanitize_textarea_field($input['exclude_pages'])
			: '';

		return $out;
	}

	private static function clamp_int($value, $min, $max) {
		return max($min, min($max, intval($value)));
	}
}
