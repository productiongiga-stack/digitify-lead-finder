<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * Render the WhatsApp CTA widget.
 *
 * @param array $args {
 *   Optional.
 *   @type string $mode        'floating' or 'inline'. Default 'floating'.
 *   @type string $class       Extra CSS class for the wrapper.
 * }
 * @return string HTML string.
 */
function digitify_whatsapp_cta($args = array()) {
	$args = wp_parse_args($args, array(
		'mode'  => 'floating',
		'class' => '',
	));

	$plugin   = DWA_Plugin::get_instance();
	$frontend = isset($plugin->frontend) ? $plugin->frontend : null;

	if (!($frontend instanceof DWA_Frontend)) {
		return '';
	}

	if (!$frontend->should_render()) {
		return '';
	}

	static $count = 0;
	$count++;
	$instance_id = 'dwa-helper-' . $count;

	$wrapper_class = 'dwa-wrapper';
	$wrapper_class .= $args['mode'] === 'floating' ? ' dwa-wrapper--floating' : ' dwa-wrapper--inline';
	if (!empty($args['class'])) {
		$wrapper_class .= ' ' . sanitize_html_class($args['class']);
	}

	return '<div class="' . esc_attr($wrapper_class) . '">'
		. $frontend->render_widget($instance_id)
		. '</div>';
}

/**
 * Get a single plugin setting value.
 *
 * @param string $key
 * @param mixed  $default
 * @return mixed
 */
function dwa_get_setting($key, $default = '') {
	$settings = get_option('dwa_settings', array());
	return isset($settings[$key]) ? $settings[$key] : $default;
}

/**
 * Strip non-numeric characters from a phone number.
 *
 * @param string $phone
 * @return string Digits only.
 */
function dwa_clean_phone($phone) {
	return preg_replace('/\D/', '', (string) $phone);
}
