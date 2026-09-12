<?php
namespace OWMC\Services;

use OWMC\Repositories\ContactRepository;
use OWMC\Events\EventDispatcher;
use OWMC\Events\Events\ContactCreated;

class ContactService {

    public function __construct(
        private readonly ContactRepository $repo,
        private readonly EventDispatcher   $dispatcher
    ) {}

    /**
     * CRM dedupe flow: find by email or create new contact.
     * Updates mutable fields (name, tel) on match.
     *
     * @return int contact_id
     */
    public function findOrCreateByEmail( string $email, array $data = [], ?int $companyId = null ): int {
        $email = sanitize_email( $email );
        if ( ! is_email( $email ) ) return 0;

        $existing = $this->repo->findByEmail( $email );
        $isNew    = null === $existing;

        $safeData = $this->sanitizeContactData( $data );
        if ( $companyId ) $safeData['company_id'] = $companyId;

        $contactId = $this->repo->findOrCreate( $email, $safeData );

        if ( $isNew ) {
            $this->repo->logEvent( $contactId, 'contact_created', 'Contact aangemaakt via wizard', [
                'source' => $safeData['source'] ?? 'wizard',
            ] );
            $this->dispatcher->dispatch( new ContactCreated(
                [ 'email' => $email ],
                companyId: $companyId,
                entityId: $contactId
            ) );
        }

        return $contactId;
    }

    public function logEvent( int $contactId, string $type, string $summary, array $meta = [] ): void {
        $userId = get_current_user_id() ?: null;
        $this->repo->logEvent( $contactId, $type, $summary, $meta, $userId );
    }

    public function attachTag( int $contactId, int $tagId ): void {
        $this->repo->attachTag( $contactId, $tagId );
        $this->logEvent( $contactId, 'tag_attached', 'Tag toegevoegd', [ 'tag_id' => $tagId ] );
    }

    public function detachTag( int $contactId, int $tagId ): void {
        $this->repo->detachTag( $contactId, $tagId );
    }

    public function updateStatus( int $contactId, string $status ): void {
        $allowed = [ 'active', 'inactive', 'blocked' ];
        if ( ! in_array( $status, $allowed, true ) ) return;
        $this->repo->updateStatus( $contactId, $status );
        $this->logEvent( $contactId, 'status_changed', "Status gewijzigd naar $status" );
    }

    public function updatePipelineStage( int $contactId, string $stage ): void {
        $this->repo->updatePipelineStage( $contactId, $stage );
        $this->logEvent( $contactId, 'pipeline_moved', "Pipeline verschoven naar $stage" );
    }

    public function getTimeline( int $contactId ): array {
        return $this->repo->getTimeline( $contactId );
    }

    public function getTags( int $contactId ): array {
        return $this->repo->getTags( $contactId );
    }

    public function findById( int $id ): ?\stdClass {
        return $this->repo->findById( $id );
    }

    public function findByEmail( string $email ): ?\stdClass {
        return $this->repo->findByEmail( sanitize_email( $email ) );
    }

    public function paginatedList( int $perPage = 25, int $page = 1, array $filters = [] ): array {
        return $this->repo->paginatedList( $perPage, $page, $filters );
    }

    public function saveNote( int $contactId, string $note ): void {
        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'owmc_contacts',
            [ 'notes' => wp_kses_post( $note ) ],
            [ 'id'    => $contactId ]
        );
        $this->logEvent( $contactId, 'note_added', 'Notitie bijgewerkt' );
    }

    private function sanitizeContactData( array $data ): array {
        $safe = [];
        if ( isset( $data['name'] ) )   $safe['name']   = sanitize_text_field( $data['name'] );
        if ( isset( $data['tel'] ) )    $safe['tel']    = sanitize_text_field( $data['tel'] );
        if ( isset( $data['source'] ) ) $safe['source'] = sanitize_key( $data['source'] );
        if ( isset( $data['status'] ) ) $safe['status'] = sanitize_key( $data['status'] );
        return $safe;
    }
}
