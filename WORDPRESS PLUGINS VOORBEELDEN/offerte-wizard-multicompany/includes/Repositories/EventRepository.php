<?php
namespace OWMC\Repositories;

class EventRepository extends BaseRepository {

    protected function tableName(): string { return 'owmc_events'; }

    /** @return \stdClass[] */
    public function recentForCompany( int $companyId, int $limit = 20 ): array {
        return $this->db->get_results(
            $this->db->prepare(
                "SELECT * FROM {$this->table()} WHERE company_id = %d ORDER BY created_at DESC LIMIT %d",
                $companyId,
                $limit
            )
        ) ?: [];
    }

    /** Funnel conversion stats. */
    public function funnelStats( int $companyId = 0, int $days = 30 ): array {
        $where  = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL %d DAY)";
        $params = [ $days ];
        if ( $companyId ) {
            $where   .= ' AND company_id = %d';
            $params[] = $companyId;
        }

        $sql = "SELECT event_name, COUNT(*) AS cnt FROM {$this->table()} $where GROUP BY event_name";
        $rows = $this->db->get_results( $this->db->prepare( $sql, ...$params ) ) ?: [];

        $map = [];
        foreach ( $rows as $r ) {
            $map[ $r->event_name ] = (int) $r->cnt;
        }

        return [
            'wizard_started'  => $map['wizard_started']  ?? 0,
            'wizard_completed'=> $map['wizard_completed'] ?? 0,
            'quote_created'   => $map['quote_created']    ?? 0,
            'quote_sent'      => $map['quote_sent']       ?? 0,
            'quote_accepted'  => $map['quote_accepted']   ?? 0,
            'email_sent'      => $map['email_sent']       ?? 0,
            'email_opened'    => $map['email_opened']     ?? 0,
        ];
    }
}
