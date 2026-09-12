<?php
/**
 * Plugin Name:  Offerte Wizard (Multi-Company)
 * Description:  Premium multi-step offerte/lead wizard with CRM, event tracking, and email system.
 * Version:      2.0.1
 * Author:       Digitify
 * License:      GPLv2 or later
 * Text Domain:  owmc
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ── Constants ────────────────────────────────────────────────────────────────
define( 'OWMC_VERSION',   '2.0.1' );
define( 'OWMC_FILE',      __FILE__ );
define( 'OWMC_DIR',       plugin_dir_path( __FILE__ ) );
define( 'OWMC_URL',       plugin_dir_url( __FILE__ ) );
define( 'OWMC_SLUG',      'owmc' );

// ── Autoloader ───────────────────────────────────────────────────────────────
spl_autoload_register( function ( string $class ) {
    // Only handle our namespace
    if ( strpos( $class, 'OWMC\\' ) !== 0 ) return;

    $relative = str_replace( [ 'OWMC\\', '\\' ], [ '', DIRECTORY_SEPARATOR ], $class );
    $file = OWMC_DIR . 'includes' . DIRECTORY_SEPARATOR . $relative . '.php';

    if ( file_exists( $file ) ) {
        require_once $file;
    }
} );

// ── Bootstrap ─────────────────────────────────────────────────────────────────
register_activation_hook( __FILE__, [ 'OWMC\\Core\\Installer', 'run' ] );
register_deactivation_hook( __FILE__, [ 'OWMC\\Core\\Plugin', 'deactivate' ] );

add_action( 'plugins_loaded', function () {
    OWMC\Core\Plugin::getInstance()->boot();
}, 10 );
