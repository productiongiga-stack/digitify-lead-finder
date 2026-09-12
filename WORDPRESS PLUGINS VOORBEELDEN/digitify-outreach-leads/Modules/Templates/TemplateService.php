<?php
namespace DOL\Modules\Templates;

final class TemplateService {
    public static function all(): array { return TemplateRepository::all(); }
    public static function find(int $id): ?array { return TemplateRepository::find($id); }
    public static function save(int $id, string $name, string $subject, string $html): array { return TemplateRepository::save($id,$name,$subject,$html); }

    public static function render(int $template_id, array $vars, bool $raw = false): string {
        $settings = get_option('dol_settings', []);
        $tpl = self::find($template_id) ?: (self::all()[0] ?? null);
        $html = $tpl ? $tpl['html'] : '';
        $subject = $tpl ? $tpl['subject'] : '';

        $repl = array_merge([
            'brand_name' => $settings['brand_name'] ?? get_bloginfo('name'),
            'from_name' => $settings['from_name'] ?? get_bloginfo('name'),
            'from_email' => $settings['from_email'] ?? get_option('admin_email'),
        ], $vars);

        foreach ($repl as $k => $v) {
            $html = str_replace('{{'.$k.'}}', (string)$v, $html);
            $subject = str_replace('{{'.$k.'}}', (string)$v, $subject);
        }

        // Ensure minimal message default
        $html = str_replace('{{message}}', (string)($vars['message'] ?? ''), $html);

        if ($raw) return $html;
        return $html;
    }

    public static function subject(int $template_id, array $vars): string {
        $settings = get_option('dol_settings', []);
        $tpl = self::find($template_id) ?: (self::all()[0] ?? null);
        $subject = $tpl ? $tpl['subject'] : 'Bericht';
        $repl = array_merge([
            'brand_name' => $settings['brand_name'] ?? get_bloginfo('name'),
            'from_name' => $settings['from_name'] ?? get_bloginfo('name'),
        ], $vars);
        foreach ($repl as $k=>$v) $subject = str_replace('{{'.$k.'}}', (string)$v, $subject);
        return $subject;
    }
}
