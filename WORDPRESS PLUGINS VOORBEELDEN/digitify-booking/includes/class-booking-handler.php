<?php
defined( 'ABSPATH' ) || exit;

/**
 * Handles AJAX booking requests, slot generation and booking confirmation.
 */
class Digitify_Booking_Handler {

    public function init(): void {
        add_action( 'wp_ajax_digitify_get_slots',            [ $this, 'ajax_get_slots' ] );
        add_action( 'wp_ajax_nopriv_digitify_get_slots',     [ $this, 'ajax_get_slots' ] );
        add_action( 'wp_ajax_digitify_create_booking',       [ $this, 'ajax_create_booking' ] );
        add_action( 'wp_ajax_nopriv_digitify_create_booking', [ $this, 'ajax_create_booking' ] );
        add_action( 'wp_ajax_digitify_cancel_booking',       [ $this, 'ajax_cancel_booking' ] );
        add_action( 'wp_ajax_nopriv_digitify_cancel_booking', [ $this, 'ajax_cancel_booking' ] );
        // Admin-only: confirm or reject a pending booking
        add_action( 'wp_ajax_digitify_confirm_booking',      [ $this, 'ajax_confirm_booking' ] );
        add_action( 'wp_ajax_digitify_reject_booking',       [ $this, 'ajax_reject_booking' ] );
    }

    /* ---------------------------------------------------------------
     * AJAX: available slots for a given date
     * ------------------------------------------------------------- */
    public function ajax_get_slots(): void {
        check_ajax_referer( 'digitify_booking_nonce', 'nonce' );

        $event_type_id = absint( $_POST['event_type_id'] ?? 0 );
        $date          = sanitize_text_field( $_POST['date'] ?? '' );

        if ( ! $event_type_id || ! $date ) {
            wp_send_json_error( 'Ongeldige parameters.' );
        }

        $event_type = $this->get_event_type( $event_type_id );
        if ( ! $event_type ) {
            wp_send_json_error( 'Evenementtype niet gevonden.' );
        }

        $slots = $this->get_available_slots( $event_type, $date );
        wp_send_json_success( $slots );
    }

