<?php
namespace OWMC\Controllers;

use OWMC\Repositories\EmailLogRepository;
use OWMC\Events\EventDispatcher;
use OWMC\Events\Events\EmailOpened;

/**
 * Handles email open-tracking pixel and click-tracking redirects.
 * Registered on 'init' to intercept early before template loading.
 */
class TrackingController {

    public function __construct(
        private readonly EmailLogRepository $logRepo,
        private readonly EventDispatcher    $dispatcher
    ) {}

    public function register(): void {
        add_action( 'template_redirect', [ $this, 'handle' ] );
    }

    public function handle(): void {
        $trackType = sanitize_key( $_GET['owmc_track'] ?? '' );
        if ( ! $trackType ) return;

        $trackId = sanitize_text_field( $_GET['tid'] ?? '' );
        if ( ! $trackId ) return;

        match ( $trackType ) {
            'open'  => $this->handleOpen( $trackId ),
            'click' => $this->handleClick( $trackId ),
            default => null,
        };
    }

    // ── Open tracking pixel ───────────────────────────────────────────────────

    private function handleOpen( string $trackId ): void {
        $log = $this->logRepo->findByTrackId( $trackId );
        if ( $log ) {
            $this->logRepo->markOpened( $trackId );
            $this->dispatcher->dispatch( new EmailOpened(
                [ 'track_id' => $trackId ],
                companyId: $log->company_id ? (int) $log->company_id : null,
                entityId:  (int) $log->id
            ) );
        }

        // Serve a 1×1 transparent GIF
        header( 'Content-Type: image/gif' );
        header( 'Cache-Control: no-store, no-cache, must-revalidate' );
        header( 'Pragma: no-cache' );
        echo base64_decode( 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' );
        exit;
    }

    // ── Click tracking redirect ───────────────────────────────────────────────

    private function handleClick( string $trackId ): void {
        $rawUrl = sanitize_text_field( $_GET['url'] ?? '' );
        $target = esc_url_raw( urldecode( $rawUrl ) );

        if ( ! $target || ! filter_var( $target, FILTER_VALIDATE_URL ) ) {
            wp_die( 'Ongeldige redirect URL.' );
        }

        $log = $this->logRepo->findByTrackId( $trackId );
        if ( $log ) {
            $this->logRepo->markClicked( $trackId );
        }

        wp_redirect( $target, 302 );
        exit;
    }
}
