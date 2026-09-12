<?php
namespace DCRM\Admin;

use DCRM\Repositories\EmailLogRepository;

if ( ! defined( 'ABSPATH' ) ) exit;

class DashboardPage {

    /**
     * Build a suite apps list for the central dashboard.
     *
     * Other plugins can extend via filter: digitify_suite_apps
     */
    private function get_suite_apps(): array {
        $apps = [
            [
                'key'      => 'crm',
                'name'     => 'CRM Core',
                'active'   => true,
                'icon'     => 'dashicons-groups',
                'links'    => [
                    [ 'label' => 'Dashboard', 'url' => admin_url('admin.php?page=dcrm_dashboard') ],
                    [ 'label' => 'Contacten',  'url' => admin_url('admin.php?page=dcrm_contacts') ],
                    [ 'label' => 'Events',     'url' => admin_url('admin.php?page=dcrm_events') ],
                ],
            ],
            [
                'key'    => 'agenda',
                'name'   => 'Agenda Pro',
                'active' => defined('DAP_VERSION'),
                'icon'   => 'dashicons-calendar',
                'links'  => [
                    [ 'label' => 'Weekagenda', 'url' => admin_url('admin.php?page=digitify-agenda-pro&tab=week') ],
                    [ 'label' => "To-do's",   'url' => admin_url('admin.php?page=digitify-agenda-pro&tab=todos') ],
                ],
            ],
            [
                'key'    => 'offerte',
                'name'   => 'Offerte Maker',
                'active' => defined('DIGITIFY_OFFERTE_VER'),
                'icon'   => 'dashicons-money-alt',
                'links'  => [
                    [ 'label' => 'Nieuwe offerte',    'url' => admin_url('admin.php?page=digitify-offerte') ],
                    [ 'label' => 'Offertes beheren',  'url' => admin_url('admin.php?page=digitify-offertes-admin') ],
                    [ 'label' => 'Instellingen',      'url' => admin_url('admin.php?page=digitify-instellingen') ],
                ],
            ],
            [
                'key'    => 'wizard',
                'name'   => 'Offerte Wizard (Multi)',
                'active' => defined('OWMC_VERSION'),
                'icon'   => 'dashicons-feedback',
                'links'  => [
                    [ 'label' => 'Dashboard',    'url' => admin_url('admin.php?page=owmc') ],
                    [ 'label' => 'Leads',        'url' => admin_url('admin.php?page=owmc_leads') ],
                    [ 'label' => 'Bedrijven',    'url' => admin_url('admin.php?page=owmc_companies') ],
                    [ 'label' => 'Builder',      'url' => admin_url('admin.php?page=owmc_builder') ],
                ],
            ],
            [
                'key'    => 'booking',
                'name'   => 'Booking',
                'active' => defined('DIGITIFY_BOOKING_VERSION'),
                'icon'   => 'dashicons-clock',
                'links'  => [
                    [ 'label' => 'Boekingen',       'url' => admin_url('admin.php?page=digitify-booking') ],
                    [ 'label' => 'Agenda',          'url' => admin_url('admin.php?page=digitify-booking-calendar') ],
                    [ 'label' => 'Evenementtypen',  'url' => admin_url('admin.php?page=digitify-booking-events') ],
                    [ 'label' => 'Instellingen',    'url' => admin_url('admin.php?page=digitify-booking-settings') ],
                ],
            ],
            [
                'key'    => 'chatbot',
                'name'   => 'Chatbot',
                'active' => defined('SCB_PLUGIN_FILE') || defined('SCB_VERSION'),
                'icon'   => 'dashicons-format-chat',
                'links'  => [
                    [ 'label' => 'Chats',        'url' => admin_url('admin.php?page=scb-dashboard') ],
                    [ 'label' => 'Insluiten',    'url' => admin_url('admin.php?page=scb-embed') ],
                    [ 'label' => 'Instellingen', 'url' => admin_url('admin.php?page=scb-settings') ],
                ],
            ],
            [
                'key'    => 'outreach',
                'name'   => 'Outreach Leads',
                'active' => defined('DOL_VERSION'),
                'icon'   => 'dashicons-megaphone',
                'links'  => [
                    [ 'label' => 'Dashboard',    'url' => admin_url('admin.php?page=dol_dashboard') ],
                    [ 'label' => 'Leads',        'url' => admin_url('admin.php?page=dol_leads') ],
                    [ 'label' => 'Templates',    'url' => admin_url('admin.php?page=dol_templates') ],
                    [ 'label' => 'Logs',         'url' => admin_url('admin.php?page=dol_logs') ],
                ],
            ],
            [
                'key'    => 'reviews',
                'name'   => 'Reviews',
                'active' => defined('DRV_REVIEWS_VERSION'),
                'icon'   => 'dashicons-star-filled',
                'links'  => [
                    [ 'label' => 'Dashboard',    'url' => admin_url('admin.php?page=digitify-reviews') ],
                    [ 'label' => 'Aanvragen',    'url' => admin_url('admin.php?page=digitify-reviews-requests') ],
                    [ 'label' => 'Templates',    'url' => admin_url('admin.php?page=digitify-reviews-templates') ],
                    [ 'label' => 'Logs',         'url' => admin_url('admin.php?page=digitify-reviews-logs') ],
                ],
            ],
            [
                'key'    => 'tracker',
                'name'   => 'Site Tracker',
                'active' => defined('STP_VERSION'),
                'icon'   => 'dashicons-chart-area',
                'links'  => [
                    [ 'label' => 'Dashboard', 'url' => admin_url('admin.php?page=stp') ],
                    [ 'label' => 'Events',    'url' => admin_url('admin.php?page=stp-events') ],
                    [ 'label' => 'Visitors',  'url' => admin_url('admin.php?page=stp-visitors') ],
                    [ 'label' => 'Settings',  'url' => admin_url('admin.php?page=stp-settings') ],
                ],
            ],
        ];

        return apply_filters( 'digitify_suite_apps', $apps );
    }

