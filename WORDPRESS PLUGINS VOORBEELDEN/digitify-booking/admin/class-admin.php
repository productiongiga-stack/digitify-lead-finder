<?php
defined( 'ABSPATH' ) || exit;

/**
 * WordPress admin panel: bookings, event types, availability, calendar, branding.
 */
class Digitify_Booking_Admin {

    public function init(): void {
        add_action( 'admin_menu',            [ $this, 'add_menu' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
        add_action( 'admin_init',            [ $this, 'handle_actions' ] );
        add_action( 'admin_init',            [ $this, 'register_settings' ] );
    }

    /* ---------------------------------------------------------------
     * Admin Menu
     * ------------------------------------------------------------- */
    public function add_menu(): void {
        add_menu_page(
            'Digitify Booking', 'Digitify Booking', 'manage_options',
            'digitify-booking', [ $this, 'render_page' ],
            'dashicons-calendar-alt', 25
        );
        add_submenu_page( 'digitify-booking', 'Boekingen',       'Boekingen',       'manage_options', 'digitify-booking',          [ $this, 'render_page' ] );
        add_submenu_page( 'digitify-booking', 'Agenda',          'Agenda',          'manage_options', 'digitify-booking-calendar', [ $this, 'render_calendar_page' ] );
        add_submenu_page( 'digitify-booking', 'Evenementtypen',  'Evenementtypen',  'manage_options', 'digitify-booking-events',   [ $this, 'render_events_page' ] );
        add_submenu_page( 'digitify-booking', 'Beschikbaarheid', 'Beschikbaarheid', 'manage_options', 'digitify-booking-avail',    [ $this, 'render_avail_page' ] );
        add_submenu_page( 'digitify-booking', 'Huisstijl',       'Huisstijl',       'manage_options', 'digitify-booking-branding', [ $this, 'render_branding_page' ] );
        add_submenu_page( 'digitify-booking', 'Instellingen',    'Instellingen',    'manage_options', 'digitify-booking-settings', [ $this, 'render_settings_page' ] );
    }

    /* ---------------------------------------------------------------
     * Assets
     * ------------------------------------------------------------- */
    public function enqueue_assets( string $hook ): void {
        if ( strpos( $hook, 'digitify-booking' ) === false ) return;
        wp_enqueue_style( 'digitify-admin', DIGITIFY_BOOKING_URL . 'admin/admin.css', [], DIGITIFY_BOOKING_VERSION );
        // For AJAX confirm/reject buttons
        wp_add_inline_script( 'jquery', '' ); // ensure jQuery loaded
        wp_localize_script( 'jquery', 'digitifyAdmin', [
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'digitify_admin_nonce' ),
        ] );
    }

    /* ---------------------------------------------------------------
     * Handle admin actions
     * ------------------------------------------------------------- */
    public function handle_actions(): void {
        if ( ! current_user_can( 'manage_options' ) ) return;

        // Google OAuth callback
        if ( isset( $_GET['page'], $_GET['action'] ) &&
             $_GET['page'] === 'digitify-booking-settings' &&
             $_GET['action'] === 'oauth_callback' ) {
            if ( ! empty( $_GET['error'] ) ) {
                add_settings_error( 'digitify_booking', 'oauth_error', 'Google OAuth mislukt: ' . esc_html( $_GET['error'] ), 'error' );
                return;
            }
            $saved_state = get_option( 'digitify_google_oauth_state', '' );
            if ( empty( $_GET['state'] ) || ! hash_equals( $saved_state, $_GET['state'] ) ) {
                add_settings_error( 'digitify_booking', 'oauth_state', 'Ongeldige OAuth state.', 'error' );
                return;
            }
            $result = Digitify_Google_Calendar::handle_oauth_callback( sanitize_text_field( $_GET['code'] ) );
            if ( $result === true ) {
                add_settings_error( 'digitify_booking', 'oauth_ok', 'Google Calendar succesvol gekoppeld!', 'updated' );
            } else {
                add_settings_error( 'digitify_booking', 'oauth_fail', 'Koppeling mislukt: ' . esc_html( $result ), 'error' );
            }
        }

        // Disconnect Google
        if ( isset( $_GET['page'], $_GET['action'], $_GET['_wpnonce'] ) &&
             $_GET['page'] === 'digitify-booking-settings' &&
             $_GET['action'] === 'disconnect_google' &&
             wp_verify_nonce( $_GET['_wpnonce'], 'digitify_disconnect_google' ) ) {
            Digitify_Google_Calendar::disconnect();
            wp_redirect( admin_url( 'admin.php?page=digitify-booking-settings&disconnected=1' ) );
            exit;
        }

        // Cancel booking (admin)
        if ( isset( $_GET['page'], $_GET['action'], $_GET['booking_id'], $_GET['_wpnonce'] ) &&
             $_GET['page'] === 'digitify-booking' &&
             $_GET['action'] === 'delete' &&
             wp_verify_nonce( $_GET['_wpnonce'], 'digitify_delete_booking_' . $_GET['booking_id'] ) ) {
            global $wpdb;
            $booking = $wpdb->get_row( $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}digitify_bookings WHERE id = %d",
                (int) $_GET['booking_id']
            ), ARRAY_A );
            if ( $booking && ! empty( $booking['google_event_id'] ) && Digitify_Google_Calendar::is_connected() ) {
                Digitify_Google_Calendar::delete_event( $booking['google_event_id'] );
            }
            $wpdb->update( $wpdb->prefix . 'digitify_bookings', [ 'status' => 'cancelled' ], [ 'id' => (int) $_GET['booking_id'] ] );
            wp_redirect( admin_url( 'admin.php?page=digitify-booking&cancelled=1' ) );
            exit;
        }

        // Save event type
        if ( isset( $_POST['digitify_save_event_type'], $_POST['_wpnonce'] ) &&
             wp_verify_nonce( $_POST['_wpnonce'], 'digitify_save_event_type' ) ) {
            $this->save_event_type();
        }