    /* ---------------------------------------------------------------
     * AJAX: create a booking (status = pending)
     * ------------------------------------------------------------- */
    public function ajax_create_booking(): void {
        check_ajax_referer( 'digitify_booking_nonce', 'nonce' );

        $event_type_id  = absint( $_POST['event_type_id'] ?? 0 );
        $start_time     = sanitize_text_field( $_POST['start_time'] ?? '' );
        $attendee_name  = sanitize_text_field( $_POST['name'] ?? '' );
        $attendee_email = sanitize_email( $_POST['email'] ?? '' );
        $attendee_phone = sanitize_text_field( $_POST['phone'] ?? '' );
        $attendee_notes = sanitize_textarea_field( $_POST['notes'] ?? '' );

        // Validate required fields
        $errors = [];
        if ( ! $event_type_id )                          { $errors[] = 'Evenementtype ontbreekt.'; }
        if ( ! $start_time )                             { $errors[] = 'Tijdslot ontbreekt.'; }
        if ( strlen( trim( $attendee_name ) ) < 2 )     { $errors[] = 'Vul een geldige naam in (min. 2 tekens).'; }
        if ( ! is_email( $attendee_email ) )             { $errors[] = 'Vul een geldig e-mailadres in.'; }
        if ( ! preg_match( '/^[+\d\s\-().]{7,20}$/', $attendee_phone ) ) {
            $errors[] = 'Vul een geldig telefoonnummer in (bijv. +32 470 12 34 56).';
        }
        if ( $errors ) {
            wp_send_json_error( implode( ' ', $errors ) );
        }

        $event_type = $this->get_event_type( $event_type_id );
        if ( ! $event_type ) {
            wp_send_json_error( 'Evenementtype niet gevonden.' );
        }

        // Calculate end time
        $tz       = new DateTimeZone( wp_timezone_string() );
        $start_dt = new DateTime( $start_time, $tz );
        $end_dt   = clone $start_dt;
        $end_dt->modify( '+' . (int) $event_type['duration'] . ' minutes' );

        // Double-check slot is still available
        $date     = $start_dt->format( 'Y-m-d' );
        $slots    = $this->get_available_slots( $event_type, $date );
        $slot_key = $start_dt->format( 'H:i' );

        if ( ! in_array( $slot_key, array_column( $slots, 'time' ), true ) ) {
            wp_send_json_error( 'Dit tijdslot is helaas niet meer beschikbaar. Kies een ander tijdstip.' );
        }

        global $wpdb;
        $uid  = wp_generate_uuid4();
        $data = [
            'event_type_id'  => $event_type_id,
            'attendee_name'  => $attendee_name,
            'attendee_email' => $attendee_email,
            'attendee_phone' => $attendee_phone,
            'attendee_notes' => $attendee_notes,
            'start_time'     => $start_dt->format( 'Y-m-d H:i:s' ),
            'end_time'       => $end_dt->format( 'Y-m-d H:i:s' ),
            'status'         => 'pending',   // Needs admin confirmation
            'uid'            => $uid,
        ];

        $inserted = $wpdb->insert( $wpdb->prefix . 'digitify_bookings', $data );
        if ( ! $inserted ) {
            wp_send_json_error( 'Boeking kon niet worden opgeslagen. Probeer opnieuw.' );
        }

        $booking_id = $wpdb->insert_id;

        // CRM Core event: booking created (pending)
        Digitify_Booking_CRM_Adapter::log(
            $attendee_email,
            'booking_created',
            [
                'booking_id'    => $booking_id,
                'uid'           => $uid,
                'status'        => 'pending',
                'event_type_id' => $event_type_id,
                'event_title'   => $event_type['title'] ?? '',
                'start_time'    => $start_dt->format( 'Y-m-d H:i:s' ),
                'end_time'      => $end_dt->format( 'Y-m-d H:i:s' ),
                'name'          => $attendee_name,
                'phone'         => $attendee_phone,
            ],
            'Nieuwe booking (pending)'
        );

		// Digitify Agenda Pro integration (if installed): create/update an agenda item in the week overview.
		// Pending bookings should appear under "Meeting".
		do_action( 'dap_inbox_event', [
			'source_app' => 'digitify-booking',
			'event_name' => 'booking_created',
			'source_id'  => (string) $booking_id,
			'timestamp'  => current_time('mysql'),
			'email'      => $attendee_email,
			'payload'    => [
				'title'     => sprintf( 'Boeking (pending): %s — %s', (string) ( $event_type['title'] ?? 'Afspraak' ), (string) $attendee_name ),
				'description' => sprintf( "Naam: %s\nE-mail: %s\nTel: %s\nNotities: %s", $attendee_name, $attendee_email, $attendee_phone, $attendee_notes ),
				'start_at'  => $start_dt->format( 'Y-m-d H:i:s' ),
				'end_at'    => $end_dt->format( 'Y-m-d H:i:s' ),
				'status'    => 'pending',
			],
		] );


        // Notify attendee: "in afwachting van bevestiging"
        $this->send_pending_email_to_attendee( $data, $event_type );
        // Notify admin: new booking waiting for confirmation
        $this->send_pending_notification_to_admin( $data, $event_type, $booking_id );

        wp_send_json_success( [
            'booking_id' => $booking_id,
            'uid'        => $uid,
            'status'     => 'pending',
            'start'      => $start_dt->format( 'Y-m-d H:i' ),
            'end'        => $end_dt->format( 'Y-m-d H:i' ),
        ] );
    }

    /* ---------------------------------------------------------------
     * AJAX (admin): confirm a pending booking
     * ------------------------------------------------------------- */
    public function ajax_confirm_booking(): void {
        check_ajax_referer( 'digitify_admin_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Geen toegang.' );
        }

        $booking_id = absint( $_POST['booking_id'] ?? 0 );
        if ( ! $booking_id ) {
            wp_send_json_error( 'Ongeldig boeking-ID.' );
        }

        global $wpdb;
        $booking = $wpdb->get_row( $wpdb->prepare(
            "SELECT b.*, e.title, e.duration, e.location, e.color, e.google_color_id
             FROM {$wpdb->prefix}digitify_bookings b
             LEFT JOIN {$wpdb->prefix}digitify_event_types e ON b.event_type_id = e.id
             WHERE b.id = %d AND b.status = 'pending'",
            $booking_id
        ), ARRAY_A );

        if ( ! $booking ) {
            wp_send_json_error( 'Boeking niet gevonden of al verwerkt.' );
        }

