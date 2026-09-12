<?php
namespace DOL\Admin;

use DOL\Modules\Leads\LeadService;
use DOL\Modules\Templates\TemplateService;
use DOL\Modules\Mail\MailService;
use DOL\Modules\Logs\ActivityLogService;

final class AdminController {

    public static function register_menu(): void {
        $cap = 'manage_options';

        add_menu_page(
            'Outreach Leads',
            'Outreach Leads',
            $cap,
            'dol_dashboard',
            [__CLASS__, 'render_dashboard'],
            'dashicons-megaphone',
            56
        );

        add_submenu_page('dol_dashboard', 'Dashboard', 'Dashboard', $cap, 'dol_dashboard', [__CLASS__, 'render_dashboard']);
        add_submenu_page('dol_dashboard', 'Leads', 'Leads', $cap, 'dol_leads', [__CLASS__, 'render_leads']);
        add_submenu_page('dol_dashboard', 'Templates', 'Templates', $cap, 'dol_templates', [__CLASS__, 'render_templates']);
        add_submenu_page('dol_dashboard', 'Logs', 'Logs', $cap, 'dol_logs', [__CLASS__, 'render_logs']);
        add_submenu_page('dol_dashboard', 'Instellingen', 'Instellingen', $cap, 'dol_settings', [__CLASS__, 'render_settings']);
    }

    public static function enqueue_assets(string $hook): void {
        if (strpos($hook, 'dol_') === false) return;

        wp_enqueue_style('dol-admin', DOL_PLUGIN_URL . 'Admin/assets/css/admin.css', [], DOL_VERSION);
        wp_enqueue_script('dol-admin', DOL_PLUGIN_URL . 'Admin/assets/js/admin.js', ['jquery'], DOL_VERSION, true);

        wp_localize_script('dol-admin', 'DOL', [
            'ajax' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('dol_nonce'),
        ]);
    }

    private static function view(string $file, array $data = []): void {
        extract($data);
        include DOL_PLUGIN_DIR . 'Admin/views/' . $file . '.php';
    }

    public static function render_dashboard(): void {
        $stats = [
            'leads_total' => LeadService::count_all(),
            'leads_contacted' => LeadService::count_by_status('gecontacteerd'),
            'emails_sent_30d' => ActivityLogService::count_type_last_days('email_sent', 30),
            'opens_30d' => ActivityLogService::count_type_last_days('email_opened', 30),
            'clicks_30d' => ActivityLogService::count_type_last_days('email_clicked', 30),
        ];
        self::view('dashboard', compact('stats'));
    }

    public static function render_leads(): void {
        self::view('leads');
    }

    public static function render_templates(): void {
        $templates = TemplateService::all();
        self::view('templates', compact('templates'));
    }

    public static function render_logs(): void {
        self::view('logs');
    }

    public static function render_settings(): void {
        $settings = get_option('dol_settings', []);
        self::view('settings', compact('settings'));
    }

    private static function verify(): void {
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Geen toegang.'], 403);
        check_ajax_referer('dol_nonce', 'nonce');
    }

    public static function ajax_import_csv(): void {
        self::verify();
        if (empty($_FILES['file']['tmp_name'])) wp_send_json_error(['message' => 'Geen bestand ontvangen.'], 400);

        $res = LeadService::import_csv($_FILES['file']['tmp_name']);
        wp_send_json_success($res);
    }

    public static function ajax_save_lead(): void {
        self::verify();
        $payload = wp_unslash($_POST);
        $lead = LeadService::upsert([
            'email' => sanitize_email($payload['email'] ?? ''),
            'name' => sanitize_text_field($payload['name'] ?? ''),
            'phone' => sanitize_text_field($payload['phone'] ?? ''),
            'tags' => sanitize_text_field($payload['tags'] ?? ''),
            'status' => sanitize_text_field($payload['status'] ?? 'nieuw'),
        ]);
        wp_send_json_success(['lead' => $lead]);
    }

    public static function ajax_send_email(): void {
        self::verify();
        $payload = wp_unslash($_POST);
        $email = sanitize_email($payload['email'] ?? '');
        $template_id = (int) ($payload['template_id'] ?? 0);
        $message = wp_kses_post($payload['message'] ?? '');
        $cta_url = esc_url_raw($payload['cta_url'] ?? home_url('/'));

        $result = MailService::send_to_lead($email, $template_id, $message, $cta_url);
        if ($result['ok']) wp_send_json_success($result);
        wp_send_json_error($result, 400);
    }

    public static function ajax_template_preview(): void {
        self::verify();
        $payload = wp_unslash($_POST);
        $template_id = (int) ($payload['template_id'] ?? 0);
        $email = sanitize_email($payload['email'] ?? 'demo@example.com');
        $name  = sanitize_text_field($payload['name'] ?? 'Demo');
        $message = wp_kses_post($payload['message'] ?? 'Kan je even bevestigen of dit goed is?');
        $cta_url = esc_url_raw($payload['cta_url'] ?? home_url('/'));

        $html = TemplateService::render($template_id, [
            'email' => $email,
            'name' => $name ?: 'Daar',
            'message' => $message,
            'cta_url' => $cta_url,
        ], true);

        wp_send_json_success(['html' => $html]);
    }

    public static function ajax_save_template(): void {
        self::verify();
        $payload = wp_unslash($_POST);
        $id = (int) ($payload['id'] ?? 0);
        $name = sanitize_text_field($payload['name'] ?? '');
        $subject = sanitize_text_field($payload['subject'] ?? '');
        $html = wp_kses_post($payload['html'] ?? '');

        $tpl = TemplateService::save($id, $name, $subject, $html);
        wp_send_json_success(['template' => $tpl]);
    }
}
