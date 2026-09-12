<?php
if ( ! defined('ABSPATH') ) exit;

class DAP_Admin {
	public function register() {
		add_action( 'admin_menu', [ $this, 'menu' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'assets' ] );
	}

	public function menu() {
		add_menu_page(
			__( 'Agenda', 'digitify-agenda-pro' ),
			__( 'Agenda', 'digitify-agenda-pro' ),
			'manage_options',
			DAP_SLUG,
			[ $this, 'render' ],
			'dashicons-calendar',
			58
		);
	}

	public function assets( $hook ) {
		if ( $hook !== 'toplevel_page_' . DAP_SLUG ) return;

		wp_enqueue_style( 'dap-admin', DAP_URL . 'assets/admin.css', [], DAP_VERSION );
		wp_enqueue_script( 'dap-admin', DAP_URL . 'assets/admin.js', [ 'jquery' ], DAP_VERSION, true );

		$tz = wp_timezone_string();
		wp_localize_script( 'dap-admin', 'DAP', [
			'ajaxUrl' => admin_url('admin-ajax.php'),
			'nonce' => wp_create_nonce('dap_nonce'),
			'tz' => $tz,
			'now' => current_time('mysql'),
		] );
	}

	public function render() {
		if ( ! current_user_can('manage_options') ) return;

		$tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'week';
		$tabs = [
			'week' => __( 'Weekagenda', 'digitify-agenda-pro' ),
			'todos' => __( 'To-do\'s', 'digitify-agenda-pro' ),
		];
		if ( ! isset($tabs[$tab]) ) $tab = 'week';

		include DAP_DIR . 'admin/views/app.php';
	}
}
