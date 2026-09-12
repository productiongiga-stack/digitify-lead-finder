<?php
namespace OWMC\Core;

use OWMC\Admin\AdminMenu;
use OWMC\Controllers\RestController;
use OWMC\Controllers\TrackingController;
use OWMC\Controllers\AjaxController;
use OWMC\Frontend\ShortcodeHandler;
use OWMC\Frontend\AssetLoader;
use OWMC\Events\EventDispatcher;
use OWMC\Repositories\CompanyRepository;
use OWMC\Repositories\LeadRepository;
use OWMC\Repositories\ContactRepository;
use OWMC\Repositories\EventRepository;
use OWMC\Repositories\EmailLogRepository;
use OWMC\Services\CompanyService;
use OWMC\Services\ContactService;
use OWMC\Services\LeadService;
use OWMC\Services\EmailService;
use OWMC\Services\PricingEngine;

/**
 * Plugin bootstrapper — wires the DI container and registers all hooks.
 */
class Plugin {

    private static ?Plugin $instance = null;
    private Container $container;

    private function __construct() {
        $this->container = new Container();
    }

    public static function getInstance(): static {
        if ( null === static::$instance ) {
            static::$instance = new static();
        }
        return static::$instance;
    }

    public function boot(): void {
        $this->registerBindings();
        $this->registerHooks();
    }

    public static function deactivate(): void {
        // Flush rewrite rules for tracking endpoints
        flush_rewrite_rules();
    }

    // ── Bindings ──────────────────────────────────────────────────────────────

    private function registerBindings(): void {
        $c = $this->container;

        // Repositories
        $c->singleton( CompanyRepository::class,  fn()  => new CompanyRepository() );
        $c->singleton( LeadRepository::class,     fn()  => new LeadRepository() );
        $c->singleton( ContactRepository::class,  fn()  => new ContactRepository() );
        $c->singleton( EventRepository::class,    fn()  => new EventRepository() );
        $c->singleton( EmailLogRepository::class, fn()  => new EmailLogRepository() );

        // Event dispatcher
        $c->singleton( EventDispatcher::class, fn( $c ) =>
            new EventDispatcher( $c->make( EventRepository::class ) )
        );

        // Services
        $c->singleton( CompanyService::class, fn( $c ) =>
            new CompanyService( $c->make( CompanyRepository::class ) )
        );

        $c->singleton( ContactService::class, fn( $c ) =>
            new ContactService(
                $c->make( ContactRepository::class ),
                $c->make( EventDispatcher::class )
            )
        );

        $c->singleton( PricingEngine::class, fn() => new PricingEngine() );

        $c->singleton( EmailService::class, fn( $c ) =>
            new EmailService(
                $c->make( EmailLogRepository::class ),
                $c->make( EventDispatcher::class )
            )
        );

        $c->singleton( LeadService::class, fn( $c ) =>
            new LeadService(
                $c->make( LeadRepository::class ),
                $c->make( ContactService::class ),
                $c->make( EmailService::class ),
                $c->make( EventDispatcher::class ),
                $c->make( PricingEngine::class )
            )
        );
    }

    // ── Hooks ─────────────────────────────────────────────────────────────────

    private function registerHooks(): void {
        $c = $this->container;

        // REST API
        add_action( 'rest_api_init', function () use ( $c ) {
            ( new RestController(
                $c->make( LeadService::class ),
                $c->make( CompanyService::class )
            ) )->register();
        } );

        // Tracking endpoints (open pixel, click redirect)
        add_action( 'init', function () use ( $c ) {
            ( new TrackingController(
                $c->make( EmailLogRepository::class ),
                $c->make( EventDispatcher::class )
            ) )->register();
        } );

        // Admin AJAX
        add_action( 'init', function () use ( $c ) {
            ( new AjaxController(
                $c->make( CompanyService::class ),
                $c->make( LeadService::class ),
                $c->make( ContactService::class )
            ) )->register();
        } );

        // Frontend
        add_action( 'init', function () use ( $c ) {
            ( new ShortcodeHandler(
                $c->make( CompanyService::class )
            ) )->register();
        } );

        add_action( 'wp_enqueue_scripts', function () {
            ( new AssetLoader() )->registerFrontend();
        } );

        // Admin
        if ( is_admin() ) {
            add_action( 'admin_menu', function () use ( $c ) {
                ( new AdminMenu( $c ) )->register();
            } );

            add_action( 'admin_enqueue_scripts', function ( string $hook ) {
                ( new AssetLoader() )->registerAdmin( $hook );
            } );
        }
    }

    public function getContainer(): Container {
        return $this->container;
    }
}
