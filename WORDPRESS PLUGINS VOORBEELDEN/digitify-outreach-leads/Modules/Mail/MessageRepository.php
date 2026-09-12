<?php
namespace DOL\Modules\Mail;

final class MessageRepository {
    public static function table(): string { global $wpdb; return $wpdb->prefix . 'dol_messages'; }

    public static function create(string $token, string $email, int $template_id, string $subject): int {
        global $wpdb;
        $wpdb->insert(self::table(), [
            'token' => $token,
            'lead_email' => strtolower(trim($email)),
            'template_id' => $template_id ?: null,
            'subject' => $subject,
            'sent_at' => current_time('mysql'),
        ]);
        return (int)$wpdb->insert_id;
    }

    public static function by_token(string $token): ?array {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . self::table() . " WHERE token=%s", $token), ARRAY_A);
        return $row ?: null;
    }

    public static function bump_open(string $token): void {
        global $wpdb;
        $t=self::table();
        $now=current_time('mysql');
        $wpdb->query($wpdb->prepare(
            "UPDATE {$t} SET open_count=open_count+1, last_opened_at=%s WHERE token=%s",
            $now, $token
        ));
    }

    public static function bump_click(string $token): void {
        global $wpdb;
        $t=self::table();
        $wpdb->query($wpdb->prepare(
            "UPDATE {$t} SET click_count=click_count+1 WHERE token=%s",
            $token
        ));
    }
}
