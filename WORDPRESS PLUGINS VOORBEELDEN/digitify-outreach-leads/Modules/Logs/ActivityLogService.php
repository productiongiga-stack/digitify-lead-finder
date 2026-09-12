<?php
namespace DOL\Modules\Logs;

use DOL\Modules\CRM\CrmBridge;

final class ActivityLogService {
    public static function log(string $email, string $type, array $meta = []): void {
        ActivityLogRepository::insert($email, $type, $meta);
        CrmBridge::log_event($email, $type, $meta);
    }

    public static function timeline(string $email): array {
        return ActivityLogRepository::timeline($email);
    }

    public static function recent(string $email='', string $type=''): array {
        return ActivityLogRepository::recent($email, $type);
    }

    public static function count_type_last_days(string $type, int $days): int {
        return ActivityLogRepository::count_type_last_days($type, $days);
    }
}
