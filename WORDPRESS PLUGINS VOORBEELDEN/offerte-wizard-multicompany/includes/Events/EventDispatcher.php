<?php
namespace OWMC\Events;

use OWMC\Events\Events\BaseEvent;
use OWMC\Repositories\EventRepository;

/**
 * Internal event bus.
 *
 * Usage:
 *   $dispatcher->dispatch(new QuoteCreated(['lead_id' => 5], companyId: 1, entityId: 5));
 *
 * Listeners registered via:
 *   $dispatcher->listen('quote_created', fn(BaseEvent $e) => ...);
 *
 * Future: forward events to external Digitify Suite event hub via HTTP.
 */
class EventDispatcher {

    /** @var array<string, callable[]> */
    private array $listeners = [];

    public function __construct(
        private readonly EventRepository $eventRepo
    ) {}

    /**
     * Register a listener for a named event (or '*' for all).
     */
    public function listen( string $eventName, callable $listener ): void {
        $this->listeners[ $eventName ][] = $listener;
    }

    /**
     * Dispatch an event: persist it, then notify listeners.
     */
    public function dispatch( BaseEvent $event ): void {
        // 1. Persist to owmc_events log
        try {
            $this->eventRepo->insert( $event->toArray() );
        } catch ( \Throwable $e ) {
            if ( defined( 'OWMC_DEBUG' ) && OWMC_DEBUG ) {
                error_log( '[OWMC EventDispatcher] Failed to persist event: ' . $e->getMessage() );
            }
        }

        // 2. Notify WP hooks (allows external plugins to react)
        do_action( 'owmc_event', $event );
        do_action( 'owmc_event_' . $event->name(), $event );

        // 3. Notify internal listeners
        $this->notifyListeners( $event->name(), $event );
        $this->notifyListeners( '*', $event );

        // 4. Future: forward to external event hub
        // $this->forwardToHub($event);
    }

    private function notifyListeners( string $eventName, BaseEvent $event ): void {
        foreach ( $this->listeners[ $eventName ] ?? [] as $listener ) {
            try {
                $listener( $event );
            } catch ( \Throwable $e ) {
                if ( defined( 'OWMC_DEBUG' ) && OWMC_DEBUG ) {
                    error_log( '[OWMC EventDispatcher] Listener error for ' . $eventName . ': ' . $e->getMessage() );
                }
            }
        }
    }

    // Stub for future SaaS integration
    // private function forwardToHub(BaseEvent $event): void {
    //     $hubUrl = get_option('owmc_event_hub_url');
    //     if (!$hubUrl) return;
    //     wp_remote_post($hubUrl, ['body' => $event->toArray(), 'blocking' => false]);
    // }
}
