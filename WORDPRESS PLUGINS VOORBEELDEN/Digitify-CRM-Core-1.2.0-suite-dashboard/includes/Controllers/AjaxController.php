<?php
namespace DCRM\Controllers;

use DCRM\Services\ContactService;

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * AJAX handlers for the Contacts page.
 */
class AjaxController {
    /** @var ContactService */
    private $contactService;

    public function __construct( ContactService $contactService ) {
        $this->contactService = $contactService;
    }

    public function register() {
        add_action( 'wp_ajax_dcrm_update_contact_stage', [ $this, 'updateContactStage' ] );
        add_action( 'wp_ajax_dcrm_save_contact_note',    [ $this, 'saveContactNote' ] );
    }

    private function requireAdmin() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( [ 'message' => 'Geen toegang.' ], 403 );
        }
    }

    private function checkNonce() {
        $nonce = isset( $_POST['_nonce'] ) ? $_POST['_nonce'] : '';
        if ( ! wp_verify_nonce( $nonce, 'dcrm_admin' ) ) {
            wp_send_json_error( [ 'message' => 'Ongeldige nonce.' ], 403 );
        }
    }

    public function updateContactStage() {
        $this->requireAdmin();
        $this->checkNonce();

        $contactId = (int) ( isset( $_POST['contact_id'] ) ? $_POST['contact_id'] : 0 );
        $stage     = sanitize_text_field( isset( $_POST['stage'] ) ? $_POST['stage'] : '' );

        if ( ! $contactId ) {
            wp_send_json_error( [ 'message' => 'Ongeldig contact ID.' ], 400 );
        }

        $this->contactService->updatePipelineStage( $contactId, $stage );
        wp_send_json_success();
    }

    public function saveContactNote() {
        $this->requireAdmin();
        $this->checkNonce();

        $contactId = (int) ( isset( $_POST['contact_id'] ) ? $_POST['contact_id'] : 0 );
        $note      = wp_kses_post( isset( $_POST['note'] ) ? $_POST['note'] : '' );

        if ( ! $contactId ) {
            wp_send_json_error( [ 'message' => 'Ongeldig contact ID.' ], 400 );
        }

        $this->contactService->saveNote( $contactId, $note );
        wp_send_json_success();
    }
}
