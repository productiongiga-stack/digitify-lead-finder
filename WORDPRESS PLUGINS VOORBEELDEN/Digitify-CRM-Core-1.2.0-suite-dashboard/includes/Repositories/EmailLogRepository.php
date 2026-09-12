<?php
namespace DCRM\Repositories;

class EmailLogRepository extends BaseRepository {

    protected function tableName(): string { return defined('DCRM_CORE_TABLE_EMAILS') ? DCRM_CORE_TABLE_EMAILS : 'digitify_crm_email_logs'; }

    public function findByTrackId( string $trackId ): ?\stdClass {
        $row = $this->db->get_row(
            $this->db->prepare( "SELECT * FROM {$this->table()} WHERE track_id = %s LIMIT 1", $trackId )
        );
        return $row ?: null;
    }

    public function markSent( int $id ): void {
        $this->update( [ 'status' => 'sent', 'sent_at' => current_time( 'mysql' ) ], [ 'id' => $id ] );
    }

    public function markOpened( string $trackId ): void {
        $log = $this->findByTrackId( $trackId );
        if ( ! $log ) return;
        $this->update( [
            'status'     => 'opened',
            'opened_at'  => $log->opened_at ?: current_time( 'mysql' ),
            'open_count' => (int) $log->open_count + 1,
        ], [ 'id' => (int) $log->id ] );
    }

    public function markClicked( string $trackId ): void {
        $log = $this->findByTrackId( $trackId );
        if ( ! $log ) return;
        $this->update( [
            'clicked_at'  => $log->clicked_at ?: current_time( 'mysql' ),
            'click_count' => (int) $log->click_count + 1,
        ], [ 'id' => (int) $log->id ] );
    }

    public function markFailed( int $id, string $error ): void {
        $this->update( [ 'status' => 'failed', 'error_message' => $error ], [ 'id' => $id ] );
    }

    public function openRate( int $companyId = 0, int $days = 30 ): float {
        $where  = "WHERE sent_at >= DATE_SUB(NOW(), INTERVAL %d DAY) AND status != 'queued'";
        $params = [ $days ];
        if ( $companyId ) {
            $where   .= ' AND company_id = %d';
            $params[] = $companyId;
        }
        $total  = (int) $this->db->get_var( $this->db->prepare( "SELECT COUNT(*) FROM {$this->table()} $where", ...$params ) );
        $opened = (int) $this->db->get_var( $this->db->prepare( "SELECT COUNT(*) FROM {$this->table()} $where AND open_count > 0", ...$params ) );
        return $total > 0 ? round( ( $opened / $total ) * 100, 1 ) : 0.0;
    }

    /** @return \stdClass[] */
    public function recentForContact( int $contactId, int $limit = 10 ): array {
        return $this->db->get_results(
            $this->db->prepare(
                "SELECT * FROM {$this->table()} WHERE contact_id = %d ORDER BY sent_at DESC LIMIT %d",
                $contactId, $limit
            )
        ) ?: [];
    }
}
