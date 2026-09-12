<?php
namespace DCRM\Repositories;

class ContactRepository extends BaseRepository {

    private function normalizeEmail( $email ): string {
        if ( function_exists( '\\digitify_crm_normalize_email' ) ) {
            return \digitify_crm_normalize_email( (string) $email );
        }
        $email = trim( (string) $email );
        $email = strtolower( $email );
        return sanitize_email( $email );
    }

    protected function tableName() { return defined('DCRM_CORE_TABLE_CONTACTS') ? DCRM_CORE_TABLE_CONTACTS : 'digitify_crm_contacts'; }

    /** @return \stdClass|null */
    public function findById( $id ) {
        $id = (int) $id;
        if ( ! $id ) return null;
        $row = $this->db->get_row(
            $this->db->prepare( "SELECT * FROM {$this->table()} WHERE id = %d LIMIT 1", $id )
        );
        return $row ?: null;
    }

    /** @return \stdClass|null */
    public function findByEmail( $email ) {
        $email = $this->normalizeEmail( $email );
        $row = $this->db->get_row(
            $this->db->prepare( "SELECT * FROM {$this->table()} WHERE email = %s LIMIT 1", $email )
        );
        return $row ?: null;
    }

    /**
     * Dedupe-safe upsert: finds existing contact or creates new one.
     * Returns the contact id.
     */
    /** @return int */
    public function findOrCreate( $email, array $data = [] ) {
        $email = $this->normalizeEmail( $email );
        $existing = $this->findByEmail( $email );
        if ( $existing ) {
            $updateData = array_filter( $data, function( $v ) { return $v !== null && $v !== ''; } );
            if ( ! empty( $updateData ) ) {
                $updateData['updated_at'] = current_time( 'mysql' );
                $this->update( $updateData, [ 'id' => (int) $existing->id ] );
            }
            return (int) $existing->id;
        }

        $insertData = array_merge( [
            'email'      => $email,
            'created_at' => current_time( 'mysql' ),
        ], $data );

        return $this->insert( $insertData );
    }

    /** @return int */
    public function logEvent( $contactId, $type, $summary, array $meta = [], $createdBy = null, $occurredAt = null, $sourceApp = null ) {
        global $wpdb;
        $table = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_EVENTS') ? DCRM_CORE_TABLE_EVENTS : 'digitify_crm_events' );

        $wpdb->insert( $table, [
            'contact_id'  => (int) $contactId,
            'event_type'  => sanitize_key( (string) $type ),
            'summary'     => sanitize_text_field( (string) $summary ),
            'source_app'  => $sourceApp ? sanitize_key( (string) $sourceApp ) : null,
            'meta'        => wp_json_encode( $meta, JSON_UNESCAPED_UNICODE ),
            'created_by'  => $createdBy,
            'occurred_at' => $occurredAt ? $occurredAt : current_time( 'mysql' ),
            'created_at'  => current_time( 'mysql' ),
        ] );

        // Keep last activity up to date.
        $this->update( [ 'last_activity_at' => current_time( 'mysql' ) ], [ 'id' => (int) $contactId ] );

        return (int) $wpdb->insert_id;
    }

    /** @return \stdClass[] */
    public function getTimeline( $contactId ) {
        global $wpdb;
        $table = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_EVENTS') ? DCRM_CORE_TABLE_EVENTS : 'digitify_crm_events' );

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE contact_id = %d ORDER BY occurred_at DESC, created_at DESC",
                $contactId
            )
        ) ?: [];
    }

    public function attachTag( $contactId, $tagId ) {
        global $wpdb;
        $rel = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_TAG_REL') ? DCRM_CORE_TABLE_TAG_REL : 'digitify_crm_tag_relations' );
        $wpdb->replace( $rel, [
            'contact_id' => $contactId,
            'tag_id'     => $tagId,
        ] );
    }

    public function detachTag( $contactId, $tagId ) {
        global $wpdb;
        $rel = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_TAG_REL') ? DCRM_CORE_TABLE_TAG_REL : 'digitify_crm_tag_relations' );
        $wpdb->delete( $rel, [
            'contact_id' => $contactId,
            'tag_id'     => $tagId,
        ] );
    }

    /** @return \stdClass[] */
    public function getTags( $contactId ) {
        global $wpdb;
        $tags = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_TAGS') ? DCRM_CORE_TABLE_TAGS : 'digitify_crm_tags' );
        $rel  = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_TAG_REL') ? DCRM_CORE_TABLE_TAG_REL : 'digitify_crm_tag_relations' );

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT t.* FROM {$tags} t
                 INNER JOIN {$rel} r ON r.tag_id = t.id
                 WHERE r.contact_id = %d",
                $contactId
            )
        ) ?: [];
    }

    public function updateStatus( $contactId, $status ) {
        $this->update( [ 'status' => $status, 'updated_at' => current_time('mysql') ], [ 'id' => $contactId ] );
    }

    public function updatePipelineStage( $contactId, $stage ) {
        $this->update( [ 'pipeline_stage' => $stage, 'updated_at' => current_time('mysql') ], [ 'id' => $contactId ] );
    }

    public function updateNotes( $contactId, $note ) {
        $this->update( [ 'notes' => wp_kses_post( $note ), 'updated_at' => current_time('mysql') ], [ 'id' => (int) $contactId ] );
    }

    /** @return \stdClass[] */
    public function search( $q, $limit = 25, $offset = 0 ) {
        $like = '%' . $this->db->esc_like( $q ) . '%';
        return $this->db->get_results(
            $this->db->prepare(
                "SELECT * FROM {$this->table()} WHERE email LIKE %s OR name LIKE %s OR tel LIKE %s ORDER BY created_at DESC LIMIT %d OFFSET %d",
                $like, $like, $like, $limit, $offset
            )
        ) ?: [];
    }

    /** @return array{items:array,total:int,page:int,perPage:int,pages:int} */
    public function paginatedList( $perPage = 25, $page = 1, array $filters = [] ) {
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

        $sql = "SELECT * FROM {$this->table()} $where ORDER BY COALESCE(last_activity_at, created_at) DESC";
        return $this->paginate( $sql, $params, $perPage, $page );
    }
}