        $tz       = new DateTimeZone( wp_timezone_string() );
        $start_dt = new DateTime( $booking['start_time'], $tz );
        $end_dt   = new DateTime( $booking['end_time'],   $tz );

        $event_type = [
            'id'              => $booking['event_type_id'],
            'title'           => $booking['title'],
            'duration'        => $booking['duration'],
            'location'        => $booking['location'],
            'color'           => $booking['color'],
            'google_color_id' => $booking['google_color_id'],
        ];

        // Create Google Calendar event on confirmation
        $meet_link      = '';
        $google_event_id = '';
        if ( Digitify_Google_Calendar::is_connected() ) {
            $gc_data = Digitify_Google_Calendar::create_event( [
                'attendee_name'  => $booking['attendee_name'],
                'attendee_email' => $booking['attendee_email'],
                'attendee_notes' => $booking['attendee_notes'],
                'start_time'     => $start_dt->format( DateTime::ATOM ),
                'end_time'       => $end_dt->format( DateTime::ATOM ),
            ], $event_type );

            if ( $gc_data && isset( $gc_data['id'] ) ) {
                $google_event_id = $gc_data['id'];
                $meet_link       = $gc_data['hangoutLink'] ?? ( $gc_data['conferenceData']['entryPoints'][0]['uri'] ?? '' );
            }
        }

        $update = [
            'status'         => 'confirmed',
            'google_event_id' => $google_event_id,
            'meet_link'      => $meet_link,
        ];
        $wpdb->update( $wpdb->prefix . 'digitify_bookings', $update, [ 'id' => $booking_id ] );

        // Merge data for email
        $booking = array_merge( $booking, $update );
        $this->send_confirmation_email( $booking, $event_type );

        // CRM Core event: booking confirmed
        Digitify_Booking_CRM_Adapter::log(
            $booking['attendee_email'] ?? '',
            'booking_confirmed',
            [
                'booking_id'      => $booking_id,
                'status'          => 'confirmed',
                'event_type_id'   => $booking['event_type_id'] ?? null,
                'event_title'     => $event_type['title'] ?? '',
                'start_time'      => $booking['start_time'] ?? '',
                'end_time'        => $booking['end_time'] ?? '',
                'google_event_id' => $google_event_id,
                'meet_link'       => $meet_link,
            ],
            'Booking bevestigd'
        );

		// Digitify Agenda Pro integration (if installed): update the agenda item to "Afspraak bevestigd".
		do_action( 'dap_inbox_event', [
			'source_app' => 'digitify-booking',
			'event_name' => 'booking_confirmed',
			'source_id'  => (string) $booking_id,
			'timestamp'  => current_time('mysql'),
			'email'      => (string) ( $booking['attendee_email'] ?? '' ),
			'payload'    => [
				'title'     => sprintf( 'Boeking bevestigd: %s — %s', (string) ( $event_type['title'] ?? 'Afspraak' ), (string) ( $booking['attendee_name'] ?? '' ) ),
				'description' => sprintf( "Naam: %s\nE-mail: %s\nMeet link: %s", (string) ( $booking['attendee_name'] ?? '' ), (string) ( $booking['attendee_email'] ?? '' ), (string) ( $meet_link ?: '' ) ),
				'start_at'  => (string) ( $booking['start_time'] ?? '' ),
				'end_at'    => (string) ( $booking['end_time'] ?? '' ),
				'status'    => 'confirmed',
			],
		] );


