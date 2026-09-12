<?php
namespace DOL\Modules\Mail;

use DOL\Modules\Leads\LeadRepository;
use DOL\Modules\Leads\LeadService;
use DOL\Modules\Templates\TemplateService;
use DOL\Modules\Logs\ActivityLogService;

final class MailService {

    public static function send_to_lead(string $email, int $template_id, string $message, string $cta_url): array {
        $email = strtolower(trim($email));
        if (!$email || !is_email($email)) return ['ok'=>false,'message'=>'Ongeldig e-mail adres.'];

        $lead = LeadRepository::find($email);
        if (!$lead) {
            // auto-create minimal lead so email is always in system
            $lead = LeadService::upsert(['email'=>$email,'name'=>'','phone'=>'','tags'=>'','status'=>'nieuw']);
        }

        $vars = [
            'email' => $email,
            'name' => $lead['name'] ?: 'daar',
            'message' => $message ?: '',
            'cta_url' => $cta_url ?: home_url('/'),
        ];

        $subject = TemplateService::subject($template_id, $vars);

        // Create message token for tracking
        $token = wp_generate_uuid4();
        MessageRepository::create($token, $email, $template_id, $subject);

        $html = TemplateService::render($template_id, $vars, true);
        $html = self::inject_tracking($html, $token);
        $html = self::rewrite_links($html, $token);

        $settings = get_option('dol_settings', []);
        $from_name = $settings['from_name'] ?? get_bloginfo('name');
        $from_email = $settings['from_email'] ?? get_option('admin_email');

        add_filter('wp_mail_content_type', [__CLASS__, 'content_type']);
        $headers = [
            'From: ' . $from_name . ' <' . $from_email . '>',
            'Reply-To: ' . $from_name . ' <' . $from_email . '>',
        ];
        $sent = wp_mail($email, $subject, $html, $headers);
        remove_filter('wp_mail_content_type', [__CLASS__, 'content_type']);

        if (!$sent) return ['ok'=>false,'message'=>'wp_mail faalde (controleer SMTP).'];

        // Update lead counters
        LeadRepository::bump_contact($email);

        ActivityLogService::log($email, 'email_sent', [
            'info' => $subject,
            'token' => $token,
        ]);

        return ['ok'=>true,'token'=>$token];
    }

    public static function content_type(): string { return 'text/html'; }

    private static function inject_tracking(string $html, string $token): string {
        $pixel = esc_url(home_url('/?dol_track=open&t=' . rawurlencode($token)));
        $img = '<img src="'.$pixel.'" width="1" height="1" alt="" style="display:none!important;">';
        if (stripos($html, '</body>') !== false) {
            return str_ireplace('</body>', $img . '</body>', $html);
        }
        return $html . $img;
    }

    private static function rewrite_links(string $html, string $token): string {
        // Rewrite all hrefs except mailto/tel/# and already tracked
        return preg_replace_callback('/href=[\'"]([^\'"]+)[\'"]/i', function($m) use ($token) {
            $url = $m[1];
            if (stripos($url, 'mailto:') === 0 || stripos($url, 'tel:') === 0 || $url === '#' ) return $m[0];
            if (strpos($url, 'dol_track=click') !== false) return $m[0];
            $redir = home_url('/?dol_track=click&t=' . rawurlencode($token) . '&u=' . rawurlencode($url));
            return 'href="'.esc_url($redir).'"';
        }, $html);
    }
}
