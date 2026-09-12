<?php
namespace OWMC\Controllers;

use OWMC\Services\CompanyService;
use OWMC\Services\LeadService;
use OWMC\Services\ContactService;

/**
 * Admin AJAX handlers.
 * All actions require manage_options + nonce.
 */
class AjaxController {

    public function __construct(
        private readonly CompanyService $companyService,
        private readonly LeadService    $leadService,
        private readonly ContactService $contactService,
    ) {}

    public function register(): void {
        $actions = [
            'owmc_save_company'         => 'saveCompany',
            'owmc_delete_company'       => 'deleteCompany',
            'owmc_save_builder'         => 'saveBuilder',
            'owmc_update_lead_status'   => 'updateLeadStatus',
            'owmc_update_contact_stage' => 'updateContactStage',
            'owmc_save_contact_note'    => 'saveContactNote',
            'owmc_email_preview'        => 'emailPreview',
            'owmc_save_settings'        => 'saveSettings',
        ];

        foreach ( $actions as $action => $method ) {
            add_action( "wp_ajax_{$action}", [ $this, $method ] );
        }
    }

    // ── Company ───────────────────────────────────────────────────────────────

    public function saveCompany(): void {
        $this->requireAdmin();
        $this->checkNonce( 'owmc_save_company' );

        $id     = (int) ( $_POST['id'] ?? 0 );
        $result = $this->companyService->save( $_POST, $id );

        if ( is_wp_error( $result ) ) {
            $this->jsonError( $result->get_error_message() );
        }
        $this->jsonSuccess( [ 'id' => $result ] );
    }

    public function deleteCompany(): void {
        $this->requireAdmin();
        $this->checkNonce( 'owmc_delete_company' );

        $id = (int) ( $_POST['id'] ?? 0 );
        if ( ! $id ) $this->jsonError( 'Ongeldig ID.' );

        $this->companyService->delete( $id );
        $this->jsonSuccess();
    }

    public function saveBuilder(): void {
        $this->requireAdmin();
        $this->checkNonce( 'owmc_save_builder' );

        $slug = sanitize_title( $_POST['company_slug'] ?? '' );
        $json = wp_unslash( $_POST['wizard_json'] ?? '' );

        $result = $this->companyService->saveWizardJson( $slug, $json );
        if ( is_wp_error( $result ) ) {
            $this->jsonError( $result->get_error_message() );
        }
        $this->jsonSuccess();
    }

    // ── Lead ──────────────────────────────────────────────────────────────────

    public function updateLeadStatus(): void {
        $this->requireAdmin();
        $this->checkNonce( 'owmc_admin' );

        $leadId = (int) ( $_POST['lead_id'] ?? 0 );
        $status = sanitize_key( $_POST['status'] ?? '' );
        $stage  = sanitize_text_field( $_POST['pipeline_stage'] ?? '' );

        if ( ! $leadId ) $this->jsonError( 'Ongeldig lead ID.' );

        $this->leadService->updateStatus( $leadId, $status, $stage );
        $this->jsonSuccess();
    }

    // ── Contact ───────────────────────────────────────────────────────────────

    public function updateContactStage(): void {
        $this->requireAdmin();
        $this->checkNonce( 'owmc_admin' );

        $contactId = (int) ( $_POST['contact_id'] ?? 0 );
        $stage     = sanitize_text_field( $_POST['stage'] ?? '' );

        if ( ! $contactId ) $this->jsonError( 'Ongeldig contact ID.' );

        $this->contactService->updatePipelineStage( $contactId, $stage );
        $this->jsonSuccess();
    }

    public function saveContactNote(): void {
        $this->requireAdmin();
        $this->checkNonce( 'owmc_admin' );

        $contactId = (int) ( $_POST['contact_id'] ?? 0 );
        $note      = wp_kses_post( $_POST['note'] ?? '' );

        if ( ! $contactId ) $this->jsonError( 'Ongeldig contact ID.' );

        $this->contactService->saveNote( $contactId, $note );
        $this->jsonSuccess();
    }

    // ── Email preview ─────────────────────────────────────────────────────────

    public function emailPreview(): void {
        $this->requireAdmin();
        $this->checkNonce( 'owmc_admin' );

        global $owmc_email_service;
        $template = sanitize_key( $_POST['template'] ?? 'lead-notification' );

        // Build sample vars for preview
        $vars = [
            'company'   => (object) [ 'name' => 'Demo Bedrijf', 'email' => 'info@demo.be', 'phone' => '+32 123 45 67' ],
            'name'      => 'Jan Janssen',
            'email'     => 'jan@voorbeeld.be',
            'tel'       => '+32 470 12 34 56',
            'diensten'  => 'Afbraak, Riolering',
            'page_url'  => home_url(),
            'price_data'=> [ 'subtotal' => 1250, 'btw' => 262.50, 'total' => 1512.50, 'indicative' => true ],
        ];

        // Get service from plugin container
        $plugin = \OWMC\Core\Plugin::getInstance();
        $service = $plugin->getContainer()->make( \OWMC\Services\EmailService::class );

        wp_send_json_success( [ 'html' => $service->preview( $template, $vars ) ] );
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    public function saveSettings(): void {
        $this->requireAdmin();
        $this->checkNonce( 'owmc_save_settings' );

        $opt = get_option( 'owmc_global', [] );
        if ( ! is_array( $opt ) ) $opt = [];

        $opt['notify_email'] = sanitize_email( $_POST['notify_email'] ?? '' );

        if ( ! empty( $_POST['rotate_token'] ) ) {
            $opt['public_token'] = \OWMC\Core\Installer::randomToken();
        } elseif ( empty( $opt['public_token'] ) ) {
            $opt['public_token'] = \OWMC\Core\Installer::randomToken();
        }

        $opt['debug_mode'] = ! empty( $_POST['debug_mode'] ) ? 1 : 0;

        // Sync debug constant to option (loaded at plugin boot)
        if ( $opt['debug_mode'] ) {
            if ( ! defined( 'OWMC_DEBUG' ) ) define( 'OWMC_DEBUG', true );
        }

        update_option( 'owmc_global', $opt );
        $this->jsonSuccess();
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    private function requireAdmin(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( [ 'message' => 'Geen toegang.' ], 403 );
        }
    }

    private function checkNonce( string $action ): void {
        $nonce = sanitize_text_field( $_POST['_nonce'] ?? $_POST['_wpnonce'] ?? '' );
        if ( ! wp_verify_nonce( $nonce, $action ) ) {
            wp_send_json_error( [ 'message' => 'Verificatiefout.' ], 403 );
        }
    }

    private function jsonSuccess( array $data = [] ): void {
        wp_send_json_success( $data );
    }

    private function jsonError( string $msg, int $code = 400 ): void {
        wp_send_json_error( [ 'message' => $msg ], $code );
    }
}