    /**
     * Build KPI data per app (best-effort).
     * Other plugins can extend via filter: digitify_suite_kpis
     */
    private function get_suite_kpis(): array {
        global $wpdb;

        $kpis = [];

        // Agenda Pro
        $tbl_items = $wpdb->prefix . 'dap_agenda_items';
        $tbl_todos = $wpdb->prefix . 'dap_todos';
        if ( defined('DAP_VERSION') && $wpdb->get_var( $wpdb->prepare("SHOW TABLES LIKE %s", $tbl_items) ) === $tbl_items ) {
            $kpis['agenda'] = [
                'agenda_7d' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_items} WHERE start_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)" ),
                'todos_open' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_todos} WHERE status = 'open'" ),
            ];
        }

        // Offerte Maker
        if ( defined('DIGITIFY_OFFERTE_VER') && function_exists('digitify_get_quotes') ) {
            $quotes = digitify_get_quotes();
            $total = is_array($quotes) ? count($quotes) : 0;
            $cut = strtotime('-7 days');
            $last7 = 0;
            if ( is_array($quotes) ) {
                foreach ( $quotes as $q ) {
                    $t = ! empty($q['savedAt']) ? strtotime((string)$q['savedAt']) : 0;
                    if ( $t && $t >= $cut ) $last7++;
                }
            }
            $kpis['offerte'] = [
                'quotes_total' => (int) $total,
                'quotes_7d'    => (int) $last7,
            ];
        }

        // Booking
        $tbl_bookings = $wpdb->prefix . 'digitify_bookings';
        if ( defined('DIGITIFY_BOOKING_VERSION') && $wpdb->get_var( $wpdb->prepare("SHOW TABLES LIKE %s", $tbl_bookings) ) === $tbl_bookings ) {
            $kpis['booking'] = [
                'pending'   => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_bookings} WHERE status='pending'" ),
                'confirmed' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_bookings} WHERE status='confirmed'" ),
                'week'      => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_bookings} WHERE start_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)" ),
            ];
        }

        // Chatbot
        $tbl_sessions = $wpdb->prefix . 'scb_sessions';
        if ( (defined('SCB_PLUGIN_FILE') || defined('SCB_VERSION')) && $wpdb->get_var( $wpdb->prepare("SHOW TABLES LIKE %s", $tbl_sessions) ) === $tbl_sessions ) {
            $kpis['chatbot'] = [
                'open'   => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_sessions} WHERE status='open'" ),
                'unread' => (int) $wpdb->get_var( "SELECT SUM(unread_admin) FROM {$tbl_sessions} WHERE status='open'" ),
            ];
        }

        // Outreach Leads
        $tbl_leads = $wpdb->prefix . 'dol_leads';
        if ( defined('DOL_VERSION') && $wpdb->get_var( $wpdb->prepare("SHOW TABLES LIKE %s", $tbl_leads) ) === $tbl_leads ) {
            $kpis['outreach'] = [
                'leads'     => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_leads}" ),
                'nieuw'     => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_leads} WHERE status='nieuw'" ),
                'contacted' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_leads} WHERE last_contacted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)" ),
            ];
        }

        // Reviews
        $tbl_req = $wpdb->prefix . 'drv_review_requests';
        if ( defined('DRV_REVIEWS_VERSION') && $wpdb->get_var( $wpdb->prepare("SHOW TABLES LIKE %s", $tbl_req) ) === $tbl_req ) {
            $kpis['reviews'] = [
                'requests' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_req}" ),
                'nieuw'    => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_req} WHERE status='nieuw'" ),
                'received_7d' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_req} WHERE received_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)" ),
            ];
        }

        // Site Tracker
        $tbl_events = $wpdb->prefix . 'stp_events';
        $tbl_vis = $wpdb->prefix . 'stp_visitors';
        if ( defined('STP_VERSION') && $wpdb->get_var( $wpdb->prepare("SHOW TABLES LIKE %s", $tbl_events) ) === $tbl_events ) {
            $kpis['tracker'] = [
                'pageviews_24h' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_events} WHERE event_type='pageview' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)" ),
                'events_24h'    => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_events} WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)" ),
                'live_5m'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_vis} WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)" ),
            ];
        }

        // Offerte Wizard (Multi)
        $tbl_owmc_leads = $wpdb->prefix . 'owmc_leads';
        if ( defined('OWMC_VERSION') && $wpdb->get_var( $wpdb->prepare("SHOW TABLES LIKE %s", $tbl_owmc_leads) ) === $tbl_owmc_leads ) {
            $kpis['wizard'] = [
                'leads'  => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_owmc_leads}" ),
                'leads_7d' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tbl_owmc_leads} WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)" ),
            ];
        }

        return apply_filters( 'digitify_suite_kpis', $kpis );
    }

    public function render(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Geen toegang.' );
        }

        global $wpdb;

        $contactsTable = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_CONTACTS') ? DCRM_CORE_TABLE_CONTACTS : 'digitify_crm_contacts' );
        $eventsTable   = $wpdb->prefix . ( defined('DCRM_CORE_TABLE_EVENTS') ? DCRM_CORE_TABLE_EVENTS : 'digitify_crm_events' );

        $totalContacts = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $contactsTable" );
        $active7d      = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $contactsTable WHERE last_activity_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)" );
        $events7d      = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $eventsTable WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)" );

        $emailRepo  = new EmailLogRepository();
        $openRate30 = $emailRepo->openRate( 0, 30 );

        $recentEvents = $wpdb->get_results( "SELECT e.*, c.email, c.name FROM $eventsTable e LEFT JOIN $contactsTable c ON c.id = e.contact_id ORDER BY e.occurred_at DESC, e.created_at DESC LIMIT 12" ) ?: [];

        $suiteApps = $this->get_suite_apps();
        $suiteKpis = $this->get_suite_kpis();

        include DCRM_CORE_DIR . 'admin/views/dashboard.php';
    }
}
