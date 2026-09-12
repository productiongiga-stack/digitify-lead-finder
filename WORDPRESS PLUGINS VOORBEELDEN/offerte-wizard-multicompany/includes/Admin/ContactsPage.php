<?php
namespace OWMC\Admin;

use OWMC\Core\Container;
use OWMC\Services\ContactService;
use OWMC\Repositories\EmailLogRepository;

class ContactsPage {

    private ContactService     $contactService;
    private EmailLogRepository $emailLogs;

    public function __construct( Container $c ) {
        $this->contactService = $c->make( ContactService::class );
        $this->emailLogs      = $c->make( EmailLogRepository::class );
    }

    public function render(): void {
        $detailId = (int) ( $_GET['id'] ?? 0 );

        if ( $detailId ) {
            $this->renderDetail( $detailId );
        } else {
            $this->renderList();
        }
    }

    private function renderList(): void {
        $page    = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
        $filters = [
            'q'              => sanitize_text_field( $_GET['q']              ?? '' ),
            'status'         => sanitize_key( $_GET['status']                ?? '' ),
            'pipeline_stage' => sanitize_text_field( $_GET['pipeline_stage'] ?? '' ),
        ];

        $result = $this->contactService->paginatedList( 25, $page, $filters );
        $nonce  = wp_create_nonce( 'owmc_admin' );

        include OWMC_DIR . 'admin/views/contacts.php';
    }

    private function renderDetail( int $contactId ): void {
        $contact  = $this->contactService->findById( $contactId );
        if ( ! $contact ) {
            wp_die( 'Contact niet gevonden.' );
        }

        $timeline  = $this->contactService->getTimeline( $contactId );
        $tags      = $this->contactService->getTags( $contactId );
        $emails    = $this->emailLogs->recentForContact( $contactId );
        $nonce     = wp_create_nonce( 'owmc_admin' );

        include OWMC_DIR . 'admin/views/contact-detail.php';
    }
}
