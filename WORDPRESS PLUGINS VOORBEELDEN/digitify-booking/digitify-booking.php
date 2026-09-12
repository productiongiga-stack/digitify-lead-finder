<?php
/**
 * Plugin Name: Digitify Booking
 * Plugin URI:  https://digitify.be
 * Description: Eenvoudig boekingssysteem met Google Calendar integratie
 * Version:     1.3.2
 * Author:      Digitify
 * Text Domain: digitify-booking
 * Domain Path: /languages
 */

defined( 'ABSPATH' ) || exit;

define( 'DIGITIFY_BOOKING_VERSION',    '1.3.2' );
define( 'DIGITIFY_BOOKING_DIR',        plugin_dir_path( __FILE__ ) );
define( 'DIGITIFY_BOOKING_URL',        plugin_dir_url( __FILE__ ) );
define( 'DIGITIFY_BOOKING_DB_VERSION', '1.2' );

/* ---------------------------------------------------------------
 * Autoload classes
 * ------------------------------------------------------------- */
require_once DIGITIFY_BOOKING_DIR . 'includes/class-google-calendar.php';
require_once DIGITIFY_BOOKING_DIR . 'includes/class-booking-handler.php';
require_once DIGITIFY_BOOKING_DIR . 'includes/class-crm-adapter.php';
require_once DIGITIFY_BOOKING_DIR . 'admin/class-admin.php';
require_once DIGITIFY_BOOKING_DIR . 'public/class-booking-widget.php';

/* ---------------------------------------------------------------
 * Activation / Deactivation
 * ------------------------------------------------------------- */
register_activation_hook( __FILE__,   'digitify_booking_activate' );
register_deactivation_hook( __FILE__, 'digitify_booking_deactivate' );

function digitify_booking_activate(): void {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();

    // ── Event types ────────────────────────────────────────────
    $sql1 = "CREATE TABLE {$wpdb->prefix}digitify_event_types (
        id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        title           VARCHAR(255)        NOT NULL,
        slug            VARCHAR(255)        NOT NULL UNIQUE,
        duration        INT(11)             NOT NULL DEFAULT 30,
        description     TEXT,
        color           VARCHAR(7)          NOT NULL DEFAULT '#6366f1',
        google_color_id TINYINT(2) UNSIGNED NOT NULL DEFAULT 0,
        location        VARCHAR(255),
        buffer_before   INT(11)             NOT NULL DEFAULT 0,
        buffer_after    INT(11)             NOT NULL DEFAULT 0,
        active          TINYINT(1)          NOT NULL DEFAULT 1,
        created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) $charset_collate;";

    // ── Bookings ───────────────────────────────────────────────
    $sql2 = "CREATE TABLE {$wpdb->prefix}digitify_bookings (
        id              BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        event_type_id   BIGINT(20) UNSIGNED NOT NULL,
        attendee_name   VARCHAR(255)        NOT NULL,
        attendee_email  VARCHAR(255)        NOT NULL,
        attendee_phone  VARCHAR(30),
        attendee_notes  TEXT,
        start_time      DATETIME            NOT NULL,
        end_time        DATETIME            NOT NULL,
        status          VARCHAR(20)         NOT NULL DEFAULT 'pending',
        google_event_id VARCHAR(255),
        meet_link       VARCHAR(500),
        uid             VARCHAR(64)         NOT NULL,
        reminder_sent   TINYINT(1)          NOT NULL DEFAULT 0,
        created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY event_type_id (event_type_id),
        KEY start_time (start_time),
        KEY status (status)
    ) $charset_collate;";

    // ── Availability ──────────────────────────────────────────
    $sql3 = "CREATE TABLE {$wpdb->prefix}digitify_availability (
        id          BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        day_of_week TINYINT(1)         NOT NULL COMMENT '0=Sun,1=Mon,...,6=Sat',
        start_time  TIME               NOT NULL,
        end_time    TIME               NOT NULL,
        active      TINYINT(1)         NOT NULL DEFAULT 1,
        PRIMARY KEY (id)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql1 );
    dbDelta( $sql2 );
    dbDelta( $sql3 );

    // Default availability: Mon–Fri 09:00–17:00
    $table = $wpdb->prefix . 'digitify_availability';
    if ( ! $wpdb->get_var( "SELECT COUNT(*) FROM $table" ) ) {
        for ( $d = 1; $d <= 5; $d++ ) {
            $wpdb->insert( $table, [
                'day_of_week' => $d,
                'start_time'  => '09:00:00',
                'end_time'    => '17:00:00',
                'active'      => 1,
            ] );
        }
    }

    update_option( 'digitify_booking_db_version', DIGITIFY_BOOKING_DB_VERSION );

    // Schedule 5-minute reminder cron
    if ( ! wp_next_scheduled( 'digitify_booking_reminders' ) ) {
        wp_schedule_event( time(), 'dg_every_5min', 'digitify_booking_reminders' );
    }

    // Flush rewrite rules so ?digitify_embed works
    flush_rewrite_rules();
}

function digitify_booking_deactivate(): void {
    wp_clear_scheduled_hook( 'digitify_booking_reminders' );
    flush_rewrite_rules();
}

/* ---------------------------------------------------------------
 * Custom cron schedule: every 5 minutes
 * ------------------------------------------------------------- */
add_filter( 'cron_schedules', function ( $schedules ) {
    $schedules['dg_every_5min'] = [
        'interval' => 300,
        'display'  => 'Elke 5 minuten',
    ];
    return $schedules;
} );

