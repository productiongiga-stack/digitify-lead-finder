<?php
namespace OWMC\Admin;

use OWMC\Core\Container;
use OWMC\Core\Installer;

class SettingsPage {

    public function __construct( Container $c ) {}

    public function render(): void {
        $opt = get_option( 'owmc_global', [] );
        if ( ! is_array( $opt ) ) $opt = [];

        $notice = '';

        if ( isset( $_POST['owmc_save_settings'] ) && check_admin_referer( 'owmc_save_settings' ) ) {
            $opt['notify_email'] = sanitize_email( $_POST['notify_email'] ?? '' );
            $opt['debug_mode']   = ! empty( $_POST['debug_mode'] ) ? 1 : 0;

            if ( ! empty( $_POST['rotate_token'] ) ) {
                $opt['public_token'] = Installer::randomToken();
                $notice = [ 'type' => 'success', 'msg' => 'Token geroteerd. Vergeet de frontend wizard niet bij te werken.' ];
            }
            if ( empty( $opt['public_token'] ) ) {
                $opt['public_token'] = Installer::randomToken();
            }

            update_option( 'owmc_global', $opt );
            if ( ! $notice ) $notice = [ 'type' => 'success', 'msg' => 'Instellingen opgeslagen.' ];
        }

        include OWMC_DIR . 'admin/views/settings.php';
    }
}
