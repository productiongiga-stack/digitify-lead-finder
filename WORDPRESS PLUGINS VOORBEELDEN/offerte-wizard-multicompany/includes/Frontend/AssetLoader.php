<?php
namespace OWMC\Frontend;

class AssetLoader {

    public function registerFrontend(): void {
        wp_register_style(
            'owmc-wizard',
            OWMC_URL . 'assets/css/wizard.css',
            [],
            OWMC_VERSION
        );

        wp_register_script(
            'owmc-wizard',
            OWMC_URL . 'assets/js/wizard.js',
            [],
            OWMC_VERSION,
            true
        );
    }

    public function registerAdmin( string $hook ): void {
        if ( strpos( $hook, 'owmc' ) === false && strpos( $hook, 'owmc' ) === false ) {
            // Only load on owmc pages
            if ( ! isset( $_GET['page'] ) || strpos( $_GET['page'], 'owmc' ) === false ) {
                return;
            }
        }

        $page = sanitize_key( $_GET['page'] ?? '' );

        // Admin global styles + JS
        wp_enqueue_style(
            'owmc-admin',
            OWMC_URL . 'assets/css/admin.css',
            [],
            OWMC_VERSION
        );

        wp_enqueue_script(
            'owmc-admin',
            OWMC_URL . 'assets/js/admin.js',
            [ 'jquery' ],
            OWMC_VERSION,
            true
        );

        wp_localize_script( 'owmc-admin', 'OWMC_Admin', [
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'owmc_admin' ),
        ] );

        // Dashboard: chart scripts
        if ( $page === 'owmc' ) {
            wp_enqueue_script(
                'owmc-dashboard',
                OWMC_URL . 'assets/js/dashboard.js',
                [ 'jquery' ],
                OWMC_VERSION,
                true
            );
        }

        // Builder-specific assets
        if ( $page === 'owmc_builder' ) {
            wp_enqueue_style(
                'owmc-builder',
                OWMC_URL . 'assets/css/builder.css',
                [],
                OWMC_VERSION
            );

            wp_enqueue_script(
                'owmc-builder',
                OWMC_URL . 'assets/js/builder.js',
                [ 'jquery', 'jquery-ui-sortable' ],
                OWMC_VERSION,
                true
            );

            wp_localize_script( 'owmc-builder', 'OWMC_Builder', [
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'nonce'   => wp_create_nonce( 'owmc_save_builder' ),
            ] );
        }
    }
}
