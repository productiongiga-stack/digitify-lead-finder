<?php
namespace DOL\Modules\Leads;

final class LeadRepository {
    public static function table(): string {
        global $wpdb; return $wpdb->prefix . 'dol_leads';
    }

    public static function get_all(): array {
        global $wpdb;
        return $wpdb->get_results("SELECT * FROM " . self::table() . " ORDER BY updated_at DESC LIMIT 500", ARRAY_A) ?: [];
    }

    public static function find(string $email): ?array {
        global $wpdb;
        $email = strtolower(trim($email));
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . self::table() . " WHERE email=%s", $email), ARRAY_A);
        return $row ?: null;
    }

    public static function count_all(): int {
        global $wpdb;
        return (int)$wpdb->get_var("SELECT COUNT(*) FROM " . self::table());
    }

    public static function count_by_status(string $status): int {
        global $wpdb;
        return (int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM " . self::table() . " WHERE status=%s", $status));
    }

    public static function upsert(array $data): array {
        global $wpdb;
        $t = self::table();
        $now = current_time('mysql');
        $email = strtolower(trim($data['email'] ?? ''));
        if (!$email) return ['error' => 'Email required'];

        $existing = self::find($email);
        $row = [
            'email' => $email,
            'name' => $data['name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'tags' => $data['tags'] ?? null,
            'status' => $data['status'] ?? 'nieuw',
            'updated_at' => $now,
        ];

        if ($existing) {
            $wpdb->update($t, $row, ['email' => $email]);
        } else {
            $row['created_at'] = $now;
            $row['contact_count'] = 0;
            $row['last_contacted_at'] = null;
            $wpdb->insert($t, $row);
        }
        return self::find($email) ?: $row;
    }

    public static function bump_contact(string $email): void {
        global $wpdb;
        $t = self::table();
        $now = current_time('mysql');
        $wpdb->query($wpdb->prepare(
            "UPDATE {$t} SET contact_count = contact_count + 1, last_contacted_at=%s, status=%s, updated_at=%s WHERE email=%s",
            $now, 'gecontacteerd', $now, strtolower(trim($email))
        ));
    }
}
