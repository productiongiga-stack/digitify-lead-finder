<?php
defined( 'ABSPATH' ) || exit;

/**
 * Handles Google Calendar OAuth 2.0 + API calls.
 */
class Digitify_Google_Calendar {

    const OAUTH_URL   = 'https://accounts.google.com/o/oauth2/v2/auth';
    const TOKEN_URL   = 'https://oauth2.googleapis.com/token';
    const REVOKE_URL  = 'https://oauth2.googleapis.com/revoke';
    const CAL_API     = 'https://www.googleapis.com/calendar/v3';
    const SCOPE       = 'https://www.googleapis.com/auth/calendar';

    /* ---------------------------------------------------------------
     * OAuth flow
     * ------------------------------------------------------------- */

    /**
     * Returns the URL the admin must visit to start OAuth.
     */
    public static function get_auth_url(): string {
        $opts    = get_option( 'digitify_booking_google', [] );
        $cid     = $opts['client_id'] ?? '';
        $redirect = admin_url( 'admin.php?page=digitify-booking-settings&action=oauth_callback' );

        $state = wp_create_nonce( 'digitify_google_oauth' );
        update_option( 'digitify_google_oauth_state', $state );

        return self::OAUTH_URL . '?' . http_build_query( [
            'client_id'             => $cid,
            'redirect_uri'          => $redirect,
            'response_type'         => 'code',
            'scope'                 => self::SCOPE,
            'access_type'           => 'offline',
            'prompt'                => 'consent',
            'state'                 => $state,
        ] );
    }

    /**
     * Exchange authorization code for tokens.
     */
    public static function handle_oauth_callback( string $code ): bool|string {
        $opts     = get_option( 'digitify_booking_google', [] );
        $redirect = admin_url( 'admin.php?page=digitify-booking-settings&action=oauth_callback' );

        $response = wp_remote_post( self::TOKEN_URL, [
            'body' => [
                'code'          => $code,
                'client_id'     => $opts['client_id'] ?? '',
                'client_secret' => $opts['client_secret'] ?? '',
                'redirect_uri'  => $redirect,
                'grant_type'    => 'authorization_code',
            ],
        ] );

        if ( is_wp_error( $response ) ) {
            return $response->get_error_message();
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( isset( $body['error'] ) ) {
            return $body['error_description'] ?? $body['error'];
        }

        $tokens = [
            'access_token'  => $body['access_token'],
            'refresh_token' => $body['refresh_token'] ?? ( $opts['tokens']['refresh_token'] ?? '' ),
            'expires_at'    => time() + ( (int) ( $body['expires_in'] ?? 3600 ) ),
        ];
        update_option( 'digitify_booking_google_tokens', $tokens );

        // Fetch calendar list and store default calendar
        $calendar_id = self::get_primary_calendar_id();
        if ( $calendar_id ) {
            update_option( 'digitify_booking_google_calendar_id', $calendar_id );
        }

        return true;
    }

    /**
     * Revoke and remove stored tokens.
     */
    public static function disconnect(): void {
        $tokens = get_option( 'digitify_booking_google_tokens', [] );
        if ( ! empty( $tokens['access_token'] ) ) {
            wp_remote_post( self::REVOKE_URL, [
                'body' => [ 'token' => $tokens['access_token'] ],
            ] );
        }
        delete_option( 'digitify_booking_google_tokens' );
        delete_option( 'digitify_booking_google_calendar_id' );
    }

    /* ---------------------------------------------------------------
     * Token management
     * ------------------------------------------------------------- */

    public static function is_connected(): bool {
        $tokens = get_option( 'digitify_booking_google_tokens', [] );
        return ! empty( $tokens['refresh_token'] );
    }

    private static function get_access_token(): string|false {
        $tokens = get_option( 'digitify_booking_google_tokens', [] );
        if ( empty( $tokens['refresh_token'] ) ) {
            return false;
        }

        // Refresh if expired (5 min buffer)
        if ( empty( $tokens['access_token'] ) || ( $tokens['expires_at'] ?? 0 ) < time() + 300 ) {
            $opts     = get_option( 'digitify_booking_google', [] );
            $response = wp_remote_post( self::TOKEN_URL, [
                'body' => [
                    'refresh_token' => $tokens['refresh_token'],
                    'client_id'     => $opts['client_id'] ?? '',
                    'client_secret' => $opts['client_secret'] ?? '',
                    'grant_type'    => 'refresh_token',
                ],
            ] );

            if ( is_wp_error( $response ) ) {
                return false;
            }

            $body = json_decode( wp_remote_retrieve_body( $response ), true );
            if ( ! isset( $body['access_token'] ) ) {
                return false;
            }

            $tokens['access_token'] = $body['access_token'];
            $tokens['expires_at']   = time() + ( (int) ( $body['expires_in'] ?? 3600 ) );
            update_option( 'digitify_booking_google_tokens', $tokens );
        }

        return $tokens['access_token'];
    }

    /* ---------------------------------------------------------------
     * Calendar API
     * ------------------------------------------------------------- */

    private static function api_request( string $method, string $endpoint, array $body = [] ): array|false {
        $token = self::get_access_token();
        if ( ! $token ) {
            return false;
        }

        $args = [
            'method'  => $method,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type'  => 'application/json',
            ],
        ];

        if ( ! empty( $body ) ) {
            $args['body'] = wp_json_encode( $body );
        }

        $response = wp_remote_request( self::CAL_API . $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            return false;
        }

        return json_decode( wp_remote_retrieve_body( $response ), true );
    }

