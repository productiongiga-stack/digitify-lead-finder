<?php
namespace DOL\Modules\Tracking;

use DOL\Modules\Mail\MessageRepository;
use DOL\Modules\Logs\ActivityLogService;

final class TrackingController {

    public static function register(): void {
        add_rewrite_tag('%dol_track%', '([^&]+)');
        // no custom rewrite rules needed as we use query vars.
    }

    public static function handle(): void {
        $track = isset($_GET['dol_track']) ? sanitize_text_field(wp_unslash($_GET['dol_track'])) : '';
        $token = isset($_GET['t']) ? sanitize_text_field(wp_unslash($_GET['t'])) : '';
        if (!$track || !$token) return;

        $msg = MessageRepository::by_token($token);
        $email = $msg['lead_email'] ?? '';

        if ($track === 'open') {
            if ($msg) MessageRepository::bump_open($token);
            if ($email) ActivityLogService::log($email, 'email_opened', ['token'=>$token]);

            // 1x1 transparent gif
            header('Content-Type: image/gif');
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            echo base64_decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
            exit;
        }

        if ($track === 'click') {
            $u = isset($_GET['u']) ? esc_url_raw(wp_unslash($_GET['u'])) : home_url('/');
            if ($msg) MessageRepository::bump_click($token);
            if ($email) ActivityLogService::log($email, 'email_clicked', ['token'=>$token,'url'=>$u]);
            wp_redirect($u ?: home_url('/'));
            exit;
        }
    }
}
