<?php
if ( ! defined('ABSPATH') ) exit;

/**
 * Digitify Agenda Pro integration: listen for Digitify Offerte Maker submissions
 * and create an agenda item on the submission day.
 *
 * Requirements:
 * - Date = day of submission
 * - Title = "Lange offerte"
 * - Type = "Offerte"  (type_key = 'quote' in DAP)
 * - Deduplicate using (source_app, source_id)
 */
add_action( 'digitify_offerte_ingediend', 'dap_handle_digitify_offerte_ingediend', 10, 1 );

function dap_handle_digitify_offerte_ingediend( $payload ) {
    if ( empty( $payload ) ) return;
    if ( is_object( $payload ) ) $payload = (array) $payload;
    if ( ! is_array( $payload ) ) return;

    global $wpdb;

    $tbl_items = $wpdb->prefix . 'dap_agenda_items';
    $tbl_types = $wpdb->prefix . 'dap_types';

    $source_app = 'digitify-offerte-maker';
    $source_id  = '';
    if ( ! empty( $payload['ref'] ) ) $source_id = (string) $payload['ref'];
    if ( empty( $source_id ) && ! empty( $payload['offerte_id'] ) ) $source_id = (string) $payload['offerte_id'];
    if ( empty( $source_id ) ) $source_id = wp_generate_uuid4();

    // Determine timestamp (mysql datetime)
    $submitted_at = '';
    if ( ! empty( $payload['submitted_at'] ) && is_string( $payload['submitted_at'] ) ) {
        $submitted_at = (string) $payload['submitted_at'];
    }
    if ( empty( $submitted_at ) ) {
        $submitted_at = current_time('mysql');
    }

    // Force same-day booking (keep time if provided)
    $start_at = $submitted_at;

    // Resolve type color from dap_types
    $color = '#f97316';
    $type_key = 'quote';
    $type_color = $wpdb->get_var( $wpdb->prepare("SELECT color FROM $tbl_types WHERE type_key=%s", $type_key ) );
    if ( ! empty( $type_color ) ) $color = (string) $type_color;

    // Deduplicate by (source_app, source_id) if columns exist
    $cols = $wpdb->get_results( "SHOW COLUMNS FROM $tbl_items", ARRAY_A );
    $colnames = array_map( fn($c)=> $c['Field'], (array) $cols );
    $has_source = in_array( 'source_app', $colnames, true ) && in_array( 'source_id', $colnames, true );

    if ( $has_source ) {
        $existing_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $tbl_items WHERE source_app=%s AND source_id=%s LIMIT 1",
            $source_app, $source_id
        ) );
        if ( $existing_id > 0 ) {
            return; // already created
        }
    }

    $now = current_time('mysql');

    $data = [
        'title'       => 'Lange offerte',
        'description' => null,
        'start_at'    => $start_at,
        'end_at'      => null,
        'type_key'    => $type_key,
        'color'       => $color,
        'status'      => 'open',
        'contact_email' => null,
        'created_at'  => $now,
        'updated_at'  => $now,
    ];

    if ( $has_source ) {
        $data['source_app'] = $source_app;
        $data['source_id']  = $source_id;
    }

    $wpdb->insert( $tbl_items, $data );
}