    public static function get_primary_calendar_id(): string|false {
        $data = self::api_request( 'GET', '/calendars/primary' );
        return $data['id'] ?? false;
    }

    /**
     * Get busy times for a date range (YYYY-MM-DD).
     */
    public static function get_busy_times( string $date_from, string $date_to ): array {
        $cal_id = get_option( 'digitify_booking_google_calendar_id', 'primary' );
        $tz_str = wp_timezone_string();
        $tz     = new DateTimeZone( $tz_str );
        $dt_min = new DateTime( $date_from . ' 00:00:00', $tz );
        $dt_max = new DateTime( $date_to   . ' 23:59:59', $tz );
        $time_min = $dt_min->format( DateTime::ATOM );
        $time_max = $dt_max->format( DateTime::ATOM );

        $data = self::api_request( 'POST', '/freeBusy', [
            'timeMin'  => $time_min,
            'timeMax'  => $time_max,
            'timeZone' => wp_timezone_string(),
            'items'    => [ [ 'id' => $cal_id ] ],
        ] );

        return $data['calendars'][ $cal_id ]['busy'] ?? [];
    }

    /**
     * Create a Google Calendar event, returns event data or false.
     */
    public static function create_event( array $booking, array $event_type ): array|false {
        $cal_id  = get_option( 'digitify_booking_google_calendar_id', 'primary' );
        $tz      = wp_timezone_string();
        $opts    = get_option( 'digitify_booking_settings', [] );

        $event = [
            'summary'     => $event_type['title'] . ' — ' . $booking['attendee_name'],
            'description' => $booking['attendee_notes'] ?? '',
            'start'       => [ 'dateTime' => $booking['start_time'], 'timeZone' => $tz ],
            'end'         => [ 'dateTime' => $booking['end_time'],   'timeZone' => $tz ],
            'attendees'   => [
                [ 'email' => $booking['attendee_email'], 'displayName' => $booking['attendee_name'] ],
            ],
            'reminders'   => [
                'useDefault' => false,
                'overrides'  => [
                    [ 'method' => 'email',  'minutes' => 1440 ],
                    [ 'method' => 'popup',  'minutes' => 30 ],
                ],
            ],
        ];

        // Apply per-event-type color on the shared calendar
        $color_id = (int) ( $event_type['google_color_id'] ?? 0 );
        if ( $color_id >= 1 && $color_id <= 11 ) {
            $event['colorId'] = (string) $color_id;
        }

        // Add Google Meet if enabled
        if ( ! empty( $opts['google_meet'] ) ) {
            $event['conferenceData'] = [
                'createRequest' => [ 'requestId' => uniqid( 'digitify_', true ) ],
            ];
        }

        $query    = ! empty( $opts['google_meet'] ) ? '?conferenceDataVersion=1' : '';
        $response = self::api_request( 'POST', '/calendars/' . rawurlencode( $cal_id ) . '/events' . $query, $event );

        return $response ?? false;
    }

    /**
     * Delete event by Google event ID.
     */
    public static function delete_event( string $google_event_id ): bool {
        $cal_id = get_option( 'digitify_booking_google_calendar_id', 'primary' );
        $data   = self::api_request( 'DELETE', '/calendars/' . rawurlencode( $cal_id ) . '/events/' . rawurlencode( $google_event_id ) );
        return $data !== false;
    }
}
