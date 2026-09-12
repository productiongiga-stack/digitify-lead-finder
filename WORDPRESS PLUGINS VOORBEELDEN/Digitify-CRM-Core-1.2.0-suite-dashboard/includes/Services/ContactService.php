<?php
namespace DCRM\Services;

use DCRM\Repositories\ContactRepository;

if ( ! defined( 'ABSPATH' ) ) exit;

class ContactService {

    /** @var ContactRepository */
    private $repo;

    public function __construct( ContactRepository $repo ) {
        $this->repo = $repo;
    }

    /** @return array */
    public function paginatedList( $perPage = 25, $page = 1, array $filters = [] ) {
        return $this->repo->paginatedList( $perPage, $page, $filters );
    }

    /** @return \stdClass|null */
    public function findById( $contactId ) {
        return $this->repo->findById( (int) $contactId );
    }

    /** @return array */
    public function getTimeline( $contactId ) {
        return $this->repo->getTimeline( (int) $contactId );
    }

    /** @return array */
    public function getTags( $contactId ) {
        return $this->repo->getTags( (int) $contactId );
    }

    public function updatePipelineStage( $contactId, $stage ) {
        $stage = sanitize_text_field( $stage );
        $contactId = (int) $contactId;
        $this->repo->updatePipelineStage( $contactId, $stage );
        $this->repo->logEvent( $contactId, 'pipeline_moved', "Pipeline verschoven naar $stage" );
    }

    public function saveNote( $contactId, $note ) {
        $contactId = (int) $contactId;

        $this->repo->updateNotes( $contactId, $note );
        $this->repo->logEvent( $contactId, 'note_added', 'Notitie bijgewerkt' );
    }
}