        // Delete event type
        if ( isset( $_GET['page'], $_GET['action'], $_GET['event_id'], $_GET['_wpnonce'] ) &&
             $_GET['page'] === 'digitify-booking-events' &&
             $_GET['action'] === 'delete' &&
             wp_verify_nonce( $_GET['_wpnonce'], 'digitify_delete_event_' . $_GET['event_id'] ) ) {
            global $wpdb;
            $wpdb->delete( $wpdb->prefix . 'digitify_event_types', [ 'id' => (int) $_GET['event_id'] ] );
            wp_redirect( admin_url( 'admin.php?page=digitify-booking-events&deleted=1' ) );
            exit;
        }

        // Save availability
        if ( isset( $_POST['digitify_save_availability'], $_POST['_wpnonce'] ) &&
             wp_verify_nonce( $_POST['_wpnonce'], 'digitify_save_availability' ) ) {
            $this->save_availability();
        }

        // Save branding
        if ( isset( $_POST['digitify_save_branding'], $_POST['_wpnonce'] ) &&
             wp_verify_nonce( $_POST['_wpnonce'], 'digitify_save_branding' ) ) {
            $this->save_branding();
        }
    }

    /* ---------------------------------------------------------------
     * Settings API
     * ------------------------------------------------------------- */
    public function register_settings(): void {
        register_setting( 'digitify_booking_settings_group', 'digitify_booking_settings', [
            'sanitize_callback' => [ $this, 'sanitize_settings' ],
        ] );
        register_setting( 'digitify_booking_google_group', 'digitify_booking_google', [
            'sanitize_callback' => [ $this, 'sanitize_google_settings' ],
        ] );
    }

    public function sanitize_settings( array $input ): array {
        return [
            'from_name'          => sanitize_text_field( $input['from_name'] ?? '' ),
            'from_email'         => sanitize_email( $input['from_email'] ?? '' ),
            'notification_email' => sanitize_email( $input['notification_email'] ?? '' ),
            'google_meet'        => ! empty( $input['google_meet'] ) ? 1 : 0,
            'timezone'           => sanitize_text_field( $input['timezone'] ?? wp_timezone_string() ),
        ];
    }

    public function sanitize_google_settings( array $input ): array {
        return [
            'client_id'     => sanitize_text_field( $input['client_id'] ?? '' ),
            'client_secret' => sanitize_text_field( $input['client_secret'] ?? '' ),
        ];
    }

    /* ---------------------------------------------------------------
     * Render: Bookings overview
     * ------------------------------------------------------------- */
    public function render_page(): void {
        global $wpdb;

        $status_filter = sanitize_text_field( $_GET['status'] ?? 'all' );
        $where = $status_filter !== 'all' ? $wpdb->prepare( 'WHERE b.status = %s', $status_filter ) : '';

        $bookings = $wpdb->get_results(
            "SELECT b.*, e.title AS event_title, e.duration, e.color
             FROM {$wpdb->prefix}digitify_bookings b
             LEFT JOIN {$wpdb->prefix}digitify_event_types e ON b.event_type_id = e.id
             $where
             ORDER BY b.created_at DESC
             LIMIT 200",
            ARRAY_A
        );

        $counts = $wpdb->get_results(
            "SELECT status, COUNT(*) as cnt FROM {$wpdb->prefix}digitify_bookings GROUP BY status",
            ARRAY_A
        );
        $status_counts = [];
        foreach ( $counts as $c ) { $status_counts[ $c['status'] ] = (int) $c['cnt']; }
        $total = array_sum( $status_counts );
        ?>
        <div class="wrap dg-wrap">
            <h1 class="dg-page-title"><span class="dashicons dashicons-calendar-alt"></span> Boekingen</h1>

            <?php settings_errors( 'digitify_booking' ); ?>
            <?php if ( ! empty( $_GET['cancelled'] ) ) : ?>
                <div class="notice notice-success is-dismissible"><p>Boeking geannuleerd.</p></div>
            <?php endif; ?>

            <!-- Stats -->
            <div class="dg-stats-row">
                <div class="dg-stat-card"><span class="dg-stat-num"><?php echo $total; ?></span><span class="dg-stat-label">Totaal</span></div>
                <div class="dg-stat-card dg-stat-pending"><span class="dg-stat-num"><?php echo $status_counts['pending'] ?? 0; ?></span><span class="dg-stat-label">In afwachting</span></div>
                <div class="dg-stat-card dg-stat-confirmed"><span class="dg-stat-num"><?php echo $status_counts['confirmed'] ?? 0; ?></span><span class="dg-stat-label">Bevestigd</span></div>
                <div class="dg-stat-card dg-stat-cancelled"><span class="dg-stat-num"><?php echo $status_counts['cancelled'] ?? 0; ?></span><span class="dg-stat-label">Geannuleerd</span></div>
            </div>

            <!-- Filter tabs -->
            <ul class="dg-tabs">
                <?php foreach ( [ 'all' => 'Alle', 'pending' => '⏳ In afwachting', 'confirmed' => '✅ Bevestigd', 'cancelled' => '❌ Geannuleerd' ] as $key => $label ) : ?>
                    <li>
                        <a href="<?php echo admin_url( 'admin.php?page=digitify-booking&status=' . $key ); ?>"
                           class="<?php echo $status_filter === $key ? 'active' : ''; ?>">
                            <?php echo esc_html( $label ); ?>
                            <?php if ( $key === 'all' ) echo "($total)"; elseif ( isset( $status_counts[$key] ) ) echo "({$status_counts[$key]})"; ?>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>

            <!-- Bookings table -->
            <table class="dg-table wp-list-table widefat striped">
                <thead>
                    <tr>
                        <th>Naam</th><th>E-mail</th><th>Telefoon</th><th>Evenement</th>
                        <th>Datum & Tijd</th><th>Status</th><th>Google Meet</th><th>Acties</th>
                    </tr>
                </thead>
                <tbody>
                <?php if ( empty( $bookings ) ) : ?>
                    <tr><td colspan="8" class="dg-empty">Geen boekingen gevonden.</td></tr>
                <?php else : ?>
                    <?php foreach ( $bookings as $b ) :
                        $tz       = new DateTimeZone( wp_timezone_string() );
                        $start_dt = new DateTime( $b['start_time'], $tz );
                    ?>
                    <tr class="dg-row-<?php echo esc_attr( $b['status'] ); ?>">
                        <td>
                            <?php if ( $b['color'] ) : ?>
                                <span class="dg-dot" style="background:<?php echo esc_attr( $b['color'] ); ?>"></span>
                            <?php endif; ?>
                            <strong><?php echo esc_html( $b['attendee_name'] ); ?></strong>
                        </td>
                        <td><?php echo esc_html( $b['attendee_email'] ); ?></td>
                        <td><?php echo esc_html( $b['attendee_phone'] ?: '—' ); ?></td>
                        <td>
                            <span class="dg-event-badge"><?php echo esc_html( $b['event_title'] ?? '—' ); ?></span>
                            <?php if ( $b['duration'] ) echo '<small>(' . (int)$b['duration'] . ' min)</small>'; ?>
                        </td>
                        <td><?php echo esc_html( $start_dt->format( 'd/m/Y H:i' ) ); ?></td>
                        <td>
                            <span class="dg-status dg-status-<?php echo esc_attr( $b['status'] ); ?>">
                                <?php echo match( $b['status'] ) {
                                    'confirmed' => '✅ Bevestigd',
                                    'pending'   => '⏳ In afwachting',
                                    default     => '❌ Geannuleerd',
                                }; ?>
                            </span>
                        </td>
                        <td>
                            <?php if ( ! empty( $b['meet_link'] ) ) : ?>
                                <a href="<?php echo esc_url( $b['meet_link'] ); ?>" target="_blank" class="dg-meet-link">🎥 Openen</a>
                            <?php else : ?>—<?php endif; ?>
                        </td>
                        <td class="dg-actions">
                            <?php if ( $b['status'] === 'pending' ) : ?>
                                <button class="dg-btn-confirm dg-btn-sm button button-primary"
                                        data-id="<?php echo (int) $b['id']; ?>">✅ Bevestig</button>
                                <button class="dg-btn-reject dg-btn-sm button"
                                        data-id="<?php echo (int) $b['id']; ?>">❌ Weiger</button>
                            <?php elseif ( $b['status'] === 'confirmed' ) : ?>
                                <a href="<?php echo wp_nonce_url( admin_url( 'admin.php?page=digitify-booking&action=delete&booking_id=' . $b['id'] ), 'digitify_delete_booking_' . $b['id'] ); ?>"
                                   onclick="return confirm('Boeking annuleren?');" class="dg-btn-danger dg-btn-sm">Annuleer</a>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
                </tbody>
            </table>
        </div>

        <script>
        (function($){
            var ajaxUrl = digitifyAdmin.ajaxUrl;
            var nonce   = digitifyAdmin.nonce;

            $(document).on('click', '.dg-btn-confirm', function(){
                var $btn = $(this), id = $btn.data('id');
                $btn.prop('disabled', true).text('Bezig…');
                $.post(ajaxUrl, { action:'digitify_confirm_booking', nonce:nonce, booking_id:id })
                 .done(function(r){
                    if(r.success){ location.reload(); }
                    else{ alert('Fout: ' + r.data); $btn.prop('disabled',false).text('✅ Bevestig'); }
                 });
            });

            $(document).on('click', '.dg-btn-reject', function(){
                if(!confirm('Boeking weigeren? De klant ontvangt een afwijzingsmail.')) return;
                var $btn = $(this), id = $btn.data('id');
                $btn.prop('disabled', true).text('Bezig…');
                $.post(ajaxUrl, { action:'digitify_reject_booking', nonce:nonce, booking_id:id })
                 .done(function(r){
                    if(r.success){ location.reload(); }
                    else{ alert('Fout: ' + r.data); $btn.prop('disabled',false).text('❌ Weiger'); }
                 });
            });
        })(jQuery);
        </script>
        <?php
    }

    /* ---------------------------------------------------------------
     * Render: Admin calendar view
     * ------------------------------------------------------------- */
    public function render_calendar_page(): void {
        global $wpdb;

        $tz    = new DateTimeZone( wp_timezone_string() );
        $today = new DateTime( 'today', $tz );

        // Month navigation
        $year  = isset( $_GET['y'] ) ? (int) $_GET['y'] : (int) $today->format( 'Y' );
        $month = isset( $_GET['m'] ) ? (int) $_GET['m'] : (int) $today->format( 'n' );
        $year  = max( 2020, min( 2035, $year ) );
        $month = max( 1,    min( 12, $month ) );

        $prev_year  = $month === 1  ? $year - 1 : $year;
        $prev_month = $month === 1  ? 12 : $month - 1;
        $next_year  = $month === 12 ? $year + 1 : $year;
        $next_month = $month === 12 ? 1  : $month + 1;

        // Fetch bookings for this month
        $month_start = sprintf( '%04d-%02d-01', $year, $month );
        $days_in     = (int) date( 't', mktime( 0,0,0,$month,1,$year ) );
        $month_end   = sprintf( '%04d-%02d-%02d', $year, $month, $days_in );

        $bookings = $wpdb->get_results( $wpdb->prepare(
            "SELECT b.id, b.attendee_name, b.start_time, b.end_time, b.status, b.meet_link,
                    e.title as event_title, e.color
             FROM {$wpdb->prefix}digitify_bookings b
             LEFT JOIN {$wpdb->prefix}digitify_event_types e ON b.event_type_id = e.id
             WHERE b.start_time >= %s AND b.start_time <= %s
             ORDER BY b.start_time ASC",
            $month_start . ' 00:00:00',
            $month_end   . ' 23:59:59'
        ), ARRAY_A );

        // Group by day
        $by_day = [];
        foreach ( $bookings as $b ) {
            $d = ( new DateTime( $b['start_time'], $tz ) )->format( 'j' );
            $by_day[ $d ][] = $b;
        }

        $month_names = [ 1=>'Januari',2=>'Februari',3=>'Maart',4=>'April',5=>'Mei',6=>'Juni',
                         7=>'Juli',8=>'Augustus',9=>'September',10=>'Oktober',11=>'November',12=>'December' ];
        $first_dow = (int) date( 'N', mktime( 0,0,0,$month,1,$year ) ); // 1=Mon
        ?>
        <div class="wrap dg-wrap">
            <h1 class="dg-page-title"><span class="dashicons dashicons-calendar-alt"></span> Agenda</h1>

            <div class="dg-cal-nav">
                <a href="<?php echo admin_url( "admin.php?page=digitify-booking-calendar&y=$prev_year&m=$prev_month" ); ?>"
                   class="dg-btn-secondary">← Vorige</a>
                <h2 class="dg-cal-nav-title"><?php echo $month_names[$month] . ' ' . $year; ?></h2>
                <a href="<?php echo admin_url( "admin.php?page=digitify-booking-calendar&y=$next_year&m=$next_month" ); ?>"
                   class="dg-btn-secondary">Volgende →</a>
            </div>

            <div class="dg-admin-cal">
                <!-- Day headers -->
                <div class="dg-admin-cal-row dg-admin-cal-head">
                    <?php foreach ( ['Ma','Di','Wo','Do','Vr','Za','Zo'] as $d ) : ?>
                        <div class="dg-admin-cal-cell"><?php echo $d; ?></div>
                    <?php endforeach; ?>
                </div>
                <!-- Day rows -->
                <div class="dg-admin-cal-row dg-admin-cal-body">
                    <!-- Empty cells before first day -->
                    <?php for ( $i = 1; $i < $first_dow; $i++ ) : ?>
                        <div class="dg-admin-cal-cell dg-cal-empty"></div>
                    <?php endfor; ?>
                    <!-- Days -->
                    <?php for ( $day = 1; $day <= $days_in; $day++ ) :
                        $date_str = sprintf( '%04d-%02d-%02d', $year, $month, $day );
                        $dt       = new DateTime( $date_str, $tz );
                        $is_today = $dt->format( 'Y-m-d' ) === $today->format( 'Y-m-d' );
                        $day_bookings = $by_day[ $day ] ?? [];
                    ?>
                        <div class="dg-admin-cal-cell dg-admin-cal-day <?php echo $is_today ? 'dg-cal-today' : ''; ?> <?php echo ! empty( $day_bookings ) ? 'dg-cal-has-bookings' : ''; ?>">
                            <span class="dg-admin-day-num"><?php echo $day; ?></span>
                            <?php foreach ( $day_bookings as $b ) :
                                $start = ( new DateTime( $b['start_time'], $tz ) )->format( 'H:i' );
                                $status_class = 'dg-cal-event-' . $b['status'];
                            ?>
                                <div class="dg-admin-cal-event <?php echo esc_attr( $status_class ); ?>"
                                     style="border-left-color:<?php echo esc_attr( $b['color'] ?: '#ff6a00' ); ?>"
                                     title="<?php echo esc_attr( $b['attendee_name'] . ' — ' . $b['event_title'] ); ?>">
                                    <span class="dg-cal-event-time"><?php echo esc_html( $start ); ?></span>
                                    <span class="dg-cal-event-name"><?php echo esc_html( $b['attendee_name'] ); ?></span>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endfor; ?>
                </div>
            </div>

            <!-- Legend -->
            <div class="dg-cal-legend">
                <span class="dg-legend-item"><span class="dg-legend-dot dg-cal-event-pending"></span> In afwachting</span>
                <span class="dg-legend-item"><span class="dg-legend-dot dg-cal-event-confirmed"></span> Bevestigd</span>
                <span class="dg-legend-item"><span class="dg-legend-dot dg-cal-event-cancelled"></span> Geannuleerd</span>
            </div>
        </div>
        <?php
    }

    /* ---------------------------------------------------------------
     * Render: Event types
     * ------------------------------------------------------------- */
    public function render_events_page(): void {
        global $wpdb;
        $events    = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}digitify_event_types ORDER BY id ASC", ARRAY_A );
        $edit_id   = isset( $_GET['edit'] ) ? (int) $_GET['edit'] : 0;
        $edit_item = $edit_id ? $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}digitify_event_types WHERE id = %d", $edit_id ), ARRAY_A ) : null;
        ?>
        <div class="wrap dg-wrap">
            <h1 class="dg-page-title"><span class="dashicons dashicons-list-view"></span> Evenementtypen</h1>

            <?php if ( ! empty( $_GET['deleted'] ) ) : ?>
                <div class="notice notice-success is-dismissible"><p>Evenementtype verwijderd.</p></div>
            <?php endif; ?>
            <?php if ( ! empty( $_GET['saved'] ) ) : ?>
                <div class="notice notice-success is-dismissible"><p>Evenementtype opgeslagen.</p></div>
            <?php endif; ?>

            <div class="dg-two-col">
                <div class="dg-col-main">
                    <table class="dg-table wp-list-table widefat striped">
                        <thead><tr><th>Naam</th><th>Duur</th><th>Locatie</th><th>Status</th><th>Shortcode</th><th>Acties</th></tr></thead>
                        <tbody>
                        <?php if ( empty( $events ) ) : ?>
                            <tr><td colspan="6" class="dg-empty">Nog geen evenementtypen. Maak er een aan →</td></tr>
                        <?php else : ?>
                            <?php foreach ( $events as $e ) : ?>
                            <tr>
                                <td>
                                    <span class="dg-dot" style="background:<?php echo esc_attr( $e['color'] ); ?>"></span>
                                    <strong><?php echo esc_html( $e['title'] ); ?></strong>
                                </td>
                                <td><?php echo (int) $e['duration']; ?> min</td>
                                <td><?php echo esc_html( $e['location'] ?: '—' ); ?></td>
                                <td><span class="dg-status <?php echo $e['active'] ? 'dg-status-confirmed' : 'dg-status-cancelled'; ?>"><?php echo $e['active'] ? 'Actief' : 'Inactief'; ?></span></td>
                                <td><code class="dg-code">[digitify_booking id="<?php echo $e['id']; ?>"]</code></td>
                                <td>
                                    <a href="<?php echo admin_url( 'admin.php?page=digitify-booking-events&edit=' . $e['id'] ); ?>" class="dg-btn-sm button">Bewerken</a>
                                    <a href="<?php echo wp_nonce_url( admin_url( 'admin.php?page=digitify-booking-events&action=delete&event_id=' . $e['id'] ), 'digitify_delete_event_' . $e['id'] ); ?>"
                                       onclick="return confirm('Verwijderen?');" class="dg-btn-danger dg-btn-sm">Verwijder</a>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                        </tbody>
                    </table>
                </div>

                <div class="dg-col-side">
                    <div class="dg-card">
                        <h2><?php echo $edit_item ? 'Bewerken' : 'Nieuw evenementtype'; ?></h2>
                        <form method="post">
                            <?php wp_nonce_field( 'digitify_save_event_type' ); ?>
                            <?php if ( $edit_item ) : ?>
                                <input type="hidden" name="event_id" value="<?php echo (int) $edit_item['id']; ?>">
                            <?php endif; ?>
                            <div class="dg-field"><label>Naam *</label>
                                <input type="text" name="title" required value="<?php echo esc_attr( $edit_item['title'] ?? '' ); ?>"></div>
                            <div class="dg-field"><label>Duur (minuten) *</label>
                                <input type="number" name="duration" min="5" step="5" required value="<?php echo esc_attr( $edit_item['duration'] ?? 30 ); ?>"></div>
                            <div class="dg-field"><label>Beschrijving</label>
                                <textarea name="description" rows="3"><?php echo esc_textarea( $edit_item['description'] ?? '' ); ?></textarea></div>
                            <div class="dg-field"><label>Locatie</label>
                                <input type="text" name="location" value="<?php echo esc_attr( $edit_item['location'] ?? '' ); ?>"></div>
                            <div class="dg-field-row">
                                <div class="dg-field"><label>Buffer voor (min)</label>
                                    <input type="number" name="buffer_before" min="0" step="5" value="<?php echo esc_attr( $edit_item['buffer_before'] ?? 0 ); ?>"></div>
                                <div class="dg-field"><label>Buffer na (min)</label>
                                    <input type="number" name="buffer_after" min="0" step="5" value="<?php echo esc_attr( $edit_item['buffer_after'] ?? 0 ); ?>"></div>
                            </div>
                            <div class="dg-field-row">
                                <div class="dg-field"><label>Widget kleur</label>
                                    <input type="color" name="color" value="<?php echo esc_attr( $edit_item['color'] ?? '#ff6a00' ); ?>"></div>
                                <div class="dg-field"><label>Google Agenda kleur</label>
                                    <select name="google_color_id">
                                        <?php
                                        $gc_colors = [ 0=>'— Standaard —',1=>'🟣 Lavendel',2=>'🟢 Salie',3=>'🟣 Druif',4=>'🌸 Flamingo',5=>'🟡 Banaan',6=>'🟠 Mandarijn',7=>'🔵 Pauw',8=>'⬛ Grafiet',9=>'🔵 Bosbes',10=>'🌲 Basilicum',11=>'🔴 Tomaat' ];
                                        $cur = (int) ( $edit_item['google_color_id'] ?? 0 );
                                        foreach ( $gc_colors as $val => $label ) echo '<option value="' . $val . '"' . selected( $cur, $val, false ) . '>' . esc_html( $label ) . '</option>';
                                        ?>
                                    </select>
                                </div>
                            </div>
                            <div class="dg-field dg-field-check">
                                <label><input type="checkbox" name="active" value="1" <?php checked( $edit_item['active'] ?? 1, 1 ); ?>> Actief (zichtbaar voor bezoekers)</label>
                            </div>
                            <button type="submit" name="digitify_save_event_type" class="dg-btn-primary">
                                <?php echo $edit_item ? 'Opslaan' : 'Aanmaken'; ?>
                            </button>
                            <?php if ( $edit_item ) : ?>
                                <a href="<?php echo admin_url( 'admin.php?page=digitify-booking-events' ); ?>" class="dg-btn-link">Annuleren</a>
                            <?php endif; ?>
                        </form>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    /* ---------------------------------------------------------------
     * Render: Availability
     * ------------------------------------------------------------- */
    public function render_avail_page(): void {
        global $wpdb;
        $avail  = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}digitify_availability ORDER BY day_of_week, start_time", ARRAY_A );
        $days   = [ 0=>'Zondag',1=>'Maandag',2=>'Dinsdag',3=>'Woensdag',4=>'Donderdag',5=>'Vrijdag',6=>'Zaterdag' ];
        $by_day = [];
        foreach ( $avail as $a ) { $by_day[ $a['day_of_week'] ] = $a; }
        ?>
        <div class="wrap dg-wrap">
            <h1 class="dg-page-title"><span class="dashicons dashicons-clock"></span> Beschikbaarheid</h1>
            <?php if ( isset( $_GET['saved'] ) ) : ?>
                <div class="notice notice-success is-dismissible"><p>Beschikbaarheid opgeslagen.</p></div>
            <?php endif; ?>
            <div class="dg-card dg-card-wide">
                <form method="post">
                    <?php wp_nonce_field( 'digitify_save_availability' ); ?>
                    <table class="dg-avail-table">
                        <thead><tr><th>Dag</th><th>Actief</th><th>Van</th><th>Tot</th></tr></thead>
                        <tbody>
                        <?php foreach ( $days as $num => $name ) :
                            $row = $by_day[ $num ] ?? null; ?>
                        <tr>
                            <td><strong><?php echo $name; ?></strong></td>
                            <td>
                                <label class="dg-toggle">
                                    <input type="checkbox" name="days[<?php echo $num; ?>][active]" value="1" <?php checked( ! empty( $row['active'] ) ); ?>>
                                    <span class="dg-toggle-slider"></span>
                                </label>
                            </td>
                            <td><input type="time" name="days[<?php echo $num; ?>][start]" value="<?php echo esc_attr( substr( $row['start_time'] ?? '09:00:00', 0, 5 ) ); ?>"></td>
                            <td><input type="time" name="days[<?php echo $num; ?>][end]"   value="<?php echo esc_attr( substr( $row['end_time']   ?? '17:00:00', 0, 5 ) ); ?>"></td>
                        </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                    <br>
                    <button type="submit" name="digitify_save_availability" class="dg-btn-primary">Opslaan</button>
                </form>
            </div>
        </div>
        <?php
    }

    /* ---------------------------------------------------------------
     * Render: Branding / Huisstijl
     * ------------------------------------------------------------- */
    public function render_branding_page(): void {
        $b = get_option( 'digitify_booking_branding', [] );
        ?>
        <div class="wrap dg-wrap">
            <h1 class="dg-page-title"><span class="dashicons dashicons-art"></span> Huisstijl</h1>
            <?php if ( isset( $_GET['saved'] ) ) : ?>
                <div class="notice notice-success is-dismissible"><p>Huisstijl opgeslagen.</p></div>
            <?php endif; ?>

            <div class="dg-card dg-card-wide">
                <h2>Bedrijfsidentiteit</h2>
                <form method="post">
                    <?php wp_nonce_field( 'digitify_save_branding' ); ?>
                    <div class="dg-field-row">
                        <div class="dg-field">
                            <label>Bedrijfsnaam</label>
                            <input type="text" name="branding[company_name]"
                                   value="<?php echo esc_attr( $b['company_name'] ?? get_bloginfo( 'name' ) ); ?>"
                                   placeholder="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">
                            <p class="description">Wordt getoond in de widget en e-mails.</p>
                        </div>
                        <div class="dg-field">
                            <label>Tagline / Omschrijving</label>
                            <input type="text" name="branding[tagline]"
                                   value="<?php echo esc_attr( $b['tagline'] ?? '' ); ?>"
                                   placeholder="Plan een afspraak">
                        </div>
                    </div>
                    <div class="dg-field">
                        <label>Logo URL</label>
                        <input type="url" name="branding[logo_url]"
                               value="<?php echo esc_attr( $b['logo_url'] ?? '' ); ?>"
                               placeholder="https://jouwsite.be/wp-content/uploads/logo.png">
                        <p class="description">Directe URL naar het logo. Aanbevolen formaat: PNG/SVG, min. 200×200px.</p>
                        <?php if ( ! empty( $b['logo_url'] ) ) : ?>
                            <img src="<?php echo esc_url( $b['logo_url'] ); ?>" alt="Logo preview"
                                 style="max-height:80px;margin-top:8px;border-radius:8px;border:1px solid #e4e7ec;">
                        <?php endif; ?>
                    </div>
                    <hr style="margin:20px 0;border:none;border-top:1px solid #e4e7ec;">
                    <h3 style="margin-bottom:16px;">Kleuren</h3>
                    <div class="dg-field-row">
                        <div class="dg-field">
                            <label>Primaire kleur</label>
                            <div style="display:flex;gap:10px;align-items:center;">
                                <input type="color" name="branding[primary_color]"
                                       value="<?php echo esc_attr( $b['primary_color'] ?? '#ff6a00' ); ?>">
                                <input type="text" name="branding[primary_color_text]"
                                       value="<?php echo esc_attr( $b['primary_color'] ?? '#ff6a00' ); ?>"
                                       style="width:100px;font-family:monospace;"
                                       placeholder="#ff6a00" readonly>
                            </div>
                            <p class="description">Kleur van knoppen, geselecteerde data en accenten.</p>
                        </div>
                        <div class="dg-field">
                            <label>Achtergrondkleur widget</label>
                            <div style="display:flex;gap:10px;align-items:center;">
                                <input type="color" name="branding[bg_color]"
                                       value="<?php echo esc_attr( $b['bg_color'] ?? '#ffffff' ); ?>">
                                <input type="text" value="<?php echo esc_attr( $b['bg_color'] ?? '#ffffff' ); ?>"
                                       style="width:100px;font-family:monospace;" placeholder="#ffffff" readonly>
                            </div>
                        </div>
                    </div>
                    <hr style="margin:20px 0;border:none;border-top:1px solid #e4e7ec;">
                    <h3 style="margin-bottom:16px;">Widget tekst</h3>
                    <div class="dg-field-row">
                        <div class="dg-field">
                            <label>Widget titel (sidebar)</label>
                            <input type="text" name="branding[widget_title]"
                                   value="<?php echo esc_attr( $b['widget_title'] ?? '' ); ?>"
                                   placeholder="Plan een afspraak">
                        </div>
                        <div class="dg-field">
                            <label>Widget ondertitel</label>
                            <input type="text" name="branding[widget_subtitle]"
                                   value="<?php echo esc_attr( $b['widget_subtitle'] ?? '' ); ?>"
                                   placeholder="Kies een datum en tijdstip dat jou uitkomt.">
                        </div>
                    </div>
                    <hr style="margin:20px 0;border:none;border-top:1px solid #e4e7ec;">
                    <h3 style="margin-bottom:16px;">Tijdzone</h3>
                    <div class="dg-field">
                        <label>Tijdzone (widget)</label>
                        <input type="text" name="branding[timezone_label]"
                               value="<?php echo esc_attr( $b['timezone_label'] ?? wp_timezone_string() ); ?>"
                               placeholder="<?php echo esc_attr( wp_timezone_string() ); ?>">
                        <p class="description">Label getoond in de widget (bijv. "Europe/Brussels").</p>
                    </div>
                    <button type="submit" name="digitify_save_branding" class="dg-btn-primary">Huisstijl opslaan</button>
                </form>
            </div>

            <!-- Live preview -->
            <div class="dg-card dg-card-wide">
                <h2>Voorbeeld sidebar</h2>
                <div class="dg-branding-preview" id="dg-brand-preview">
                    <div class="dg-preview-sidebar" id="dg-preview-sidebar" style="background:<?php echo esc_attr( $b['bg_color'] ?? '#f8fafc' ); ?>;">
                        <?php if ( ! empty( $b['logo_url'] ) ) : ?>
                            <img src="<?php echo esc_url( $b['logo_url'] ); ?>" class="dg-preview-logo" alt="">
                        <?php else : ?>
                            <div class="dg-preview-logo-placeholder">LOGO</div>
                        <?php endif; ?>
                        <div class="dg-preview-company"><?php echo esc_html( $b['company_name'] ?? get_bloginfo( 'name' ) ); ?></div>
                        <div class="dg-preview-title" style="color:<?php echo esc_attr( $b['primary_color'] ?? '#ff6a00' ); ?>">
                            <?php echo esc_html( $b['widget_title'] ?? 'Kennismaking' ); ?>
                        </div>
                        <div class="dg-preview-meta">
                            <span>⏱ 30 min</span>
                            <span>🌍 <?php echo esc_html( $b['timezone_label'] ?? wp_timezone_string() ); ?></span>
                        </div>
                        <p class="dg-preview-subtitle"><?php echo esc_html( $b['widget_subtitle'] ?? '' ); ?></p>
                    </div>
                </div>
            </div>
        </div>
        <script>
        // Sync color picker with text field
        document.querySelectorAll('input[type="color"]').forEach(function(el){
            var textEl = el.nextElementSibling;
            el.addEventListener('input', function(){
                if(textEl) textEl.value = el.value;
                // Live preview
                if(el.name.indexOf('primary_color') !== -1){
                    document.querySelector('.dg-preview-title').style.color = el.value;
                }
                if(el.name.indexOf('bg_color') !== -1){
                    document.getElementById('dg-preview-sidebar').style.background = el.value;
                }
            });
        });
        </script>
        <?php
    }

    /* ---------------------------------------------------------------
     * Render: Settings
     * ------------------------------------------------------------- */
    public function render_settings_page(): void {
        $opts_google   = get_option( 'digitify_booking_google', [] );
        $opts_settings = get_option( 'digitify_booking_settings', [] );
        $connected     = Digitify_Google_Calendar::is_connected();
        $auth_url      = '';
        if ( ! empty( $opts_google['client_id'] ) && ! empty( $opts_google['client_secret'] ) ) {
            $auth_url = Digitify_Google_Calendar::get_auth_url();
        }
        ?>
        <div class="wrap dg-wrap">
            <h1 class="dg-page-title"><span class="dashicons dashicons-admin-settings"></span> Instellingen</h1>
            <?php settings_errors( 'digitify_booking' ); ?>
            <?php if ( isset( $_GET['disconnected'] ) ) : ?>
                <div class="notice notice-success is-dismissible"><p>Google Calendar ontkoppeld.</p></div>
            <?php endif; ?>

            <!-- Google Calendar -->
            <div class="dg-card dg-card-wide">
                <h2>🔗 Google Calendar Koppeling</h2>
                <?php if ( $connected ) : ?>
                    <div class="dg-connected-banner">
                        <span class="dg-dot dg-dot-green"></span>
                        <strong>Verbonden</strong>
                        <?php $cal_id = get_option( 'digitify_booking_google_calendar_id', '' );
                              if ( $cal_id ) echo '<small> — ' . esc_html( $cal_id ) . '</small>'; ?>
                        <a href="<?php echo wp_nonce_url( admin_url( 'admin.php?page=digitify-booking-settings&action=disconnect_google' ), 'digitify_disconnect_google' ); ?>"
                           class="dg-btn-danger dg-btn-sm"
                           onclick="return confirm('Ontkoppelen?');">Ontkoppelen</a>
                    </div>
                <?php else : ?>
                    <div class="dg-notice-info">
                        <strong>Stap 1:</strong> Maak een OAuth 2.0 Client ID aan via
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a> (type: Web application).<br>
                        <strong>Stap 2:</strong> Voeg deze URI toe als "Authorized redirect URI":<br>
                        <code><?php echo esc_html( admin_url( 'admin.php?page=digitify-booking-settings&action=oauth_callback' ) ); ?></code><br>
                        <strong>Stap 3:</strong> Vul hieronder de Client ID &amp; Secret in en klik op "Koppelen".
                    </div>
                <?php endif; ?>
                <form method="post" action="options.php" class="dg-form">
                    <?php settings_fields( 'digitify_booking_google_group' ); ?>
                    <div class="dg-field-row">
                        <div class="dg-field"><label>Client ID</label>
                            <input type="text" name="digitify_booking_google[client_id]" value="<?php echo esc_attr( $opts_google['client_id'] ?? '' ); ?>"></div>
                        <div class="dg-field"><label>Client Secret</label>
                            <input type="password" name="digitify_booking_google[client_secret]" value="<?php echo esc_attr( $opts_google['client_secret'] ?? '' ); ?>" autocomplete="new-password"></div>
                    </div>
                    <?php submit_button( 'Instellingen opslaan', 'secondary', 'submit', false ); ?>
                </form>
                <?php if ( ! $connected && $auth_url ) : ?>
                    <a href="<?php echo esc_url( $auth_url ); ?>" class="dg-btn-google">
                        <svg viewBox="0 0 24 24" width="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Koppelen met Google
                    </a>
                <?php endif; ?>
            </div>

            <!-- General settings -->
            <div class="dg-card dg-card-wide">
                <h2>⚙️ Algemene instellingen</h2>
                <form method="post" action="options.php" class="dg-form">
                    <?php settings_fields( 'digitify_booking_settings_group' ); ?>
                    <div class="dg-field-row">
                        <div class="dg-field"><label>Afzender naam (e-mail)</label>
                            <input type="text" name="digitify_booking_settings[from_name]" value="<?php echo esc_attr( $opts_settings['from_name'] ?? get_bloginfo( 'name' ) ); ?>"></div>
                        <div class="dg-field"><label>Afzender e-mail</label>
                            <input type="email" name="digitify_booking_settings[from_email]" value="<?php echo esc_attr( $opts_settings['from_email'] ?? get_bloginfo( 'admin_email' ) ); ?>"></div>
                    </div>
                    <div class="dg-field"><label>Notificatie-e-mail (admin)</label>
                        <input type="email" name="digitify_booking_settings[notification_email]" value="<?php echo esc_attr( $opts_settings['notification_email'] ?? get_bloginfo( 'admin_email' ) ); ?>"></div>
                    <div class="dg-field dg-field-check">
                        <label><input type="checkbox" name="digitify_booking_settings[google_meet]" value="1" <?php checked( ! empty( $opts_settings['google_meet'] ) ); ?>>
                            Automatisch Google Meet-link toevoegen aan bevestigde afspraken</label>
                    </div>
                    <?php submit_button( 'Instellingen opslaan', 'primary', 'submit', false ); ?>
                </form>
            </div>

            <!-- Shortcode -->
            <div class="dg-card dg-card-wide">
                <h2>📋 Shortcode gebruik</h2>
                <p>Plaats een boekingswidget op elke pagina of post:</p>
                <ul>
                    <li><code class="dg-code">[digitify_booking]</code> — Toont alle actieve evenementtypen</li>
                    <li><code class="dg-code">[digitify_booking id="1"]</code> — Direct evenementtype met ID 1</li>
                    <li><code class="dg-code">[digitify_booking id="1" inline="1"]</code> — Inline (geen iframe)</li>
                </ul>
            </div>
        </div>
        <?php
    }

    /* ---------------------------------------------------------------
     * Save event type
     * ------------------------------------------------------------- */
    private function save_event_type(): void {
        global $wpdb;
        $data = [
            'title'           => sanitize_text_field( $_POST['title'] ?? '' ),
            'duration'        => max( 5, (int) ( $_POST['duration'] ?? 30 ) ),
            'description'     => sanitize_textarea_field( $_POST['description'] ?? '' ),
            'location'        => sanitize_text_field( $_POST['location'] ?? '' ),
            'buffer_before'   => max( 0, (int) ( $_POST['buffer_before'] ?? 0 ) ),
            'buffer_after'    => max( 0, (int) ( $_POST['buffer_after']  ?? 0 ) ),
            'color'           => sanitize_hex_color( $_POST['color'] ?? '#ff6a00' ) ?: '#ff6a00',
            'google_color_id' => min( 11, max( 0, (int) ( $_POST['google_color_id'] ?? 0 ) ) ),
            'active'          => isset( $_POST['active'] ) ? 1 : 0,
        ];

        $event_id = isset( $_POST['event_id'] ) ? (int) $_POST['event_id'] : 0;
        if ( $event_id ) {
            $wpdb->update( $wpdb->prefix . 'digitify_event_types', $data, [ 'id' => $event_id ] );
        } else {
            $data['slug'] = sanitize_title( $data['title'] ) . '-' . time();
            $wpdb->insert( $wpdb->prefix . 'digitify_event_types', $data );
        }
        wp_redirect( admin_url( 'admin.php?page=digitify-booking-events&saved=1' ) );
        exit;
    }

    /* ---------------------------------------------------------------
     * Save availability
     * ------------------------------------------------------------- */
    private function save_availability(): void {
        global $wpdb;
        $table = $wpdb->prefix . 'digitify_availability';
        $wpdb->query( "TRUNCATE TABLE $table" );
        foreach ( $_POST['days'] ?? [] as $day_num => $day_data ) {
            $wpdb->insert( $table, [
                'day_of_week' => (int) $day_num,
                'start_time'  => sanitize_text_field( $day_data['start'] ?? '09:00' ) . ':00',
                'end_time'    => sanitize_text_field( $day_data['end']   ?? '17:00' ) . ':00',
                'active'      => ! empty( $day_data['active'] ) ? 1 : 0,
            ] );
        }
        wp_redirect( admin_url( 'admin.php?page=digitify-booking-avail&saved=1' ) );
        exit;
    }

    /* ---------------------------------------------------------------
     * Save branding
     * ------------------------------------------------------------- */
    private function save_branding(): void {
        $input = $_POST['branding'] ?? [];
        $data  = [
            'company_name'   => sanitize_text_field( $input['company_name']   ?? '' ),
            'tagline'        => sanitize_text_field( $input['tagline']        ?? '' ),
            'logo_url'       => esc_url_raw( $input['logo_url']               ?? '' ),
            'primary_color'  => sanitize_hex_color( $input['primary_color']   ?? '#ff6a00' ) ?: '#ff6a00',
            'bg_color'       => sanitize_hex_color( $input['bg_color']        ?? '#ffffff' ) ?: '#ffffff',
            'widget_title'   => sanitize_text_field( $input['widget_title']   ?? '' ),
            'widget_subtitle'=> sanitize_text_field( $input['widget_subtitle']?? '' ),
            'timezone_label' => sanitize_text_field( $input['timezone_label'] ?? wp_timezone_string() ),
        ];
        update_option( 'digitify_booking_branding', $data );
        wp_redirect( admin_url( 'admin.php?page=digitify-booking-branding&saved=1' ) );
        exit;
    }
}
