<?php
// Helpers (public API)

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Normaliseer e-mail (dedupe key).
 * - trim
 * - lowercase
 * - sanitize_email
 */
function digitify_crm_normalize_email( string $email ): string {
    $email = trim( $email );
    $email = strtolower( $email );
    $email = sanitize_email( $email );
    return $email;
}

/**
 * Bouw een tracking pixel URL voor open-tracking.
 */
function digitify_crm_tracking_pixel_url( string $trackId ): string {
    $trackId = preg_replace( '/[^a-zA-Z0-9_-]/', '', $trackId );
    return admin_url( 'admin-ajax.php?action=dcrm_track_open&track_id=' . rawurlencode( $trackId ) );
}

/**
 * Bouw een click-tracking URL.
 */
function digitify_crm_tracking_click_url( string $trackId, string $url ): string {
    $trackId = preg_replace( '/[^a-zA-Z0-9_-]/', '', $trackId );
    $payload = rtrim( strtr( base64_encode( $url ), '+/', '-_' ), '=' );
    return admin_url( 'admin-ajax.php?action=dcrm_track_click&track_id=' . rawurlencode( $trackId ) . '&u=' . rawurlencode( $payload ) );
}
