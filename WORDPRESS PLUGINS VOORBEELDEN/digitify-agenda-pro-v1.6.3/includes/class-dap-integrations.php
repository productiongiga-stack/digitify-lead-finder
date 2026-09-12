<?php
if ( ! defined('ABSPATH') ) exit;

/**
 * Integrations / inbound events.
 *
 * Goal:
 * - When another Digitify app emits data (Event Hub style), automatically create an agenda item
 *   in the correct category (type_key).
 * - Provide a REST endpoint so other apps (same WP install) can push events easily.
 */
class DAP_Integrations {
	const OPTION_API_KEY = 'dap_api_key';

	public function register() {
		// 1) Event Hub inbound (apps can do: do_action('digitify_event_hub_emit', $payload))
		add_action( 'digitify_event_hub_emit', [ $this, 'handle_event_hub_emit' ], 10, 1 );

		// 2) Direct WP action inbound (apps can do: do_action('dap_inbox_event', $payload))
		add_action( 'dap_inbox_event', [ $this, 'handle_direct_event' ], 10, 1 );

		// 3) REST inbound (apps can POST JSON)
		add_action( 'rest_api_init', [ $this, 'register_rest' ] );

		// 4) Offerte Wizard (Multi-Company) integration
		// Emits WP hooks via OWMC\\Events\\EventDispatcher:
		//   do_action('owmc_event_quote_created', $event);
		add_action( 'owmc_event_quote_created', [ $this, 'handle_owmc_quote_created' ], 10, 1 );
	}

	/**
	 * Create a "Korte Offerte" agenda item when an Offerte Wizard submission happens.
	 * Requirement: on the day of submission, add an agenda subject in category "Korte Offerte".
	 */
	public function handle_owmc_quote_created( $event ) {
		// Defensive: OWMC might not be loaded / event could be malformed
		$occurred_at = current_time('mysql');
		$payload = [];
		$lead_id = '';
		$company_id = '';
		$email = '';

		if ( is_object( $event ) ) {
			if ( isset( $event->occurredAt ) && self::is_mysql_datetime( $event->occurredAt ) ) {
				$occurred_at = (string) $event->occurredAt;
			}
			if ( isset( $event->payload ) && is_array( $event->payload ) ) {
				$payload = $event->payload;
			}
			if ( isset( $event->entityId ) && $event->entityId ) {
				$lead_id = (string) $event->entityId;
			}
			if ( isset( $event->companyId ) && $event->companyId ) {
				$company_id = (string) $event->companyId;
			}
		}

		if ( empty( $lead_id ) && ! empty( $payload['lead_id'] ) ) $lead_id = (string) $payload['lead_id'];
		if ( empty( $company_id ) && ! empty( $payload['company_id'] ) ) $company_id = (string) $payload['company_id'];
		if ( ! empty( $payload['email'] ) ) $email = sanitize_email( (string) $payload['email'] );

		$diensten = '';
		if ( ! empty( $payload['diensten'] ) && is_array( $payload['diensten'] ) ) {
			$diensten = implode( ', ', array_map( 'sanitize_text_field', $payload['diensten'] ) );
		}

		$total = '';
		if ( isset( $payload['total'] ) && $payload['total'] !== '' && $payload['total'] !== null ) {
			$total = (string) $payload['total'];
		}

		$desc_parts = [];
		if ( $lead_id !== '' ) $desc_parts[] = 'Offerte aanvraag #' . sanitize_text_field( $lead_id );
		if ( $diensten !== '' ) $desc_parts[] = 'Diensten: ' . $diensten;
		if ( $total !== '' ) $desc_parts[] = 'Totaal: ' . sanitize_text_field( $total );
		if ( $company_id !== '' ) $desc_parts[] = 'Company ID: ' . sanitize_text_field( $company_id );
		$description = implode( ' · ', $desc_parts );

		// Dedupe: one follow-up per lead
		$source_app = 'offerte-wizard';
		$source_id  = $lead_id !== '' ? ( 'lead_' . sanitize_text_field( $lead_id ) . '_followup' ) : ( 'owmc_' . wp_generate_uuid4() );

		$type_key = 'followup';
		$color = self::infer_color_for_type( $type_key );

// Fallback dedupe: if source_id is missing, generate a stable one from key fields
if ( $source_id === '' ) {
    $dedupe_base = ($source_app ?: 'app') . '|' . ($event_name ?: 'event') . '|' . ($email ?: '') . '|' . ($start_at ?: $timestamp) . '|' . ($title ?: '');
    $source_id = 'auto_' . substr( md5( $dedupe_base ), 0, 16 );
}


		self::upsert_agenda_item([
			'title' => 'Korte Offerte',
			'description' => $description,
			'start_at' => $occurred_at,
			'end_at' => null,
			'type_key' => $type_key,
			'color' => $color,
			'status' => 'open',
			'contact_email' => $email ?: null,
			'source_app' => $source_app,
			'source_id' => $source_id,
		]);
	}

