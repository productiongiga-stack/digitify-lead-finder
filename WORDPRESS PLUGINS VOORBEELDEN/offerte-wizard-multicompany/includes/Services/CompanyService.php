<?php
namespace OWMC\Services;

use OWMC\Repositories\CompanyRepository;
use OWMC\Core\Installer;

class CompanyService {

    public function __construct(
        private readonly CompanyRepository $repo
    ) {}

    public function findBySlug( string $slug ): ?\stdClass {
        return $this->repo->findBySlug( sanitize_title( $slug ) );
    }

    public function findById( int $id ): ?\stdClass {
        return $this->repo->findById( $id );
    }

    public function allForList(): array {
        return $this->repo->allForList();
    }

    public function all(): array {
        return $this->repo->all( 'name ASC' );
    }

    /**
     * Create or update a company.
     * Validates and sanitizes all fields here — no raw $_POST in views.
     */
    public function save( array $raw, int $id = 0 ): int|\WP_Error {
        $slug = sanitize_title( $raw['slug'] ?? '' );
        $name = sanitize_text_field( $raw['name'] ?? '' );
        if ( ! $name ) return new \WP_Error( 'validation', 'Naam is verplicht.' );
        if ( ! $slug ) $slug = sanitize_title( $name );

        $data = [
            'slug'           => $slug,
            'name'           => $name,
            'logo_url'       => esc_url_raw( $raw['logo_url'] ?? '' ),
            'primary_color'  => $this->sanitizeColor( $raw['primary_color']  ?? '#f7c600' ),
            'secondary_color'=> $this->sanitizeColor( $raw['secondary_color'] ?? '#e5b800' ),
            'bg_color'       => $this->sanitizeColor( $raw['bg_color']   ?? '#f6f7f9' ),
            'card_color'     => $this->sanitizeColor( $raw['card_color'] ?? '#ffffff' ),
            'text_color'     => $this->sanitizeColor( $raw['text_color'] ?? '#111318' ),
            'muted_color'    => $this->sanitizeColor( $raw['muted_color'] ?? '#5b6472' ),
            'border_color'   => sanitize_text_field( $raw['border_color'] ?? 'rgba(17,19,24,.10)' ),
            'phone'          => sanitize_text_field( $raw['phone'] ?? '' ),
            'email'          => sanitize_email( $raw['email'] ?? '' ),
            'header_meta'    => sanitize_text_field( $raw['header_meta'] ?? '' ),
            'thankyou_title' => sanitize_text_field( $raw['thankyou_title'] ?? 'Bedankt!' ),
            'thankyou_text'  => wp_kses_post( $raw['thankyou_text'] ?? '' ),
            'btw_rate'       => min( 100, max( 0, (int) ( $raw['btw_rate'] ?? 21 ) ) ),
            'btw_enabled'    => isset( $raw['btw_enabled'] ) ? 1 : 0,
            'email_template' => sanitize_key( $raw['email_template'] ?? 'default' ),
            'pdf_template'   => sanitize_key( $raw['pdf_template'] ?? 'default' ),
            'smtp_host'      => sanitize_text_field( $raw['smtp_host'] ?? '' ),
            'smtp_port'      => (int) ( $raw['smtp_port'] ?? 587 ),
            'smtp_user'      => sanitize_text_field( $raw['smtp_user'] ?? '' ),
            'smtp_from'      => sanitize_email( $raw['smtp_from'] ?? '' ),
            'smtp_from_name' => sanitize_text_field( $raw['smtp_from_name'] ?? '' ),
        ];

        // Encrypt SMTP password if provided
        if ( ! empty( $raw['smtp_pass'] ) ) {
            $data['smtp_pass'] = $this->encryptSmtp( sanitize_text_field( $raw['smtp_pass'] ) );
        }

        if ( $id > 0 ) {
            $this->repo->update( $data, [ 'id' => $id ] );
            return $id;
        }

        return $this->repo->insert( $data );
    }

    public function delete( int $id ): void {
        $this->repo->deleteWithCascade( $id );
    }

    public function saveWizardJson( string $slug, string $rawJson ): true|\WP_Error {
        $decoded = json_decode( wp_unslash( $rawJson ), true );
        if ( ! is_array( $decoded ) ) {
            return new \WP_Error( 'invalid_json', 'Ongeldige JSON.' );
        }
        if ( empty( $decoded['services'] ) || ! is_array( $decoded['services'] ) ) {
            return new \WP_Error( 'missing_services', 'services array is verplicht.' );
        }

        $company = $this->findBySlug( $slug );
        if ( ! $company ) {
            return new \WP_Error( 'not_found', 'Bedrijf niet gevonden.' );
        }

        $json = wp_json_encode( $decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
        $this->repo->updateWizardJson( (int) $company->id, $json );
        return true;
    }

    public function getWizardSchema( \stdClass $company ): array {
        if ( ! empty( $company->wizard_json ) ) {
            $decoded = json_decode( $company->wizard_json, true );
            if ( is_array( $decoded ) ) return $decoded;
        }
        return Installer::defaultWizardSchema();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function sanitizeColor( string $raw ): string {
        $raw = trim( $raw );
        // Allow hex colors and rgba() values
        if ( preg_match( '/^#[0-9a-fA-F]{3,8}$/', $raw ) ) return $raw;
        if ( preg_match( '/^rgba?\([^)]+\)$/', $raw ) ) return $raw;
        return '#f7c600';
    }

    private function encryptSmtp( string $pass ): string {
        // Basic reversible obfuscation — for production, use proper encryption
        return base64_encode( $pass . '|owmc' . AUTH_SALT );
    }
}
