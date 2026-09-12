<?php
if (!defined('ABSPATH')) {
	exit;
}

class DWA_Plugin {
	private static $instance = null;
	public $admin    = null;
	public $frontend = null;

	public static function get_instance() {
		if (null === self::$instance) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {}

	public function init() {
		$this->load_dependencies();

		// Instantiate both classes immediately so their add_action() calls
		// register before the relevant hooks fire.
		$this->admin    = new DWA_Admin();
		$this->frontend = new DWA_Frontend();
	}

	private function load_dependencies() {
		require_once DWA_DIR . 'includes/class-dwa-settings-validator.php';
		require_once DWA_DIR . 'includes/class-dwa-admin.php';
		require_once DWA_DIR . 'includes/class-dwa-frontend.php';
		require_once DWA_DIR . 'includes/helpers.php';
	}

	public function activate() {
		$this->load_dependencies();

		$defaults = array(
			'enabled'            => 1,
			'whatsapp_number'    => '',
			'company_name'       => '',
			'auto_show_footer'   => 1,
			'show_on_mobile'     => 1,
			'show_on_desktop'    => 1,
			'button_position'    => 'bottom-right',
			'button_size'        => 56,
			'icon_size'          => 28,
			'border_radius'      => 50,
			'link_type'          => 'wa.me',
			'open_in_new_tab'    => 1,
			'button_text'        => 'Need Help?',
			'button_color'       => '#25d366',
			'button_text_color'  => '#ffffff',
			'button_icon_color'  => '#ffffff',
			'popup_title'        => 'Chat with us',
			'popup_intro_text'   => 'How can we help you today?',
			'popup_bg_color'     => '#ffffff',
			'popup_header_color' => '#25d366',
			'popup_text_color'   => '#333333',
			'popup_button_color' => '#25d366',
			'questions'          => array(
				array(
					'label'   => 'Offerte aanvragen',
					'message' => 'Hallo, ik wil graag een offerte aanvragen. Ik kom via deze pagina: {{page_url}}',
				),
				array(
					'label'   => 'Vraag stellen',
					'message' => 'Hallo, ik heb een vraag over jullie diensten. Pagina: {{page_url}}',
				),
				array(
					'label'   => 'Afspraak maken',
					'message' => 'Hallo, ik wil graag een afspraak maken. Wanneer past het voor jullie?',
				),
				array(
					'label'   => 'Support',
					'message' => 'Hallo, ik heb een vraag en wil graag geholpen worden.',
				),
			),
			'exclude_pages'      => '',
		);

		if (false === get_option('dwa_settings')) {
			add_option('dwa_settings', $defaults);
		}
	}

	public function deactivate() {}
}
