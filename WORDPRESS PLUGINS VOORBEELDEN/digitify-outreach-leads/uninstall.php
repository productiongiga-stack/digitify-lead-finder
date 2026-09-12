<?php
if (!defined('WP_UNINSTALL_PLUGIN')) exit;

global $wpdb;
$tables = [
    $wpdb->prefix . 'dol_leads',
    $wpdb->prefix . 'dol_activity_log',
    $wpdb->prefix . 'dol_templates',
    $wpdb->prefix . 'dol_messages',
];
foreach ($tables as $t) {
    $wpdb->query("DROP TABLE IF EXISTS {$t}");
}
// Clean options
delete_option('dol_settings');
