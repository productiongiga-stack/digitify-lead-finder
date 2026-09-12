<?php
namespace OWMC\Repositories;

/**
 * Base repository — wraps $wpdb with type-safe helpers.
 * All child repos work against a single table, always filtered by company_id
 * where applicable to prevent cross-tenant data leaks.
 */
abstract class BaseRepository {

    protected \wpdb $db;

    public function __construct() {
        global $wpdb;
        $this->db = $wpdb;
    }

    abstract protected function tableName(): string;

    protected function table(): string {
        return $this->db->prefix . $this->tableName();
    }

    // ── Generic CRUD ──────────────────────────────────────────────────────────

    public function findById( int $id ): ?\stdClass {
        $row = $this->db->get_row(
            $this->db->prepare( "SELECT * FROM {$this->table()} WHERE id = %d LIMIT 1", $id )
        );
        return $row ?: null;
    }

    /** @return \stdClass[] */
    public function all( string $orderBy = 'id DESC' ): array {
        return $this->db->get_results(
            "SELECT * FROM {$this->table()} ORDER BY $orderBy"
        ) ?: [];
    }

    public function insert( array $data ): int {
        $this->db->insert( $this->table(), $data );
        return (int) $this->db->insert_id;
    }

    public function update( array $data, array $where ): int {
        return (int) $this->db->update( $this->table(), $data, $where );
    }

    public function delete( array $where ): int {
        return (int) $this->db->delete( $this->table(), $where );
    }

    public function count( array $where = [] ): int {
        if ( empty( $where ) ) {
            return (int) $this->db->get_var( "SELECT COUNT(*) FROM {$this->table()}" );
        }
        $conditions = [];
        $values     = [];
        foreach ( $where as $col => $val ) {
            $conditions[] = "`$col` = %s";
            $values[]     = $val;
        }
        $sql = "SELECT COUNT(*) FROM {$this->table()} WHERE " . implode( ' AND ', $conditions );
        return (int) $this->db->get_var( $this->db->prepare( $sql, ...$values ) );
    }

    // ── Paginated query helper ────────────────────────────────────────────────

    protected function paginate( string $sql, array $params, int $perPage, int $page ): array {
        $offset     = max( 0, ( $page - 1 ) * $perPage );
        $countSql   = preg_replace( '/SELECT .+? FROM/i', 'SELECT COUNT(*) FROM', $sql );
        // Strip ORDER BY from count query
        $countSql   = preg_replace( '/ORDER BY.+$/i', '', $countSql );

        $total = $params
            ? (int) $this->db->get_var( $this->db->prepare( $countSql, ...$params ) )
            : (int) $this->db->get_var( $countSql );

        $pageSql = $sql . " LIMIT %d OFFSET %d";

        // NOTE: Don't pass positional arguments after an argument unpacking ("...$params").
        // This causes a fatal error on PHP 7.x (common in WordPress hosting).
        // Instead, merge and unpack once.
        if ( $params ) {
            $allParams = array_merge( $params, [ $perPage, $offset ] );
            $rows      = $this->db->get_results( $this->db->prepare( $pageSql, ...$allParams ) );
        } else {
            $rows = $this->db->get_results( $this->db->prepare( $pageSql, $perPage, $offset ) );
        }

        return [
            'items' => $rows ?: [],
            'total' => $total,
            'pages' => (int) ceil( $total / max( 1, $perPage ) ),
        ];
    }
}
