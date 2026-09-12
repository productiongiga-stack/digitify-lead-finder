<?php
namespace DOL\Modules\CRM;

final class CrmBridge {
    public static function upsert_contact(string $email, array $data = []): void {
        $email = strtolower(trim($email));
        if (!$email) return;

        // Prefer function integration if provided by CRM Core
        if (function_exists('digitify_crm_upsert_contact')) {
            digitify_crm_upsert_contact($email, $data);
            return;
        }

        // Prefer class integration if available
        if (class_exists('\\Digitify\\CRM\\Core')) {
            $cls = '\\Digitify\\CRM\\Core';
            if (method_exists($cls, 'upsert_contact')) {
                $cls::upsert_contact($email, $data);
                return;
            }
        }

        // Fallback: WordPress action bridge
        do_action('digitify_crm/upsert_contact', $email, $data);
    }

    public static function log_event(string $email, string $event, array $meta = []): void {
        $email = strtolower(trim($email));
        if (!$email) return;

        if (function_exists('digitify_crm_log_event')) {
            digitify_crm_log_event($email, $event, $meta);
            return;
        }

        if (class_exists('\\Digitify\\CRM\\Core')) {
            $cls='\\Digitify\\CRM\\Core';
            if (method_exists($cls, 'log_event')) {
                $cls::log_event($email, $event, $meta);
                return;
            }
        }

        do_action('digitify_crm/log_event', $email, $event, $meta);
    }
}
