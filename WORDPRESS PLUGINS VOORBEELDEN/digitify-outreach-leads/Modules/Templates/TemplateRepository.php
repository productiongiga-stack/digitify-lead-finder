<?php
namespace DOL\Modules\Templates;

final class TemplateRepository {
    public static function table(): string { global $wpdb; return $wpdb->prefix . 'dol_templates'; }

    public static function all(): array {
        global $wpdb;
        return $wpdb->get_results("SELECT * FROM " . self::table() . " ORDER BY updated_at DESC", ARRAY_A) ?: [];
    }

    public static function find(int $id): ?array {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . self::table() . " WHERE id=%d", $id), ARRAY_A);
        return $row ?: null;
    }

    public static function save(int $id, string $name, string $subject, string $html): array {
        global $wpdb;
        $t = self::table();
        $now = current_time('mysql');

        $row = [
            'name' => $name ?: 'Template',
            'subject' => $subject ?: 'Bericht',
            'html' => $html ?: '',
            'updated_at' => $now,
        ];
        if ($id > 0 && self::find($id)) {
            $wpdb->update($t, $row, ['id'=>$id]);
            return self::find($id) ?: array_merge(['id'=>$id], $row);
        }
        $row['created_at'] = $now;
        $wpdb->insert($t, $row);
        $new_id = (int)$wpdb->insert_id;
        return self::find($new_id) ?: array_merge(['id'=>$new_id], $row);
    }
}
