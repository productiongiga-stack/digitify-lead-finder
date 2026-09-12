<?php
defined( 'ABSPATH' ) || exit;

/**
 * Lightweight bridge between Digitify Booking and Digitify CRM Core.
 *
 * This adapter is intentionally "soft": if CRM Core is not active, it becomes a no-op.
 */
class Digitify_Booking_CRM_Adapter {

    /**
     * Log an event into Digitify CRM Core (if available).
     *
     * @param string $email
     * @param string $event_type
     * @param array  $meta
     * @param string $summary
     * @param string|null $occurred_at MySQL datetime or null (now)
     */
    public static function log( string $email, string $event_type, array $meta = [], string $summary = '', ?string $occurred_at = null ): void {
        $email = sanitize_email( $email );
        if ( ! $email || ! is_email( $email ) ) {
            return;
        }

        // Prefer CRM Core helper function if available.
        if ( function_exists( 'digitify_crm_log_event' ) ) {
            try {
                digitify_crm_log_event(
                    $email,
                    $event_type,
                    $meta,
                    $summary,
                    $occurred_at,
                    'booking'
                );
            } catch ( Throwable $e ) {
                // Never break booking flow.
            }
            return;
        }

        /**
         * Fallback hook so other integrations can still listen.
         */
        do_action( 'digitify_booking/crm_event', [
            'email'       => $email,
            'event_type'  => $event_type,
            'meta'        => $meta,
            'summary'     => $summary,
            'occurred_at' => $occurred_at,
            'source_app'  => 'booking',
        ] );
    }
}
