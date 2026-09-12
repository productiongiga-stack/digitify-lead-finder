<?php
/**
 * Plugin Name: Digitify WhatsApp CTA
 * Plugin URI: https://digitify.com/whatsapp-cta
 * Description: Modern, customizable WhatsApp call-to-action button for WordPress
 * Version: 1.1.0
 * Author: Digitify
 * Author URI: https://digitify.com
 * License: GPL-2.0+
 * Text Domain: dwa
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
	exit;
}

define('DWA_VERSION', '1.1.0');
define('DWA_PLUGIN_NAME', 'digitify-whatsapp-cta');
define('DWA_DIR', plugin_dir_path(__FILE__));
define('DWA_URL', plugin_dir_url(__FILE__));
define('DWA_BASENAME', plugin_basename(__FILE__));

require_once DWA_DIR . 'includes/class-dwa-plugin.php';

add_action('plugins_loaded', function() {
	DWA_Plugin::get_instance()->init();
});

register_activation_hook(__FILE__, function() {
	DWA_Plugin::get_instance()->activate();
});

register_deactivation_hook(__FILE__, function() {
	DWA_Plugin::get_instance()->deactivate();
});
