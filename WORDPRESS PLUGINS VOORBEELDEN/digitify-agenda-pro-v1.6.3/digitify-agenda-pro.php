<?php
/**
 * Plugin Name: Digitify Agenda Pro
 * Description: Premium agenda + weekplanner + to-do's met kleurcodes/legende en CRM Core sync (events per e-mail gelogd).
 * Version: 1.6.3
 * Author: Digitify
 * Text Domain: digitify-agenda-pro
 */

if ( ! defined('ABSPATH') ) exit;

define( 'DAP_VERSION', '1.6.3' );
define( 'DAP_SLUG', 'digitify-agenda-pro' );
define( 'DAP_DIR', plugin_dir_path(__FILE__) );
define( 'DAP_URL', plugin_dir_url(__FILE__) );

require_once DAP_DIR . 'includes/class-dap-installer.php';
require_once DAP_DIR . 'includes/class-dap-time.php';
require_once DAP_DIR . 'includes/class-dap-crm.php';
require_once DAP_DIR . 'includes/class-dap-integrations.php';
require_once DAP_DIR . 'includes/integrations/digitify-offerte-maker.php';
require_once DAP_DIR . 'includes/class-dap-admin.php';
require_once DAP_DIR . 'includes/class-dap-ajax.php';

final class Digitify_Agenda_Pro {
	private static $instance = null;

	public static function instance() {
		if ( self::$instance === null ) self::$instance = new self();
		return self::$instance;
	}

	private function __construct() {
		register_activation_hook( __FILE__, [ 'DAP_Installer', 'activate' ] );

		add_action( 'plugins_loaded', function() {
			// Lightweight DB upgrade path (adds new columns via dbDelta when version changes)
			$installed = (string) get_option( 'dap_db_version', '' );
			if ( $installed !== DAP_VERSION ) {
				DAP_Installer::activate();
			}

			// Integrations are loaded everywhere (also for REST/event hub)
			( new DAP_Integrations() )->register();

			if ( is_admin() ) {
				( new DAP_Admin() )->register();
				( new DAP_Ajax() )->register();
			}
		} );
	}
}

Digitify_Agenda_Pro::instance();
