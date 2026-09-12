<?php
namespace DCRM\Admin;

if ( ! defined( 'ABSPATH' ) ) exit;

class EventsPage {

    public function render(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Geen toegang.' );
        }

        global $wpdb;
        $contactsTable = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_CONTACTS') ? DCRM_CORE_TABLE_CONTACTS : 'digitify_crm_contacts' );
        $eventsTable   = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_EVENTS') ? DCRM_CORE_TABLE_EVENTS : 'digitify_crm_events' );

        $page = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
        $per  = 30;
        $off  = ( $page - 1 ) * $per;

        $q = sanitize_text_field( $_GET['q'] ?? '' );
        $type = sanitize_key( $_GET['type'] ?? '' );
        $source = sanitize_key( $_GET['source'] ?? '' );

        $where = 'WHERE 1=1';
        $params = [];

        if ( $q ) {
            $like = '%' . $wpdb->esc_like( $q ) . '%';
            $where .= ' AND (c.email LIKE %s OR c.name LIKE %s OR e.summary LIKE %s OR e.event_type LIKE %s)';
            array_push( $params, $like, $like, $like, $like );
        }
        if ( $type ) {
            $where .= ' AND e.event_type = %s';
            $params[] = $type;
        }
        if ( $source ) {
            $where .= ' AND e.source_app = %s';
            $params[] = $source;
        }

        $baseSql = "FROM $eventsTable e LEFT JOIN $contactsTable c ON c.id = e.contact_id $where";

        $countSql = "SELECT COUNT(*) $baseSql";
        $total = (int) ( empty($params) ? $wpdb->get_var($countSql) : $wpdb->get_var( $wpdb->prepare($countSql, $params) ) );

        $itemsSql = "SELECT e.*, c.email, c.name $baseSql ORDER BY e.occurred_at DESC, e.created_at DESC LIMIT %d OFFSET %d";
        $itemsParams = array_merge( $params, [ $per, $off ] );
        $items = $wpdb->get_results( $wpdb->prepare( $itemsSql, $itemsParams ) ) ?: [];

        $pages = max( 1, (int) ceil( $total / $per ) );

        include DCRM_CORE_DIR . 'admin/views/events.php';
    }
}
