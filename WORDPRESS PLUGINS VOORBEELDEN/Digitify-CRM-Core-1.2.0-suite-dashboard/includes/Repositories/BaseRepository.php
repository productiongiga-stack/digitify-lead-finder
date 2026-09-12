<?php
namespace DCRM\Repositories;

if ( ! defined( 'ABSPATH' ) ) exit;

abstract class BaseRepository {
    /** @var \wpdb */
    protected $db;

    public function __construct() {
        global $wpdb;
        $this->db = $wpdb;
    }

    abstract protected function tableName();

    protected function table() {
        return $this->db->prefix . $this->tableName();
    }

    protected function insert( array $data ) {
        $this->db->insert( $this->table(), $data );
        return (int) $this->db->insert_id;
    }

    protected function update( array $data, array $where ) {
        $this->db->update( $this->table(), $data, $where );
    }

    protected function delete( array $where ) {
        $this->db->delete( $this->table(), $where );
    }

    /**
     * Simple paginator for admin lists.
     *
     * @param string $sqlBase SQL without LIMIT/OFFSET.
     * @param array  $params  Prepare params for $sqlBase.
     * @param int    $perPage Items per page.
     * @param int    $page    Current page (1-based).
     * @return array{items:array,total:int,page:int,perPage:int,pages:int}
     */
    protected function paginate( $sqlBase, array $params, $perPage, $page ) {
        $perPage = max( 1, (int) $perPage );
        $page    = max( 1, (int) $page );
        $offset  = ( $page - 1 ) * $perPage;

        // Count
        $countSql = "SELECT COUNT(*) FROM ( $sqlBase ) AS dcrm_count";
        $countSqlPrepared = empty( $params ) ? $countSql : $this->db->prepare( $countSql, $params );
        $total = (int) $this->db->get_var( $countSqlPrepared );

        // Items
        $itemsSql = $sqlBase . " LIMIT %d OFFSET %d";
        $itemsParams = array_merge( $params, [ $perPage, $offset ] );
        $itemsSqlPrepared = $this->db->prepare( $itemsSql, $itemsParams );
        $items = $this->db->get_results( $itemsSqlPrepared ) ?: [];

        $pages = (int) ceil( $total / $perPage );
        return [
            'items'   => $items,
            'total'   => $total,
            'page'    => $page,
            'perPage' => $perPage,
            'pages'   => max( 1, $pages ),
        ];
    }
}