	public function register_rest() {
		register_rest_route( 'digitify-agenda/v1', '/event', [
			'methods'  => 'POST',
			'callback' => [ $this, 'rest_create_event' ],
			'permission_callback' => [ $this, 'rest_permission' ],
			'args' => [],
		] );
	}

	public function rest_permission( WP_REST_Request $request ) {
		// Allow admins by default
		if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) return true;

		// Optional API key for server-to-server / app-to-app calls
		$opt_key = (string) get_option( self::OPTION_API_KEY, '' );
		$opt_key = trim( $opt_key );
		if ( $opt_key !== '' ) {
			$provided = (string) $request->get_header( 'x-dap-key' );
			if ( $provided === '' ) $provided = (string) $request->get_param( 'api_key' );
			if ( hash_equals( $opt_key, (string) $provided ) ) return true;
		}

		return false;
	}

	public function rest_create_event( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		if ( empty( $data ) || ! is_array( $data ) ) {
			// Also support classic form-encoded calls
			$data = (array) $request->get_params();
		}
		$res = self::ingest_payload( $data );
		if ( is_wp_error( $res ) ) {
			return new WP_REST_Response( [ 'ok' => false, 'message' => $res->get_error_message() ], 400 );
		}
		return new WP_REST_Response( [ 'ok' => true, 'agenda_item_id' => (int) $res ], 200 );
	}

	public function handle_event_hub_emit( $payload ) {
		if ( empty( $payload ) ) return;
		if ( is_object( $payload ) ) $payload = (array) $payload;
		if ( ! is_array( $payload ) ) return;

		// Prevent loops when Agenda emits its own events
		$source_app = isset( $payload['source_app'] ) ? sanitize_key( (string) $payload['source_app'] ) : '';
		if ( $source_app === 'agenda' ) return;

		self::ingest_payload( $payload );
	}

	public function handle_direct_event( $payload ) {
		if ( empty( $payload ) ) return;
		if ( is_object( $payload ) ) $payload = (array) $payload;
		if ( ! is_array( $payload ) ) return;

		// Normalise minimal wrapper
		if ( empty( $payload['timestamp'] ) ) $payload['timestamp'] = current_time('mysql');
		if ( empty( $payload['source_app'] ) ) $payload['source_app'] = 'unknown';
		if ( empty( $payload['event_name'] ) ) $payload['event_name'] = 'event';
		if ( ! isset( $payload['payload'] ) ) $payload['payload'] = $payload;

		self::ingest_payload( $payload );
	}

	/**
	 * Ingest and create/update an agenda item.
	 * Accepts both Event Hub payloads and direct payloads.
	 *
	 * Returns agenda_item_id or WP_Error.
	 */
	public static function ingest_payload( array $payload ) {
		$event_name = isset( $payload['event_name'] ) ? sanitize_key( (string) $payload['event_name'] ) : '';
		$source_app = isset( $payload['source_app'] ) ? sanitize_key( (string) $payload['source_app'] ) : '';
		$source_id  = isset( $payload['source_id'] ) ? sanitize_text_field( (string) $payload['source_id'] ) : '';
		$timestamp  = isset( $payload['timestamp'] ) ? sanitize_text_field( (string) $payload['timestamp'] ) : '';
		$email      = isset( $payload['email'] ) ? sanitize_email( (string) $payload['email'] ) : '';
		$data       = isset( $payload['payload'] ) && is_array( $payload['payload'] ) ? $payload['payload'] : $payload;

		if ( $timestamp === '' ) $timestamp = current_time('mysql');
		if ( $event_name === '' ) $event_name = sanitize_key( (string) ( $data['event_name'] ?? 'event' ) );
		if ( $source_app === '' ) $source_app = sanitize_key( (string) ( $data['source_app'] ?? 'unknown' ) );
		if ( $source_id === '' ) $source_id = sanitize_text_field( (string) ( $data['source_id'] ?? '' ) );

		$type_key = self::map_type_key( $event_name, $source_app, $data );
		$title = self::infer_title( $event_name, $source_app, $data );
		$description = self::infer_description( $event_name, $source_app, $data );
		$start_at = self::infer_start_at( $data, $timestamp );
		$end_at = self::infer_end_at( $data, $start_at );
		$color = self::infer_color_for_type( $type_key );

		// Allow source apps to forward their own status (eg booking pending/confirmed)
		$status = 'open';
		if ( ! empty( $data['status'] ) ) {
			$status = sanitize_key( (string) $data['status'] );
		}

		if ( $title === '' || $start_at === '' ) {
			return new WP_Error( 'dap_invalid', 'Invalid payload (missing title or start_at).' );
		}

		// Create or update (dedupe) by source_app + source_id when available
		$agenda_item_id = self::upsert_agenda_item([
			'title' => $title,
			'description' => $description,
			'start_at' => $start_at,
			'end_at' => $end_at,
			'type_key' => $type_key,
			'color' => $color,
			'status' => $status,
			'contact_email' => $email ?: null,
			'source_app' => $source_app ?: null,
			'source_id' => $source_id ?: null,
		]);

		return $agenda_item_id;
	}

	private static function map_type_key( $event_name, $source_app, array $data ) {
		$event_name = sanitize_key( (string) $event_name );
		$source_app = sanitize_key( (string) $source_app );

		// Explicit override
		if ( ! empty( $data['type_key'] ) ) return sanitize_key( (string) $data['type_key'] );
		if ( ! empty( $data['typeKey'] ) ) return sanitize_key( (string) $data['typeKey'] );

		$map = [
			// Generic
			'meeting' => 'meeting',
			'appointment' => 'meeting',
			'confirmed' => 'confirmed',
			'followup' => 'followup',
			'urgent' => 'urgent',
			'done' => 'done',

			// To-do/checklist
			'todo_created' => 'todo',
			'todo_updated' => 'todo',
			'todo_completed' => 'done',
			'checklist_item_created' => 'todo',

			// Offertes
			'offerte_created' => 'quote',
			'quote_created' => 'quote',
			'invoice_created' => 'quote',

			// Booking
			'booking_created' => 'meeting',
			'booking_pending' => 'meeting',
			'booking_confirmed' => 'confirmed',
			'booking_updated' => 'meeting',
		];

		if ( isset( $map[ $event_name ] ) ) return $map[ $event_name ];

		// Source-app based fallback
		if ( in_array( $source_app, [ 'offerte', 'offerte-maker', 'digitify-offerte-maker' ], true ) ) return 'quote';
		if ( in_array( $source_app, [ 'booking', 'digitify-booking' ], true ) ) {
			// If booking status is known, map pending => meeting, confirmed => confirmed
			$status = sanitize_key( (string) ( $data['status'] ?? '' ) );
			if ( $status === 'pending' ) return 'meeting';
			if ( $status === 'confirmed' ) return 'confirmed';
			return 'meeting';
		}
		if ( in_array( $source_app, [ 'chatbot', 'digitify-chatbot' ], true ) ) return 'followup';

		return 'internal';
	}

	private static function infer_title( $event_name, $source_app, array $data ) {
		// Explicit
		foreach ( [ 'title', 'summary', 'subject', 'name' ] as $k ) {
			if ( ! empty( $data[ $k ] ) ) return sanitize_text_field( (string) $data[ $k ] );
		}

		$label = $event_name ? $event_name : 'event';
		$label = str_replace( '_', ' ', $label );
		$label = ucwords( $label );
		$src = $source_app ? strtoupper( $source_app ) : 'APP';
		return $src . ': ' . $label;
	}

	private static function infer_description( $event_name, $source_app, array $data ) {
		// Explicit
		foreach ( [ 'description', 'message', 'notes' ] as $k ) {
			if ( ! empty( $data[ $k ] ) ) return wp_kses_post( (string) $data[ $k ] );
		}

		// Small structured description (avoid dumping huge payloads)
		$lines = [];
		if ( ! empty( $data['project'] ) ) $lines[] = '<strong>Project:</strong> ' . esc_html( (string) $data['project'] );
		if ( ! empty( $data['client'] ) ) $lines[] = '<strong>Klant:</strong> ' . esc_html( (string) $data['client'] );
		if ( ! empty( $data['email'] ) ) $lines[] = '<strong>E-mail:</strong> ' . esc_html( (string) $data['email'] );
		if ( ! empty( $data['url'] ) ) $lines[] = '<strong>Link:</strong> ' . esc_html( (string) $data['url'] );

		return $lines ? implode( "<br>", $lines ) : '';
	}

	private static function infer_start_at( array $data, $timestamp_fallback ) {
		$candidates = [
			'start_at', 'startAt',
			'due_at', 'dueAt',
			'scheduled_at', 'scheduledAt',
			'occurred_at', 'occurredAt',
			'timestamp',
		];
		foreach ( $candidates as $k ) {
			if ( empty( $data[ $k ] ) ) continue;
			$dt = sanitize_text_field( (string) $data[ $k ] );
			if ( self::is_mysql_datetime( $dt ) ) return $dt;
		}
		$ts = sanitize_text_field( (string) $timestamp_fallback );
		return self::is_mysql_datetime( $ts ) ? $ts : current_time('mysql');
	}

	private static function infer_end_at( array $data, $start_at ) {
		if ( ! empty( $data['end_at'] ) && self::is_mysql_datetime( (string) $data['end_at'] ) ) return sanitize_text_field( (string) $data['end_at'] );
		if ( ! empty( $data['endAt'] ) && self::is_mysql_datetime( (string) $data['endAt'] ) ) return sanitize_text_field( (string) $data['endAt'] );

		// If duration minutes exists, compute an end.
		$mins = null;
		foreach ( [ 'duration_minutes', 'durationMinutes', 'estimated_minutes', 'estimatedMinutes' ] as $k ) {
			if ( isset( $data[ $k ] ) && $data[ $k ] !== '' ) { $mins = (int) $data[ $k ]; break; }
		}
		if ( $mins !== null && $mins > 0 ) {
			$start_ts = strtotime( $start_at );
			if ( $start_ts ) {
				$end_ts = $start_ts + ( $mins * 60 );
				return gmdate( 'Y-m-d H:i:s', $end_ts + ( get_option('gmt_offset') * HOUR_IN_SECONDS ) );
			}
		}

		return null;
	}

	private static function is_mysql_datetime( $s ) {
		return (bool) preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', (string) $s );
	}

	private static function infer_color_for_type( $type_key ) {
		$type_key = sanitize_key( (string) $type_key );
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_types';
		$color = $wpdb->get_var( $wpdb->prepare( "SELECT color FROM $tbl WHERE type_key=%s LIMIT 1", $type_key ) );
		if ( $color ) return sanitize_text_field( (string) $color );
		return '#64748b';
	}

	/**
	 * Upsert into agenda table. Returns id.
	 */
	private static function upsert_agenda_item( array $row ) {
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_agenda_items';

		$now = current_time('mysql');
		$source_app = isset( $row['source_app'] ) ? sanitize_key( (string) $row['source_app'] ) : '';
		$source_id  = isset( $row['source_id'] ) ? sanitize_text_field( (string) $row['source_id'] ) : '';

		$existing_id = 0;
		if ( $source_app !== '' && $source_id !== '' ) {
			// Only if columns exist (older installs)
			$col = $wpdb->get_var( $wpdb->prepare( "SHOW COLUMNS FROM $tbl LIKE %s", 'source_app' ) );
			$col2 = $wpdb->get_var( $wpdb->prepare( "SHOW COLUMNS FROM $tbl LIKE %s", 'source_id' ) );
			if ( $col && $col2 ) {
				$existing_id = (int) $wpdb->get_var( $wpdb->prepare(
					"SELECT id FROM $tbl WHERE source_app=%s AND source_id=%s LIMIT 1",
					$source_app, $source_id
				) );
			}
		}

		$data = [
			'title' => sanitize_text_field( (string) ( $row['title'] ?? '' ) ),
			'description' => wp_kses_post( (string) ( $row['description'] ?? '' ) ),
			'start_at' => sanitize_text_field( (string) ( $row['start_at'] ?? '' ) ),
			'end_at' => ! empty( $row['end_at'] ) ? sanitize_text_field( (string) $row['end_at'] ) : null,
			'type_key' => sanitize_key( (string) ( $row['type_key'] ?? 'internal' ) ),
			'color' => sanitize_text_field( (string) ( $row['color'] ?? '#64748b' ) ),
			'status' => sanitize_key( (string) ( $row['status'] ?? 'open' ) ),
			'contact_email' => ! empty( $row['contact_email'] ) ? sanitize_email( (string) $row['contact_email'] ) : null,
			'assigned_user_id' => null,
			'created_by' => 0,
			'updated_at' => $now,
		];

		// Optional columns
		$cols = $wpdb->get_results( "SHOW COLUMNS FROM $tbl", ARRAY_A );
		$colnames = array_map( fn($c)=> $c['Field'], (array) $cols );
		if ( in_array( 'source_app', $colnames, true ) ) $data['source_app'] = $source_app ?: null;
		if ( in_array( 'source_id', $colnames, true ) ) $data['source_id'] = $source_id ?: null;

		if ( $existing_id > 0 ) {
			$wpdb->update( $tbl, $data, [ 'id' => $existing_id ], null, [ '%d' ] );
			return $existing_id;
		}

		$data['created_at'] = $now;
		$wpdb->insert( $tbl, $data );
		return (int) $wpdb->insert_id;
	}
}
