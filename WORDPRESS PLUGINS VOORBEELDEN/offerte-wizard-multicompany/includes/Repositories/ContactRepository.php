<?php
namespace OWMC\Repositories;

class ContactRepository extends BaseRepository {

    protected function tableName(): string { return 'owmc_contacts'; }

    public function findByEmail( string $email ): ?\stdClass {
        $row = $this->db->get_row(
            $this->db->prepare( "SELECT * FROM {$this->table()} WHERE email = %s LIMIT 1", $email )
        );
        return $row ?: null;
    }

    /**
     * Dedupe-safe upsert: finds existing contact or creates new one.
     * Returns the contact id.
     */
    public function findOrCreate( string $email, array $data = [] ): int {
        $existing = $this->findByEmail( $email );
        if ( $existing ) {
            // Update non-empty fields on existing record
            $updateData = array_filter( $data, fn( $v ) => $v !== null && $v !== '' );
            if ( ! empty( $updateData ) ) {
                $this->update( $updateData, [ 'id' => (int) $existing->id ] );
            }
            return (int) $existing->id;
        }

        $insertData = array_merge( [ 'email' => $email ], $data );
        return $this->insert( $insertData );
    }

    public function logEvent( int $contactId, string $type, string $summary, array $meta = [], ?int $createdBy = null ): int {
        global $wpdb;
        $wpdb->insert( $wpdb->prefix . 'owmc_contact_events', [
            'contact_id' => $contactId,
            'event_type' => $type,
            'summary'    => $summary,
            'meta'       => wp_json_encode( $meta, JSON_UNESCAPED_UNICODE ),
            'created_by' => $createdBy,
            'created_at' => current_time( 'mysql' ),
        ] );
        return (int) $wpdb->insert_id;
    }

    /** @return \stdClass[] */
    public function getTimeline( int $contactId ): array {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}owmc_contact_events WHERE contact_id = %d ORDER BY created_at DESC",
                $contactId
            )
        ) ?: [];
    }

    public function attachTag( int $contactId, int $tagId ): void {
        global $wpdb;
        $wpdb->replace( $wpdb->prefix . 'owmc_tag_relations', [
            'contact_id' => $contactId,
            'tag_id'     => $tagId,
        ] );
    }

    public function detachTag( int $contactId, int $tagId ): void {
        global $wpdb;
        $wpdb->delete( $wpdb->prefix . 'owmc_tag_relations', [
            'contact_id' => $contactId,
            'tag_id'     => $tagId,
        ] );
    }

    /** @return \stdClass[] */
    public function getTags( int $contactId ): array {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT t.* FROM {$wpdb->prefix}owmc_tags t
                 INNER JOIN {$wpdb->prefix}owmc_tag_relations r ON r.tag_id = t.id
                 WHERE r.contact_id = %d",
                $contactId
            )
        ) ?: [];
    }

    public function updateStatus( int $contactId, string $status ): void {
        $this->update( [ 'status' => $status ], [ 'id' => $contactId ] );
    }

    public function updatePipelineStage( int $contactId, string $stage ): void {
        $this->update( [ 'pipeline_stage' => $stage ], [ 'id' => $contactId ] );
    }

    /** @return \stdClass[] */
    public function search( string $q, int $limit = 25, int $offset = 0 ): array {
        $like = '%' . $this->db->esc_like( $q ) . '%';
        return $this->db->get_results(
            $this->db->prepare(
                "SELECT * FROM {$this->table()} WHERE email LIKE %s OR name LIKE %s OR tel LIKE %s ORDER BY created_at DESC LIMIT %d OFFSET %d",
                $like, $like, $like, $limit, $offset
            )
        ) ?: [];
    }

    public function paginatedList( int $perPage = 25, int $page = 1, array $filters = [] ): array {
        $where  = 'WHERE 1=1';
        $params = [];

        if ( ! empty( $filters['q'] ) ) {
            $like    = '%' . $this->db->esc_like( $filters['q'] ) . '%';
            $where  .= ' AND (email LIKE %s OR name LIKE %s)';
            $params[] = $like;
            $params[] = $like;
        }
        if ( ! empty( $filters['status'] ) ) {
            $where   .= ' AND status = %s';
            $params[] = $filters['status'];
        }
        if ( ! empty( $filters['pipeline_stage'] ) ) {
            $where   .= ' AND pipeline_stage = %s';
            $params[] = $filters['pipeline_stage'];
        }

        $sql = "SELECT * FROM {$this->table()} $where ORDER BY created_at DESC";
        return $this->paginate( $sql, $params, $perPage, $page );
    }
}
