<?php
namespace OWMC\Controllers;

use OWMC\Services\LeadService;
use OWMC\Services\CompanyService;

/**
 * REST API controller — the only entry point for frontend submissions.
 * All business logic delegated to services; this class only handles
 * HTTP concerns (auth, rate limiting, request parsing, response formatting).
 */
class RestController {

    public function __construct(
        private readonly LeadService    $leadService,
        private readonly CompanyService $companyService,
    ) {}

    public function register(): void {
        register_rest_route( 'offerte-wizard/v1', '/lead', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'submitLead' ],
            'permission_callback' => '__return_true', // token auth below
            'args'                => [],
        ] );

        // Wizard step tracking endpoint
        register_rest_route( 'offerte-wizard/v1', '/event', [
            'methods'             => 'POST',
            'callback'            => [ $this, 'trackEvent' ],
            'permission_callback' => '__return_true',
        ] );
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    public function submitLead( \WP_REST_Request $req ): \WP_REST_Response {
        // 1. Token auth
        $authError = $this->validateToken( $req );
        if ( $authError ) return $authError;

        // 2. Rate limit
        $rlError = $this->checkRateLimit();
        if ( $rlError ) return $rlError;

        // 3. Parse body
        $body = $req->get_json_params();
        if ( ! is_array( $body ) ) {
            return $this->error( 'Ongeldig request formaat.', 400 );
        }

        // 4. Honeypot
        if ( ! empty( $body['_hp'] ) ) {
            // Silently succeed to not tip off bots
            return new \WP_REST_Response( [ 'ok' => true ], 200 );
        }

        // 5. Validate required fields
        $validation = $this->validatePayload( $body );
        if ( is_wp_error( $validation ) ) {
            return $this->error( $validation->get_error_message(), 422 );
        }

        // 6. Load company (company_id scoping — no cross-tenant leak)
        $slug    = sanitize_title( $body['company'] ?? 'default' );
        $company = $this->companyService->findBySlug( $slug );
        if ( ! $company ) {
            return $this->error( 'Onbekend bedrijf.', 400 );
        }

        // 7. Delegate to LeadService
        try {
            $leadId = $this->leadService->intake(
                $body,
                $company,
                $this->getClientIp( $req ),
                (string) $req->get_header( 'User-Agent' )
            );
        } catch ( \Throwable $e ) {
            if ( defined( 'OWMC_DEBUG' ) && OWMC_DEBUG ) {
                error_log( '[OWMC REST] Intake error: ' . $e->getMessage() );
            }
            return $this->error( 'Server fout. Probeer later opnieuw.', 500 );
        }

        
        // 8. Create follow-up agenda item (Digitify Agenda Pro integration)
        // When a lead is submitted, push an inbound event so it appears in the week overview on the submission day.
        if ( function_exists( 'do_action' ) ) {
            $contact_email = '';
            if ( ! empty( $body['email'] ) ) $contact_email = sanitize_email( (string) $body['email'] );
            if ( $contact_email === '' && ! empty( $body['contact_email'] ) ) $contact_email = sanitize_email( (string) $body['contact_email'] );

            $payload = [
                'event_name' => 'offerte_submitted',
                'source_app' => 'offerte_wizard_multicompany',
                'source_id'  => (string) $leadId,
                'timestamp'  => current_time( 'mysql' ),
                'email'      => $contact_email,
                // extra context (optional)
                'company'    => $slug,
            ];

            // Direct inbox hook (Agenda Pro listens to this)
            do_action( 'dap_inbox_event', $payload );

            // Also emit generic event hub for other Digitify apps (optional)
            do_action( 'digitify_event_hub_emit', $payload );
        }

        return new \WP_REST_Response( [ 'ok' => true, 'lead_id' => $leadId ], 200 );
    }

    public function trackEvent( \WP_REST_Request $req ): \WP_REST_Response {
        $authError = $this->validateToken( $req );
        if ( $authError ) return $authError;

        $body    = $req->get_json_params() ?: [];
        $event   = sanitize_key( $body['event']      ?? '' );
        $company = sanitize_title( $body['company']   ?? '' );
        $step    = (int) ( $body['step']             ?? 0 );

        if ( ! in_array( $event, [ 'wizard_started', 'wizard_step', 'wizard_completed' ], true ) ) {
            return $this->error( 'Ongeldig event.', 400 );
        }

        // Lightweight event persist without full LeadService overhead
        global $wpdb;
        $wpdb->insert( $wpdb->prefix . 'owmc_events', [
            'event_name'  => $event,
            'entity_type' => 'wizard',
            'payload'     => wp_json_encode( [ 'company' => $company, 'step' => $step ], JSON_UNESCAPED_UNICODE ),
            'created_at'  => current_time( 'mysql' ),
        ] );

        return new \WP_REST_Response( [ 'ok' => true ], 200 );
    }

    // ── Auth & Validation ──────────────────────────────────────────────────────

    private function validateToken( \WP_REST_Request $req ): ?\WP_REST_Response {
        $global   = get_option( 'owmc_global', [] );
        $expected = (string) ( $global['public_token'] ?? '' );
        $provided = (string) $req->get_header( 'X-LEAD-TOKEN' );

        if ( empty( $expected ) || ! hash_equals( $expected, $provided ) ) {
            return new \WP_REST_Response( [ 'message' => 'Niet geautoriseerd.' ], 401 );
        }
        return null;
    }

    private function checkRateLimit(): ?\WP_REST_Response {
        $ip  = $this->getClientIp();
        $key = 'owmc_rl_' . md5( $ip );
        $now = time();

        if ( $last = (int) get_transient( $key ) ) {
            if ( $now - $last < 10 ) {
                return new \WP_REST_Response( [ 'message' => 'Te veel verzoeken.' ], 429 );
            }
        }
        set_transient( $key, $now, 30 );
        return null;
    }

    private function validatePayload( array $body ): true|\WP_Error {
        $contact = $body['contact'] ?? [];

        if ( empty( $body['diensten'] ) || ! is_array( $body['diensten'] ) ) {
            return new \WP_Error( 'validation', 'Selecteer minimaal één dienst.' );
        }

        $email = sanitize_email( $contact['email'] ?? '' );
        if ( ! is_email( $email ) ) {
            return new \WP_Error( 'validation', 'Geldig e-mailadres is verplicht.' );
        }

        if ( empty( $contact['naam'] ) && empty( $contact['name'] ) ) {
            return new \WP_Error( 'validation', 'Naam is verplicht.' );
        }

        return true;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function getClientIp( ?\WP_REST_Request $req = null ): string {
        foreach ( [ 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ] as $key ) {
            if ( ! empty( $_SERVER[ $key ] ) ) {
                $val = (string) $_SERVER[ $key ];
                if ( $key === 'HTTP_X_FORWARDED_FOR' ) {
                    $val = trim( explode( ',', $val )[0] );
                }
                return preg_replace( '/[^0-9a-fA-F:.]/', '', $val ) ?? '';
            }
        }
        return '';
    }

    private function error( string $message, int $code ): \WP_REST_Response {
        return new \WP_REST_Response( [ 'message' => $message ], $code );
    }
}
