<?php
namespace DOL\Core;

use DOL\Core\Hooks;

final class Bootstrap {
    public static function init(): void {
        // Autoload (simple)
        spl_autoload_register([__CLASS__, 'autoload']);
        Hooks::init();
    }

    public static function autoload(string $class): void {
        if (strpos($class, 'DOL\\') !== 0) return;
        $path = DOL_PLUGIN_DIR . str_replace(['DOL\\', '\\'], ['', '/'], $class) . '.php';
        if (file_exists($path)) require_once $path;
    }

    public static function activate(): void {
        require_once DOL_PLUGIN_DIR . 'Core/Installer.php';
        Installer::run();
    }

    public static function deactivate(): void {
        // Keep data by default.
    }
}
