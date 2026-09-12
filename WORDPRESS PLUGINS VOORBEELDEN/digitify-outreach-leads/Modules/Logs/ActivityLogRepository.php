<?php
namespace DOL\Modules\Logs;

final class ActivityLogRepository {
    public static function table(): string { global $wpdb; return $wpdb->prefix . 'dol_activity_log'; }

    public static function insert(string $email, string $type, array $meta = []): void {
        global $wpdb;
        $wpdb->insert(self::table(), [
            'lead_email' => strtolower(trim($email)),
            'type' => $type,
            'meta' => wp_json_encode($meta),
            'created_at' => current_time('mysql'),
        ]);
    }

    public static function timeline(string $email, int $limit = 60): array {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM " . self::table() . " WHERE lead_email=%s ORDER BY id DESC LIMIT %d",
            strtolower(trim($email)), $limit
        ), ARRAY_A) ?: [];
    }

    public static function recent(string $email = '', string $type = '', int $limit = 200): array {
        global $wpdb;
        $where = "1=1";
        $args = [];
        if ($email) { $where .= " AND lead_email=%s"; $args[] = strtolower(trim($email)); }
        if ($type)  { $where .= " AND type=%s"; $args[] = $type; }
        $sql = "SELECT * FROM " . self::table() . " WHERE {$where} ORDER BY id DESC LIMIT {$limit}";
        if ($args) $sql = $wpdb->prepare($sql, ...$args);
        return $wpdb->get_results($sql, ARRAY_A) ?: [];
    }

    public static function count_type_last_days(string $type, int $days): int {
        global $wpdb;
        $since = gmdate('Y-m-d H:i:s', time() - ($days * DAY_IN_SECONDS));
        return (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM " . self::table() . " WHERE type=%s AND created_at >= %s",
            $type, $since
        ));
    }
}
