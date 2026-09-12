<?php
namespace DOL\Modules\Leads;

use DOL\Modules\Logs\ActivityLogService;
use DOL\Modules\CRM\CrmBridge;

final class LeadService {

    public static function all(): array {
        return LeadRepository::get_all();
    }

    public static function count_all(): int { return LeadRepository::count_all(); }
    public static function count_by_status(string $status): int { return LeadRepository::count_by_status($status); }

    public static function upsert(array $data): array {
        $lead = LeadRepository::upsert($data);

        ActivityLogService::log($lead['email'], 'lead_updated', [
            'info' => 'Lead opgeslagen',
            'fields' => array_intersect_key($data, array_flip(['name','phone','tags','status']))
        ]);

        CrmBridge::upsert_contact($lead['email'], [
            'name' => $lead['name'] ?? '',
            'phone' => $lead['phone'] ?? '',
            'tags' => $lead['tags'] ?? '',
            'status' => $lead['status'] ?? 'nieuw',
            'source' => 'outreach_leads'
        ]);

        return $lead;
    }

    public static function import_csv(string $path): array {
        $inserted=0; $updated=0; $skipped=0;
        if (!file_exists($path)) return ['inserted'=>0,'updated'=>0,'skipped'=>0];

        $handle = fopen($path, 'r');
        if (!$handle) return ['inserted'=>0,'updated'=>0,'skipped'=>0];

        $header = fgetcsv($handle);
        if (!$header) { fclose($handle); return ['inserted'=>0,'updated'=>0,'skipped'=>0]; }

        $map = array_map('strtolower', array_map('trim', $header));
        $idx = function($key) use ($map) {
            $i = array_search($key, $map, true);
            return $i === false ? null : $i;
        };

        while (($row = fgetcsv($handle)) !== false) {
            $email_i = $idx('email');
            if ($email_i === null) { $skipped++; continue; }
            $email = sanitize_email($row[$email_i] ?? '');
            if (!$email) { $skipped++; continue; }

            $data = [
                'email' => $email,
                'name' => ($i=$idx('name'))!==null ? sanitize_text_field($row[$i] ?? '') : '',
                'phone'=> ($i=$idx('phone'))!==null ? sanitize_text_field($row[$i] ?? '') : '',
                'tags' => ($i=$idx('tags'))!==null ? sanitize_text_field($row[$i] ?? '') : '',
                'status'=> ($i=$idx('status'))!==null ? sanitize_text_field($row[$i] ?? 'nieuw') : 'nieuw',
            ];

            $existing = LeadRepository::find($email);
            self::upsert($data);
            if ($existing) $updated++; else $inserted++;
        }
        fclose($handle);

        return compact('inserted','updated','skipped');
    }
}
