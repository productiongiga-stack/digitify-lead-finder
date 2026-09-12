<?php
/**
 * Plugin Name: Digitify CRM Core
 * Description: Centrale CRM Core voor Digitify Suite. Beheert contacten (dedupe op e-mail), events/timeline, tags en e-mail logs. Andere Digitify apps sturen events naar deze core.
 * Version: 1.2.0
 * Author: Digitify
 * Text Domain: digitify-crm-core
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'DCRM_CORE_VERSION', '1.2.0' );
define( 'DCRM_CORE_DIR', plugin_dir_path( __FILE__ ) );
define( 'DCRM_CORE_URL', plugin_dir_url( __FILE__ ) );

define( 'DCRM_CORE_TABLE_CONTACTS', 'digitify_crm_contacts' );
define( 'DCRM_CORE_TABLE_EVENTS',   'digitify_crm_events' );
define( 'DCRM_CORE_TABLE_TAGS',     'digitify_crm_tags' );
define( 'DCRM_CORE_TABLE_TAG_REL',  'digitify_crm_tag_relations' );
define( 'DCRM_CORE_TABLE_EMAILS',   'digitify_crm_email_logs' );

require_once DCRM_CORE_DIR . 'includes/Installer.php';
require_once DCRM_CORE_DIR . 'includes/Helpers.php';
require_once DCRM_CORE_DIR . 'includes/Admin/AdminMenu.php';
require_once DCRM_CORE_DIR . 'includes/Admin/ContactsPage.php';
require_once DCRM_CORE_DIR . 'includes/Admin/DashboardPage.php';
require_once DCRM_CORE_DIR . 'includes/Admin/EventsPage.php';
require_once DCRM_CORE_DIR . 'includes/Repositories/BaseRepository.php';
require_once DCRM_CORE_DIR . 'includes/Repositories/ContactRepository.php';
require_once DCRM_CORE_DIR . 'includes/Repositories/EmailLogRepository.php';
require_once DCRM_CORE_DIR . 'includes/Services/ContactService.php';
require_once DCRM_CORE_DIR . 'includes/Controllers/AjaxController.php';
require_once DCRM_CORE_DIR . 'includes/Controllers/TrackingController.php';

register_activation_hook( __FILE__, [ '\DCRM\Installer', 'activate' ] );

add_action( 'plugins_loaded', function() {
    if ( is_admin() ) {
        ( new \DCRM\Admin\AdminMenu() )->register();

        ( new \DCRM\Controllers\AjaxController(
            new \DCRM\Services\ContactService(
                new \DCRM\Repositories\ContactRepository()
            )
        ) )->register();

        add_action( 'admin_enqueue_scripts', function() {
            if ( ! isset( $_GET['page'] ) ) return;
            $page = sanitize_key( $_GET['page'] );
            if ( strpos( $page, 'dcrm_' ) !== 0 ) return;

            wp_enqueue_style( 'dcrm-core-admin', DCRM_CORE_URL . 'assets/css/admin.css', [], DCRM_CORE_VERSION );
            wp_enqueue_script( 'dcrm-core-admin', DCRM_CORE_URL . 'assets/js/admin.js', [], DCRM_CORE_VERSION, true );

            wp_localize_script( 'dcrm-core-admin', 'DCRM_Admin', [
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'nonce'   => wp_create_nonce( 'dcrm_admin' ),
            ] );
        } );
    }

    // Public tracking endpoints (open/click) for HTML mails.
    ( new \DCRM\Controllers\TrackingController(
        new \DCRM\Repositories\EmailLogRepository(),
        new \DCRM\Repositories\ContactRepository()
    ) )->register();
} );

/**
 * Public API: log een event in de centrale CRM op basis van e-mail.
 *
 * @param string      $email
 * @param string      $event_type  bv. booking_created, quote_sent, chat_started
 * @param array       $meta        vrije meta (JSON)
 * @param string|null $summary     korte omschrijving (optioneel)
 * @param string|null $occurred_at mysql datetime (optioneel)
 * @param string|null $source_app  bv. booking/offerte/chatbot/outreach/tracker/manual
 *
 * @return int|WP_Error event_id
 */
