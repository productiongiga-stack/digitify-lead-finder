<?php
namespace DOL\Core;

use DOL\Admin\AdminController;
use DOL\Admin\AjaxEndpoints;
use DOL\Modules\Tracking\TrackingController;

final class Hooks {
    public static function init(): void {
        add_action('admin_menu', [AdminController::class, 'register_menu']);
        add_action('admin_enqueue_scripts', [AdminController::class, 'enqueue_assets']);

        // AJAX endpoints (all in one place)
        AjaxEndpoints::init();

        // Settings registration
        add_action('admin_init', function () {
            register_setting('dol_settings_group', 'dol_settings');
        });

        // Tracking endpoints (open/click)
        add_action('init', [TrackingController::class, 'register']);
        add_action('template_redirect', [TrackingController::class, 'handle']);
    }
}
