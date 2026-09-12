<?php
namespace DOL\Core;

final class Installer {
    public static function run(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();

        $leads = $wpdb->prefix . 'dol_leads';
        $log   = $wpdb->prefix . 'dol_activity_log';
        $tpl   = $wpdb->prefix . 'dol_templates';
        $msg   = $wpdb->prefix . 'dol_messages';

        $sql1 = "CREATE TABLE {$leads} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email VARCHAR(190) NOT NULL,
            name VARCHAR(190) NULL,
            phone VARCHAR(50) NULL,
            tags TEXT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'nieuw',
            contact_count INT UNSIGNED NOT NULL DEFAULT 0,
            last_contacted_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY email (email)
        ) {$charset};";

        $sql2 = "CREATE TABLE {$log} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            lead_email VARCHAR(190) NOT NULL,
            type VARCHAR(50) NOT NULL,
            meta LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY lead_email (lead_email),
            KEY type (type)
        ) {$charset};";

        $sql3 = "CREATE TABLE {$tpl} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(190) NOT NULL,
            subject VARCHAR(190) NOT NULL,
            html LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id)
        ) {$charset};";

        $sql4 = "CREATE TABLE {$msg} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            token VARCHAR(64) NOT NULL,
            lead_email VARCHAR(190) NOT NULL,
            template_id BIGINT UNSIGNED NULL,
            subject VARCHAR(190) NOT NULL,
            sent_at DATETIME NOT NULL,
            last_opened_at DATETIME NULL,
            open_count INT UNSIGNED NOT NULL DEFAULT 0,
            click_count INT UNSIGNED NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            UNIQUE KEY token (token),
            KEY lead_email (lead_email),
            KEY sent_at (sent_at)
        ) {$charset};";

        dbDelta($sql1);
        dbDelta($sql2);
        dbDelta($sql3);
        dbDelta($sql4);

        // Default settings
        if (!get_option('dol_settings')) {
            add_option('dol_settings', [
                'brand_name' => 'Digitify',
                'brand_primary' => '#ff6a00',
                'brand_logo_url' => '',
                'from_name' => get_bloginfo('name'),
                'from_email' => get_option('admin_email'),
            ]);
        }

        // Seed default template if none exists
        $count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$tpl}");
        if ($count === 0) {
            $now = current_time('mysql');
            $default_html = self::default_template_html();
            $wpdb->insert($tpl, [
                'name' => 'Standaard (Premium)',
                'subject' => 'Even een korte vraag, {{name}}',
                'html' => $default_html,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private static function default_template_html(): string {
        return '<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
          <tr>
            <td style="padding:22px 24px;background:linear-gradient(135deg,#ff6a00,#ff8a3d);">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.22);display:inline-block;"></div>
                <div style="color:#fff;font-weight:700;font-size:16px;letter-spacing:.2px;">{{brand_name}}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 24px 10px 24px;">
              <div style="font-size:22px;font-weight:800;line-height:1.2;margin:0 0 10px 0;">Hoi {{name}},</div>
              <div style="font-size:15px;line-height:1.6;color:#334155;">
                Ik had een korte vraag. Heb je 2 minuten om te antwoorden?
              </div>
              <div style="margin:18px 0;padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
                <div style="font-size:14px;color:#0f172a;font-weight:700;margin-bottom:6px;">Vraag</div>
                <div style="font-size:14px;line-height:1.7;color:#334155;">
                  {{message}}
                </div>
              </div>
              <div style="margin:18px 0 6px 0;">
                <a href="{{cta_url}}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;font-size:14px;">Antwoord hier</a>
              </div>
              <div style="font-size:12px;color:#64748b;line-height:1.6;margin-top:10px;">
                Indien de knop niet werkt: {{cta_url}}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 22px 24px;border-top:1px solid #eef2f7;">
              <div style="font-size:12px;color:#64748b;line-height:1.6;">
                Groeten,<br>
                {{from_name}} — {{brand_name}}
              </div>
            </td>
          </tr>
        </table>
        <div style="max-width:640px;text-align:center;font-size:11px;color:#94a3b8;line-height:1.6;margin-top:10px;">
          Je ontvangt deze mail omdat we eerder contact hadden. Als dit niet klopt, antwoord gerust met “STOP”.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>';
    }
}
