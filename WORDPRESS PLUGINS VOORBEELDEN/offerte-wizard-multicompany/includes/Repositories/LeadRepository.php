<?php
namespace OWMC\Repositories;

class LeadRepository extends BaseRepository {

    protected function tableName(): string { return 'owmc_leads'; }

    public function createLead( array $data ): int {
        return $this->insert( $data );
    }

    public function paginatedList( int $companyId = 0, string $q = '', int $perPage = 25, int $page = 1 ): array {
        $comp = $this->db->prefix . 'owmc_companies';

        $where  = 'WHERE 1=1';
        $params = [];

        if ( $companyId ) {
            $where   .= ' AND l.company_id = %d';
            $params[] = $companyId;
        }
        if ( $q !== '' ) {
            $like    = '%' . $this->db->esc_like( $q ) . '%';
            $where  .= ' AND (l.email LIKE %s OR l.name LIKE %s OR l.tel LIKE %s)';
            $params[] = $like; $params[] = $like; $params[] = $like;
        }

        $sql = "SELECT l.*, c.name AS company_name, c.slug AS company_slug
                FROM {$this->table()} l
                LEFT JOIN $comp c ON c.id = l.company_id
                $where
                ORDER BY l.created_at DESC";

        return $this->paginate( $sql, $params, $perPage, $page );
    }

    public function updateStatus( int $leadId, string $status, string $pipelineStage = '' ): void {
        $data = [ 'status' => $status ];
        if ( $pipelineStage !== '' ) {
            $data['pipeline_stage'] = $pipelineStage;
        }
        $this->update( $data, [ 'id' => $leadId ] );
    }

    /** Monthly stats for dashboard KPIs. */
    public function monthlyStats( int $companyId = 0 ): array {
        $where  = "WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())";
        $params = [];
        if ( $companyId ) {
            $where   .= ' AND company_id = %d';
            $params[] = $companyId;
        }

        $totalSql = "SELECT COUNT(*) FROM {$this->table()} $where";
        $total    = $params
            ? (int) $this->db->get_var( $this->db->prepare( $totalSql, ...$params ) )
            : (int) $this->db->get_var( $totalSql );

        $wonSql = str_replace( 'WHERE', "WHERE pipeline_stage='Gewonnen' AND", $where );
        $won    = $params
            ? (int) $this->db->get_var( $this->db->prepare( "SELECT COUNT(*) FROM {$this->table()} $wonSql", ...$params ) )
            : (int) $this->db->get_var( "SELECT COUNT(*) FROM {$this->table()} $wonSql" );

        $avgSql = "SELECT AVG(total_price) FROM {$this->table()} $where AND total_price > 0";
        $avg    = $params
            ? (float) $this->db->get_var( $this->db->prepare( $avgSql, ...$params ) )
            : (float) $this->db->get_var( $avgSql );

        return [
            'total'       => $total,
            'won'         => $won,
            'conversion'  => $total > 0 ? round( ( $won / $total ) * 100, 1 ) : 0,
            'avg_value'   => round( $avg, 2 ),
        ];
    }

    /** 7-day chart data for funnel. */
    public function dailyCount( int $days = 7, int $companyId = 0 ): array {
        $where  = $companyId ? $this->db->prepare( "WHERE company_id = %d", $companyId ) : 'WHERE 1=1';
        $sql    = "SELECT DATE(created_at) AS day, COUNT(*) AS cnt
                   FROM {$this->table()}
                   $where
                   AND created_at >= DATE_SUB(NOW(), INTERVAL %d DAY)
                   GROUP BY day ORDER BY day ASC";
        return $this->db->get_results( $this->db->prepare( $sql, $days ) ) ?: [];
    }

    public function allForCsv( int $companyId = 0 ): array {
        $comp  = $this->db->prefix . 'owmc_companies';
        $where = $companyId
            ? $this->db->prepare( 'WHERE l.company_id = %d', $companyId )
            : 'WHERE 1=1';

        $sql = "SELECT l.*, c.name AS company_name, c.slug AS company_slug
                FROM {$this->table()} l
                LEFT JOIN $comp c ON c.id = l.company_id
                $where
                ORDER BY l.created_at DESC";

        return $this->db->get_results( $sql, ARRAY_A ) ?: [];
    }
}