/* ---------------------------------------------------------------
 * Cron: send reminder emails (~1 hour before confirmed bookings)
 * ------------------------------------------------------------- */
add_action( 'digitify_booking_reminders', 'digitify_do_booking_reminders' );

function digitify_do_booking_reminders(): void {
    global $wpdb;

    $tz   = new DateTimeZone( wp_timezone_string() );
    $from = ( new DateTime( 'now', $tz ) )->modify( '+55 minutes' );
    $to   = ( new DateTime( 'now', $tz ) )->modify( '+65 minutes' );

    $bookings = $wpdb->get_results( $wpdb->prepare(
        "SELECT b.*, e.title AS event_title, e.duration, e.location
         FROM {$wpdb->prefix}digitify_bookings b
         LEFT JOIN {$wpdb->prefix}digitify_event_types e ON b.event_type_id = e.id
         WHERE b.status = 'confirmed'
           AND b.reminder_sent = 0
           AND b.start_time >= %s
           AND b.start_time <= %s",
        $from->format( 'Y-m-d H:i:s' ),
        $to->format( 'Y-m-d H:i:s' )
    ), ARRAY_A );

    foreach ( $bookings as $booking ) {
        digitify_send_booking_reminder( $booking );
        $wpdb->update(
            $wpdb->prefix . 'digitify_bookings',
            [ 'reminder_sent' => 1 ],
            [ 'id' => (int) $booking['id'] ]
        );
    }
}

function digitify_send_booking_reminder( array $b ): void {
    $opts      = get_option( 'digitify_booking_settings', [] );
    $branding  = get_option( 'digitify_booking_branding', [] );
    $site_name = $branding['company_name'] ?? get_bloginfo( 'name' );
    $tz        = new DateTimeZone( wp_timezone_string() );
    $start_dt  = new DateTime( $b['start_time'], $tz );

    $headers = [
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . ( $opts['from_name'] ?? $site_name ) . ' <' . ( $opts['from_email'] ?? get_bloginfo( 'admin_email' ) ) . '>',
    ];

    // To attendee
    $subject  = '⏰ Herinnering: ' . $b['event_title'] . ' over 1 uur';
    $message  = "Hallo {$b['attendee_name']},\n\n";
    $message .= "Dit is een herinnering voor je aankomende afspraak:\n\n";
    $message .= "📅 Evenement:  {$b['event_title']}\n";
    $message .= '🕐 Datum/tijd: ' . $start_dt->format( 'd/m/Y H:i' ) . "\n";
    $message .= "⏱  Duur:       {$b['duration']} minuten\n";
    if ( ! empty( $b['location'] ) )  { $message .= "📍 Locatie:    {$b['location']}\n"; }
    if ( ! empty( $b['meet_link'] ) ) { $message .= "🎥 Google Meet: {$b['meet_link']}\n"; }
    $message .= "\nTot zo!\n{$site_name}";
    wp_mail( $b['attendee_email'], $subject, $message, $headers );

    // To admin
    $admin_email   = $opts['notification_email'] ?? get_bloginfo( 'admin_email' );
    $admin_subject = "⏰ Reminder: {$b['attendee_name']} — {$b['event_title']} over 1 uur";
    $admin_msg  = "Herinnering: afspraak start over ≈ 1 uur.\n\n";
    $admin_msg .= "Naam:    {$b['attendee_name']}\n";
    $admin_msg .= "E-mail:  {$b['attendee_email']}\n";
    if ( ! empty( $b['attendee_phone'] ) ) { $admin_msg .= "Tel:     {$b['attendee_phone']}\n"; }
    $admin_msg .= "Type:    {$b['event_title']}\n";
    $admin_msg .= 'Datum:   ' . $start_dt->format( 'd/m/Y H:i' ) . "\n";
    if ( ! empty( $b['meet_link'] ) ) { $admin_msg .= "Meet:    {$b['meet_link']}\n"; }
    wp_mail( $admin_email, $admin_subject, $admin_msg, $headers );
}

/* ---------------------------------------------------------------
 * Embed query var (iframe standalone page)
 * ------------------------------------------------------------- */
add_filter( 'query_vars', function ( $vars ) {
    $vars[] = 'digitify_embed';
    return $vars;
} );

add_action( 'template_redirect', 'digitify_booking_handle_embed' );

function digitify_booking_handle_embed(): void {
    $event_id = (int) get_query_var( 'digitify_embed' );
    if ( ! $event_id ) {
        return;
    }
    $handler    = new Digitify_Booking_Handler();
    $event_type = $handler->get_event_type( $event_id );
    if ( ! $event_type ) {
        status_header( 404 );
        exit( 'Not found' );
    }
    $widget = new Digitify_Booking_Widget();
    $widget->render_embed_page( $event_type );
    exit;
}

/* ---------------------------------------------------------------
 * DB auto-upgrade on admin_init
 * ------------------------------------------------------------- */
add_action( 'admin_init', 'digitify_booking_maybe_upgrade' );

function digitify_booking_maybe_upgrade(): void {
    if ( get_option( 'digitify_booking_db_version' ) !== DIGITIFY_BOOKING_DB_VERSION ) {
        digitify_booking_activate();
    }
}

/* ---------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------- */
function digitify_booking_init(): void {
    $admin   = new Digitify_Booking_Admin();
    $widget  = new Digitify_Booking_Widget();
    $handler = new Digitify_Booking_Handler();

    $admin->init();
    $widget->init();
    $handler->init();
}
add_action( 'plugins_loaded', 'digitify_booking_init' );