        wp_send_json_success( [
            'message'   => 'Boeking bevestigd!',
            'meet_link' => $meet_link,
        ] );
    }

    /* ---------------------------------------------------------------
     * AJAX (admin): reject a pending booking
     * ------------------------------------------------------------- */
    public function ajax_reject_booking(): void {
        check_ajax_referer( 'digitify_admin_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Geen toegang.' );
        }

        $booking_id = absint( $_POST['booking_id'] ?? 0 );
        global $wpdb;
        $booking = $wpdb->get_row( $wpdb->prepare(
            "SELECT b.*, e.title FROM {$wpdb->prefix}digitify_bookings b
             LEFT JOIN {$wpdb->prefix}digitify_event_types e ON b.event_type_id = e.id
             WHERE b.id = %d AND b.status = 'pending'",
            $booking_id
        ), ARRAY_A );

        if ( ! $booking ) {
            wp_send_json_error( 'Boeking niet gevonden.' );
        }

        $wpdb->update( $wpdb->prefix . 'digitify_bookings', [ 'status' => 'cancelled' ], [ 'id' => $booking_id ] );

        // CRM Core event: booking rejected by admin
        Digitify_Booking_CRM_Adapter::log(
            $booking['attendee_email'] ?? '',
            'booking_rejected',
            [
                'booking_id'    => $booking_id,
                'status'        => 'cancelled',
                'event_type_id' => $booking['event_type_id'] ?? null,
                'event_title'   => $booking['title'] ?? '',
                'start_time'    => $booking['start_time'] ?? '',
                'end_time'      => $booking['end_time'] ?? '',
            ],
            'Booking geweigerd'
        );


        // Send rejection email
        $this->send_rejection_email( $booking );

        wp_send_json_success( 'Boeking geweigerd.' );
    }

    /* ---------------------------------------------------------------
     * AJAX: cancel booking via uid (from confirmation email link)
     * ------------------------------------------------------------- */
    public function ajax_cancel_booking(): void {
        check_ajax_referer( 'digitify_booking_nonce', 'nonce' );

        $uid = sanitize_text_field( $_POST['uid'] ?? '' );
        if ( ! $uid ) {
            wp_send_json_error( 'Ongeldige aanvraag.' );
        }

        global $wpdb;
        $booking = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}digitify_bookings WHERE uid = %s AND status != 'cancelled'",
            $uid
        ), ARRAY_A );

        if ( ! $booking ) {
            wp_send_json_error( 'Boeking niet gevonden of al geannuleerd.' );
        }

        // Remove from Google Calendar (only if it was confirmed)
        if ( ! empty( $booking['google_event_id'] ) && Digitify_Google_Calendar::is_connected() ) {
            Digitify_Google_Calendar::delete_event( $booking['google_event_id'] );
        }

        $wpdb->update(
            $wpdb->prefix . 'digitify_bookings',
            [ 'status' => 'cancelled' ],
            [ 'uid' => $uid ]
        );

        // CRM Core event: booking cancelled by attendee
        Digitify_Booking_CRM_Adapter::log(
            $booking['attendee_email'] ?? '',
            'booking_cancelled',
            [
                'booking_id'      => $booking['id'] ?? null,
                'uid'             => $uid,
                'status'          => 'cancelled',
                'event_type_id'   => $booking['event_type_id'] ?? null,
                'start_time'      => $booking['start_time'] ?? '',
                'end_time'        => $booking['end_time'] ?? '',
                'google_event_id' => $booking['google_event_id'] ?? '',
            ],
            'Booking geannuleerd'
        );


        wp_send_json_success( 'Boeking geannuleerd.' );
    }

    /* ---------------------------------------------------------------
     * Slot generation
     * ------------------------------------------------------------- */
    public function get_available_slots( array $event_type, string $date ): array {
        global $wpdb;

        // Parse date in site timezone to avoid server-timezone edge cases.
        $tz = new DateTimeZone( wp_timezone_string() );
        try {
            $date_dt = new DateTime( $date . ' 12:00:00', $tz );
        } catch ( Exception $e ) {
            return [];
        }
        $day_of_week = (int) $date_dt->format( 'w' );

        $availability = $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}digitify_availability WHERE day_of_week = %d AND active = 1",
            $day_of_week
        ), ARRAY_A );

        if ( empty( $availability ) ) {
            return [];
        }

        $tz         = new DateTimeZone( wp_timezone_string() );
        $duration   = (int) $event_type['duration'];
        $buf_before = (int) ( $event_type['buffer_before'] ?? 0 );
        $buf_after  = (int) ( $event_type['buffer_after']  ?? 0 );
        $slot_step  = $duration;

        // Existing confirmed/pending bookings
        $existing = $wpdb->get_results( $wpdb->prepare(
            "SELECT start_time, end_time FROM {$wpdb->prefix}digitify_bookings
             WHERE DATE(start_time) = %s AND status != 'cancelled'",
            $date
        ), ARRAY_A );

        // Google Calendar busy times
        $busy_times = [];
        if ( Digitify_Google_Calendar::is_connected() ) {
            foreach ( Digitify_Google_Calendar::get_busy_times( $date, $date ) as $busy ) {
                $busy_times[] = [
                    'start' => new DateTime( $busy['start'], $tz ),
                    'end'   => new DateTime( $busy['end'],   $tz ),
                ];
            }
        }

        $slots = [];
        $now   = new DateTime( 'now', $tz );

        foreach ( $availability as $window ) {
            $window_start = new DateTime( $date . ' ' . $window['start_time'], $tz );
            $window_end   = new DateTime( $date . ' ' . $window['end_time'],   $tz );
            $cursor       = clone $window_start;

            while ( true ) {
                $slot_start = clone $cursor;
                $slot_end   = clone $cursor;
                $slot_end->modify( '+' . $duration . ' minutes' );

                if ( $slot_end > $window_end ) break;

                // Must be at least 30 min in the future
                $min_future = ( clone $now )->modify( '+30 minutes' );
                if ( $slot_start < $min_future ) {
                    $cursor->modify( '+' . $slot_step . ' minutes' );
                    continue;
                }

                // Check DB overlap
                $overlap = false;
                foreach ( $existing as $booked ) {
                    $b_start = ( new DateTime( $booked['start_time'], $tz ) )->modify( '-' . $buf_before . ' minutes' );
                    $b_end   = ( new DateTime( $booked['end_time'],   $tz ) )->modify( '+' . $buf_after  . ' minutes' );
                    if ( $slot_start < $b_end && $slot_end > $b_start ) {
                        $overlap = true;
                        break;
                    }
                }

                // Check Google Calendar overlap
                if ( ! $overlap ) {
                    foreach ( $busy_times as $busy ) {
                        if ( $slot_start < $busy['end'] && $slot_end > $busy['start'] ) {
                            $overlap = true;
                            break;
                        }
                    }
                }

                if ( ! $overlap ) {
                    $slots[] = [
                        'time'  => $slot_start->format( 'H:i' ),
                        'start' => $slot_start->format( DateTime::ATOM ),
                    ];
                }

                $cursor->modify( '+' . $slot_step . ' minutes' );
            }
        }

        return $slots;
    }

    /* ---------------------------------------------------------------
     * Helpers
     * ------------------------------------------------------------- */
    public function get_event_type( int $id ): array|false {
        global $wpdb;
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}digitify_event_types WHERE id = %d AND active = 1",
            $id
        ), ARRAY_A );
        return $row ?: false;
    }

    public function get_all_event_types(): array {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}digitify_event_types ORDER BY id ASC",
            ARRAY_A
        ) ?: [];
    }

    /* ---------------------------------------------------------------
     * Email helpers
     * ------------------------------------------------------------- */
    private function mail_headers(): array {
        $opts      = get_option( 'digitify_booking_settings', [] );
        $branding  = get_option( 'digitify_booking_branding', [] );
        $site_name = $branding['company_name'] ?? get_bloginfo( 'name' );
        return [
            'Content-Type: text/plain; charset=UTF-8',
            'From: ' . ( $opts['from_name'] ?? $site_name ) . ' <' . ( $opts['from_email'] ?? get_bloginfo( 'admin_email' ) ) . '>',
        ];
    }

    /** Email to attendee: booking received, awaiting confirmation */
    private function send_pending_email_to_attendee( array $booking, array $event_type ): void {
        $branding  = get_option( 'digitify_booking_branding', [] );
        $site_name = $branding['company_name'] ?? get_bloginfo( 'name' );
        $tz        = new DateTimeZone( wp_timezone_string() );
        $start_dt  = new DateTime( $booking['start_time'], $tz );

        $subject  = "Aanvraag ontvangen: {$event_type['title']} op " . $start_dt->format( 'd/m/Y H:i' );
        $message  = "Hallo {$booking['attendee_name']},\n\n";
        $message .= "Bedankt voor je aanvraag! Wij hebben je afspraak goed ontvangen.\n\n";
        $message .= "📅 Evenement:  {$event_type['title']}\n";
        $message .= '🕐 Datum/tijd: ' . $start_dt->format( 'd/m/Y H:i' ) . "\n";
        $message .= "⏱  Duur:       {$event_type['duration']} minuten\n";
        if ( ! empty( $event_type['location'] ) ) { $message .= "📍 Locatie:    {$event_type['location']}\n"; }
        $message .= "\n⏳ Je afspraak wordt zo snel mogelijk bevestigd. Je ontvangt een bevestigingsmail zodra dit gebeurt.\n\n";
        $message .= "Met vriendelijke groeten,\n{$site_name}";

        wp_mail( $booking['attendee_email'], $subject, $message, $this->mail_headers() );
    }

    /** Email to admin: new pending booking needs confirmation */
    private function send_pending_notification_to_admin( array $booking, array $event_type, int $booking_id ): void {
        $opts       = get_option( 'digitify_booking_settings', [] );
        $admin_mail = $opts['notification_email'] ?? get_bloginfo( 'admin_email' );
        $tz         = new DateTimeZone( wp_timezone_string() );
        $start_dt   = new DateTime( $booking['start_time'], $tz );
        $confirm_url = admin_url( 'admin.php?page=digitify-booking&status=pending' );

        $subject  = "⏳ Nieuwe afspraak wacht op bevestiging: {$booking['attendee_name']}";
        $message  = "Nieuwe afspraak ontvangen — bevestiging vereist!\n\n";
        $message .= "Naam:    {$booking['attendee_name']}\n";
        $message .= "E-mail:  {$booking['attendee_email']}\n";
        if ( ! empty( $booking['attendee_phone'] ) ) { $message .= "Tel:     {$booking['attendee_phone']}\n"; }
        $message .= "Type:    {$event_type['title']}\n";
        $message .= 'Datum:   ' . $start_dt->format( 'd/m/Y H:i' ) . "\n";
        if ( ! empty( $booking['attendee_notes'] ) ) { $message .= "Notitie: {$booking['attendee_notes']}\n"; }
        $message .= "\nBevestig of weiger via het beheerplatform:\n{$confirm_url}";

        wp_mail( $admin_mail, $subject, $message, $this->mail_headers() );
    }

    /** Email to attendee: booking confirmed */
    public function send_confirmation_email( array $booking, array $event_type ): void {
        $branding  = get_option( 'digitify_booking_branding', [] );
        $site_name = $branding['company_name'] ?? get_bloginfo( 'name' );
        $tz        = new DateTimeZone( wp_timezone_string() );
        $start_dt  = new DateTime( $booking['start_time'], $tz );
        $cancel_url = home_url( '/?digitify_cancel=' . $booking['uid'] );

        $subject  = "✅ Bevestigd: {$event_type['title']} op " . $start_dt->format( 'd/m/Y H:i' );
        $message  = "Hallo {$booking['attendee_name']},\n\n";
        $message .= "Goed nieuws! Je afspraak is bevestigd:\n\n";
        $message .= "📅 Evenement:  {$event_type['title']}\n";
        $message .= '🕐 Datum/tijd: ' . $start_dt->format( 'd/m/Y H:i' ) . "\n";
        $message .= "⏱  Duur:       {$event_type['duration']} minuten\n";
        if ( ! empty( $event_type['location'] ) ) { $message .= "📍 Locatie:    {$event_type['location']}\n"; }
        if ( ! empty( $booking['meet_link'] ) )   { $message .= "🎥 Google Meet: {$booking['meet_link']}\n"; }
        $message .= "\nWil je annuleren? Klik hier: {$cancel_url}\n\n";
        $message .= "Met vriendelijke groeten,\n{$site_name}";

        wp_mail( $booking['attendee_email'], $subject, $message, $this->mail_headers() );
    }

    /** Email to attendee: booking rejected */
    private function send_rejection_email( array $booking ): void {
        $branding  = get_option( 'digitify_booking_branding', [] );
        $site_name = $branding['company_name'] ?? get_bloginfo( 'name' );
        $tz        = new DateTimeZone( wp_timezone_string() );
        $start_dt  = new DateTime( $booking['start_time'], $tz );

        $subject  = "❌ Afspraak niet beschikbaar: {$booking['title']}";
        $message  = "Hallo {$booking['attendee_name']},\n\n";
        $message .= "Helaas kunnen we je afspraak op " . $start_dt->format( 'd/m/Y H:i' ) . " niet bevestigen.\n\n";
        $message .= "Neem contact met ons op om een ander tijdstip te vinden.\n\n";
        $message .= "Met vriendelijke groeten,\n{$site_name}";

        wp_mail( $booking['attendee_email'], $subject, $message, $this->mail_headers() );
    }
}
