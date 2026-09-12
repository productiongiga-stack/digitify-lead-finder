<?php
namespace DOL\Admin;

use DOL\Modules\Leads\LeadService;
use DOL\Modules\Templates\TemplateService;
use DOL\Modules\Mail\MailService;
use DOL\Modules\Logs\ActivityLogService;

final class AjaxEndpoints {

    public static function init(): void {
        // Reads
        add_action('wp_ajax_dol_get_leads', [__CLASS__, 'get_leads']);
        add_action('wp_ajax_dol_get_templates', [__CLASS__, 'get_templates']);
        add_action('wp_ajax_dol_get_timeline', [__CLASS__, 'get_timeline']);
        add_action('wp_ajax_dol_get_logs', [__CLASS__, 'get_logs']);

        // Writes
        add_action('wp_ajax_dol_save_lead', [__CLASS__, 'save_lead']);
        add_action('wp_ajax_dol_import_csv', [__CLASS__, 'import_csv']);
        add_action('wp_ajax_dol_save_template', [__CLASS__, 'save_template']);
        add_action('wp_ajax_dol_template_preview', [__CLASS__, 'template_preview']);
        add_action('wp_ajax_dol_send_email', [__CLASS__, 'send_email']);
    }

    private static function verify(): void {
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Geen toegang.'], 403);
        }
        check_ajax_referer('dol_nonce', 'nonce');
    }

    public static function get_leads(): void {
        self::verify();
        wp_send_json_success(['leads' => LeadService::all()]);
    }

    public static function get_templates(): void {
        self::verify();
        wp_send_json_success(['templates' => TemplateService::all()]);
    }

    public static function get_timeline(): void {
        self::verify();
        $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
        if (!$email) wp_send_json_success(['items'=>[]]);
        wp_send_json_success(['items' => ActivityLogService::timeline($email)]);
    }

    public static function get_logs(): void {
        self::verify();
        $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
        $type  = sanitize_text_field(wp_unslash($_POST['type'] ?? ''));
        wp_send_json_success(['items' => ActivityLogService::recent($email, $type)]);
    }

    public static function save_lead(): void {
        self::verify();
        $payload = wp_unslash($_POST);

        $email = sanitize_email($payload['email'] ?? '');
        if (!$email) {
            wp_send_json_error(['message' => 'E-mail is verplicht.'], 400);
        }

        $lead = LeadService::upsert([
            'email' => $email,
            'name' => sanitize_text_field($payload['name'] ?? ''),
            'phone' => sanitize_text_field($payload['phone'] ?? ''),
            'tags' => sanitize_text_field($payload['tags'] ?? ''),
            'status' => sanitize_text_field($payload['status'] ?? 'nieuw'),
        ]);

        if (isset($lead['error'])) {
            wp_send_json_error(['message' => $lead['error']], 400);
        }

        wp_send_json_success(['lead' => $lead]);
    }

    public static function import_csv(): void {
        self::verify();
        if (empty($_FILES['file']['tmp_name'])) {
            wp_send_json_error(['message' => 'Geen bestand ontvangen.'], 400);
        }
        $res = LeadService::import_csv($_FILES['file']['tmp_name']);
        wp_send_json_success($res);
    }

    public static function save_template(): void {
        self::verify();
        $payload = wp_unslash($_POST);

        $id = (int)($payload['id'] ?? 0);
        $name = sanitize_text_field($payload['name'] ?? '');
        $subject = sanitize_text_field($payload['subject'] ?? '');
        $html = wp_kses_post($payload['html'] ?? '');

        if (!$name || !$subject || !$html) {
            wp_send_json_error(['message'=>'Naam, onderwerp en HTML zijn verplicht.'], 400);
        }

        $tpl = TemplateService::save($id, $name, $subject, $html);
        wp_send_json_success(['template' => $tpl, 'templates' => TemplateService::all()]);
    }

    public static function template_preview(): void {
        self::verify();
        $payload = wp_unslash($_POST);

        $template_id = (int)($payload['template_id'] ?? 0);
        $email = sanitize_email($payload['email'] ?? 'demo@example.com');
        $name = sanitize_text_field($payload['name'] ?? 'Demo');
        $message = wp_kses_post($payload['message'] ?? 'Kan je even bevestigen of dit goed is?');
        $cta_url = esc_url_raw($payload['cta_url'] ?? home_url('/'));

        $html = TemplateService::render($template_id, [
            'email' => $email,
            'name' => $name ?: 'daar',
            'message' => $message,
            'cta_url' => $cta_url,
        ], true);

        wp_send_json_success(['html' => $html]);
    }

    public static function send_email(): void {
        self::verify();
        $payload = wp_unslash($_POST);

        $email = sanitize_email($payload['email'] ?? '');
        $template_id = (int)($payload['template_id'] ?? 0);
        $message = wp_kses_post($payload['message'] ?? '');
        $cta_url = esc_url_raw($payload['cta_url'] ?? home_url('/'));

        $result = MailService::send_to_lead($email, $template_id, $message, $cta_url);

        if (!empty($result['ok'])) {
            wp_send_json_success($result);
        }
        wp_send_json_error($result, 400);
    }
}
