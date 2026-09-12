<?php
namespace DCRM\Controllers;

use DCRM\Repositories\EmailLogRepository;
use DCRM\Repositories\ContactRepository;

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Public tracking endpoints for HTML mails.
 *
 * - Open tracking:  /wp-admin/admin-ajax.php?action=dcrm_track_open&track_id=...
 * - Click tracking: /wp-admin/admin-ajax.php?action=dcrm_track_click&track_id=...&u=base64url(...)
 */
class TrackingController {

    /** @var EmailLogRepository */
    private $emails;

    /** @var ContactRepository */
    private $contacts;

    public function __construct( EmailLogRepository $emails, ContactRepository $contacts ) {
        $this->emails    = $emails;
        $this->contacts  = $contacts;
    }

    public function register(): void {
        // Open tracking
        add_action( 'wp_ajax_nopriv_dcrm_track_open', [ $this, 'trackOpen' ] );
        add_action( 'wp_ajax_dcrm_track_open',        [ $this, 'trackOpen' ] );

        // Click tracking
        add_action( 'wp_ajax_nopriv_dcrm_track_click', [ $this, 'trackClick' ] );
        add_action( 'wp_ajax_dcrm_track_click',        [ $this, 'trackClick' ] );
    }

    public function trackOpen(): void {
        $trackId = isset( $_GET['track_id'] ) ? (string) $_GET['track_id'] : '';
        $trackId = preg_replace( '/[^a-zA-Z0-9_-]/', '', $trackId );

        if ( $trackId ) {
            $this->emails->markOpened( $trackId );

            // Optional: log event on contact timeline when we can resolve contact_id
            $log = $this->emails->findByTrackId( $trackId );
            if ( $log && ! empty( $log->contact_id ) ) {
                $this->contacts->logEvent( (int) $log->contact_id, 'email_opened', 'E-mail geopend', [ 'track_id' => $trackId ], null, current_time('mysql'), 'outreach' );
            }
        }

        // Return a 1x1 transparent gif
        nocache_headers();
        header( 'Content-Type: image/gif' );
        header( 'Content-Length: 43' );
        echo "GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xFF\xFF\xFF!\xF9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;";
        exit;
    }

    public function trackClick(): void {
        $trackId = isset( $_GET['track_id'] ) ? (string) $_GET['track_id'] : '';
        $trackId = preg_replace( '/[^a-zA-Z0-9_-]/', '', $trackId );

        $u = isset( $_GET['u'] ) ? (string) $_GET['u'] : '';
        $u = preg_replace( '/[^a-zA-Z0-9\-_]/', '', $u );
        $url = base64_decode( strtr( $u, '-_', '+/' ) . str_repeat( '=', ( 4 - ( strlen( $u ) % 4 ) ) % 4 ) );
        $url = is_string( $url ) ? $url : '';
        $url = esc_url_raw( $url );

        if ( $trackId ) {
            $this->emails->markClicked( $trackId );

            $log = $this->emails->findByTrackId( $trackId );
            if ( $log && ! empty( $log->contact_id ) ) {
                $this->contacts->logEvent( (int) $log->contact_id, 'email_clicked', 'Link geklikt', [ 'track_id' => $trackId, 'url' => $url ], null, current_time('mysql'), 'outreach' );
            }
        }

        if ( empty( $url ) ) {
            wp_die( 'Ongeldige link.' );
        }

        wp_redirect( $url );
        exit;
    }
}