function digitify_crm_log_event( $email, $event_type, array $meta = [], $summary = null, $occurred_at = null, $source_app = null ) {
    $email = digitify_crm_normalize_email( (string) $email );
    $event_type = sanitize_key( (string) $event_type );

    if ( empty( $email ) || empty( $event_type ) ) {
        return new WP_Error( 'dcrm_invalid', 'E-mail en event_type zijn verplicht.' );
    }

    $repo = new \DCRM\Repositories\ContactRepository();

    // Minimale upsert data (optioneel)
    $data = [];
    if ( isset( $meta['name'] ) ) $data['name'] = sanitize_text_field( (string) $meta['name'] );
    if ( isset( $meta['tel'] ) )  $data['tel']  = sanitize_text_field( (string) $meta['tel'] );

    $contact_id = $repo->findOrCreate( $email, $data );
    if ( ! $contact_id ) {
        return new WP_Error( 'dcrm_contact_fail', 'Kon contact niet aanmaken.' );
    }

    $summary = $summary !== null ? sanitize_text_field( (string) $summary ) : '';
    $source_app = $source_app !== null ? sanitize_key( (string) $source_app ) : 'external';

    $event_id = $repo->logEvent( (int) $contact_id, $event_type, $summary ?: $event_type, $meta, get_current_user_id(), $occurred_at, $source_app );

    do_action( 'digitify_crm/event_logged', (int) $event_id, (int) $contact_id, $event_type, $meta );

    return (int) $event_id;
}

/**
 * Public API: contact upserten op basis van e-mail (dedupe), optioneel event loggen.
 *
 * @param array $data  ['email'=>..., 'name'=>..., 'tel'=>..., 'status'=>..., 'pipeline_stage'=>..., 'notes'=>...]
 * @param array $options ['log_event' => bool, 'source_app' => string, 'event_type' => string, 'summary' => string]
 * @return int|WP_Error contact_id
 */
function digitify_crm_upsert_contact( array $data, array $options = [] ) {
    $email = isset( $data['email'] ) ? digitify_crm_normalize_email( (string) $data['email'] ) : '';
    if ( empty( $email ) ) return new WP_Error( 'dcrm_invalid', 'E-mail is verplicht.' );

    $repo = new \DCRM\Repositories\ContactRepository();

    $insert = [];
    if ( isset( $data['name'] ) )           $insert['name'] = sanitize_text_field( (string) $data['name'] );
    if ( isset( $data['tel'] ) )            $insert['tel']  = sanitize_text_field( (string) $data['tel'] );
    if ( isset( $data['status'] ) )         $insert['status'] = sanitize_key( (string) $data['status'] );
    if ( isset( $data['pipeline_stage'] ) ) $insert['pipeline_stage'] = sanitize_text_field( (string) $data['pipeline_stage'] );
    if ( isset( $data['notes'] ) )          $insert['notes'] = wp_kses_post( (string) $data['notes'] );
    if ( isset( $data['source'] ) )         $insert['source'] = sanitize_key( (string) $data['source'] );

    $contactId = $repo->findOrCreate( $email, $insert );
    if ( ! $contactId ) return new WP_Error( 'dcrm_contact_fail', 'Kon contact niet aanmaken.' );

    $logEvent = isset( $options['log_event'] ) ? (bool) $options['log_event'] : false;
    if ( $logEvent ) {
        $eventType = isset( $options['event_type'] ) ? sanitize_key( (string) $options['event_type'] ) : 'contact_upserted';
        $summary   = isset( $options['summary'] ) ? sanitize_text_field( (string) $options['summary'] ) : 'Contact bijgewerkt';
        $sourceApp = isset( $options['source_app'] ) ? sanitize_key( (string) $options['source_app'] ) : 'external';
        $repo->logEvent( (int) $contactId, $eventType, $summary, [ 'data' => $insert ], get_current_user_id(), current_time('mysql'), $sourceApp );
    }

    return (int) $contactId;
}
