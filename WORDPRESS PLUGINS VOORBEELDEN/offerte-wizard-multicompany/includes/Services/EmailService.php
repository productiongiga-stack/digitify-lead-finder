<?php
namespace OWMC\Services;

use OWMC\Repositories\EmailLogRepository;
use OWMC\Events\EventDispatcher;
use OWMC\Events\Events\EmailSent;

/**
 * Central email service with:
 *  - HTML template rendering
 *  - Open-tracking pixel injection
 *  - Click-tracking URL wrapping
 *  - Full send/open/click logging
 */
class EmailService {

    public function __construct(
        private readonly EmailLogRepository $logRepo,
        private readonly EventDispatcher    $dispatcher
    ) {}

    // ── Primary send method ───────────────────────────────────────────────────

    /**
     * @param array{
     *   to:         string,
     *   subject:    string,
     *   template:   string,
     *   vars:       array,
     *   lead_id?:   int,
     *   contact_id?:int,
     *   company_id?:int,
     *   company?:   \stdClass,
     * } $args
     */
    public function send( array $args ): bool|\WP_Error {
        $to        = sanitize_email( $args['to'] ?? '' );
        $subject   = sanitize_text_field( $args['subject'] ?? '(geen onderwerp)' );
        $template  = sanitize_key( $args['template'] ?? 'lead-notification' );
        $vars      = $args['vars'] ?? [];
        $leadId    = (int) ( $args['lead_id']    ?? 0 );
        $contactId = (int) ( $args['contact_id'] ?? 0 );
        $companyId = (int) ( $args['company_id'] ?? 0 );

        if ( ! is_email( $to ) ) {
            return new \WP_Error( 'invalid_email', "Ongeldig e-mailadres: $to" );
        }

        // Generate tracking token
        $trackId = wp_generate_uuid4();

        // Create log entry (queued)
        $logId = $this->logRepo->insert( [
            'lead_id'    => $leadId    ?: null,
            'contact_id' => $contactId ?: null,
            'company_id' => $companyId ?: null,
            'to_email'   => $to,
            'subject'    => $subject,
            'template'   => $template,
            'track_id'   => $trackId,
            'status'     => 'queued',
        ] );

        // Render template
        $vars['track_id']   = $trackId;
        $vars['track_pixel'] = $this->trackingPixelUrl( $trackId );
        $vars['log_id']     = $logId;

        try {
            $body = $this->renderTemplate( $template, $vars );
        } catch ( \Throwable $e ) {
            $this->logRepo->markFailed( $logId, $e->getMessage() );
            return new \WP_Error( 'template_error', $e->getMessage() );
        }

        // Wrap links with click tracking
        $body = $this->wrapLinks( $body, $trackId );

        // Configure mailer
        $headers = [ 'Content-Type: text/html; charset=UTF-8' ];

        // Company From header
        if ( ! empty( $args['company'] ) ) {
            $from = sanitize_email( $args['company']->smtp_from ?? '' );
            $fromName = sanitize_text_field( $args['company']->smtp_from_name ?? $args['company']->name ?? '' );
            if ( $from ) {
                $headers[] = "From: $fromName <$from>";
            }
        }

        // Send
        $sent = false;
        try {
            $sent = wp_mail( $to, $subject, $body, $headers );
        } catch ( \Throwable $e ) {
            $this->logRepo->markFailed( $logId, $e->getMessage() );
            return new \WP_Error( 'send_failed', $e->getMessage() );
        }

        if ( $sent ) {
            $this->logRepo->markSent( $logId );
            $this->dispatcher->dispatch( new EmailSent(
                [ 'to' => $to, 'subject' => $subject, 'track_id' => $trackId ],
                companyId: $companyId ?: null,
                entityId:  $logId
            ) );
            return true;
        }

        $this->logRepo->markFailed( $logId, 'wp_mail() returned false.' );
        return new \WP_Error( 'send_failed', 'E-mail kon niet verstuurd worden.' );
    }

    // ── Template rendering ────────────────────────────────────────────────────

    public function renderTemplate( string $template, array $vars = [] ): string {
        $file = OWMC_DIR . "templates/emails/{$template}.php";
        if ( ! file_exists( $file ) ) {
            $file = OWMC_DIR . 'templates/emails/lead-notification.php';
        }
        if ( ! file_exists( $file ) ) {
            throw new \RuntimeException( "Email template niet gevonden: $template" );
        }

        // Extract vars into scope
        extract( $vars, EXTR_SKIP );

        ob_start();
        include $file;
        $inner = ob_get_clean();

        // Wrap in base layout
        $base = OWMC_DIR . 'templates/emails/base.php';
        if ( file_exists( $base ) ) {
            $content = $inner;
            ob_start();
            include $base;
            return ob_get_clean();
        }

        return $inner;
    }

    // ── Tracking ──────────────────────────────────────────────────────────────

    public function trackingPixelUrl( string $trackId ): string {
        return add_query_arg( [
            'owmc_track' => 'open',
            'tid'        => urlencode( $trackId ),
        ], home_url( '/' ) );
    }

    public function clickTrackUrl( string $trackId, string $targetUrl ): string {
        return add_query_arg( [
            'owmc_track' => 'click',
            'tid'        => urlencode( $trackId ),
            'url'        => urlencode( $targetUrl ),
        ], home_url( '/' ) );
    }

    private function wrapLinks( string $html, string $trackId ): string {
        // Wrap all <a href="..."> links except unsubscribe/track links
        return preg_replace_callback(
            '/<a\s+([^>]*?)href=["\']([^"\']+)["\']([^>]*?)>/i',
            function ( array $m ) use ( $trackId ) {
                $url = $m[2];
                // Skip already-tracked, mailto, tel, and anchor links
                if (
                    str_contains( $url, 'owmc_track' ) ||
                    str_starts_with( $url, 'mailto:' )  ||
                    str_starts_with( $url, 'tel:' )     ||
                    str_starts_with( $url, '#' )
                ) {
                    return $m[0];
                }
                $tracked = $this->clickTrackUrl( $trackId, $url );
                return "<a {$m[1]}href=\"" . esc_url( $tracked ) . "\"{$m[3]}>";
            },
            $html
        ) ?? $html;
    }

    // ── Preview ───────────────────────────────────────────────────────────────

    public function preview( string $template, array $vars = [] ): string {
        $vars['track_id']    = 'preview-' . uniqid();
        $vars['track_pixel'] = '';
        $vars['log_id']      = 0;
        try {
            return $this->renderTemplate( $template, $vars );
        } catch ( \Throwable $e ) {
            return '<p style="color:red;">Template fout: ' . esc_html( $e->getMessage() ) . '</p>';
        }
    }
}
