<?php
if ( ! defined('ABSPATH') ) exit;

class DAP_CRM {
	/**
	 * Log event to CRM Core if available.
	 */
	public static function log_event( $email, $event_type, array $meta = [], $summary = null, $occurred_at = null ) {
		$email = self::normalize_email( $email );
		$event_type = sanitize_key( (string) $event_type );
		$summary = $summary !== null ? sanitize_text_field( (string) $summary ) : null;

		// Preferred: CRM Core public function
		if ( function_exists( 'digitify_crm_log_event' ) && ! empty( $email ) ) {
			return digitify_crm_log_event( $email, $event_type, $meta, $summary, $occurred_at, 'agenda' );
		}

		// Fallback: Event Hub style action for future adapter
		do_action( 'digitify_event_hub_emit', [
			'email' => $email,
			'event_name' => $event_type,
			'source_app' => 'agenda',
			'source_id' => isset($meta['source_id']) ? sanitize_text_field((string)$meta['source_id']) : 'dap',
			'timestamp' => $occurred_at ?: current_time('mysql'),
			'payload' => $meta,
		] );

		return 0;
	}

	public static function upsert_contact( array $data, array $options = [] ) {
		if ( function_exists( 'digitify_crm_upsert_contact' ) ) {
			return digitify_crm_upsert_contact( $data, $options );
		}
		return 0;
	}

	/**
	 * Haal contactgegevens op uit Digitify CRM Core op basis van e-mail.
	 *
	 * Best-effort return:
	 * [ 'email' => '...', 'name' => '...', 'company' => '...', 'phone' => '...' ]
	 */
	public static function get_contact_by_email( $email ) {
		$email = self::normalize_email( $email );
		if ( empty( $email ) ) return null;

		// Meest waarschijnlijke public helpers
		$fn_candidates = [
			'digitify_crm_get_contact_by_email',
			'digitify_crm_get_contact',
			'digitify_crm_contact_get',
		];
		foreach ( $fn_candidates as $fn ) {
			if ( function_exists( $fn ) ) {
				$contact = $fn( $email );
				$norm = self::normalize_contact( $contact );
				if ( $norm ) return $norm;
			}
		}

		// Adapter hook (CRM Core kan dit implementeren)
		$contact = apply_filters( 'digitify_crm_get_contact_by_email', null, $email );
		$norm = self::normalize_contact( $contact );
		if ( $norm ) return $norm;

		// Last resort: try common Digitify CRM Core table names (best-effort, safe if tables do not exist)
		$norm = self::db_fallback_get_contact_by_email( $email );
		if ( $norm ) return $norm;

		return null;
	}

	/**
	 * Zoek contacten in CRM Core (email/naam/bedrijf). Returns array of normalized contacts.
	 */
	public static function search_contacts( $q, $limit = 10 ) {
		$q = sanitize_text_field( (string) $q );
		$limit = max( 1, min( 50, (int) $limit ) );
		if ( $q === '' ) return [];

		$fn_candidates = [
			'digitify_crm_search_contacts',
			'digitify_crm_contacts_search',
		];
		foreach ( $fn_candidates as $fn ) {
			if ( function_exists( $fn ) ) {
				$rows = $fn( $q, $limit );
				return self::normalize_contacts_list( $rows );
			}
		}

		$rows = apply_filters( 'digitify_crm_search_contacts', [], $q, $limit );
		$norm = self::normalize_contacts_list( $rows );
		if ( ! empty( $norm ) ) return $norm;

		// Last resort: best-effort DB fallback
		return self::db_fallback_search_contacts( $q, $limit );
	}

	private static function db_fallback_tables() {
		global $wpdb;
		return [
			$wpdb->prefix . 'digitify_crm_contacts',
			$wpdb->prefix . 'digitify_crm_contact',
			$wpdb->prefix . 'dcrm_contacts',
			$wpdb->prefix . 'digitify_contacts',
		];
	}

	private static function db_table_exists( $table ) {
		global $wpdb;
		$found = $wpdb->get_var( $wpdb->prepare( "SHOW TABLES LIKE %s", $table ) );
		return ! empty( $found );
	}

	private static function db_columns( $table ) {
		global $wpdb;
		$cols = [];
		$rows = $wpdb->get_results( "SHOW COLUMNS FROM {$table}", ARRAY_A );
		foreach ( (array) $rows as $r ) {
			if ( ! empty( $r['Field'] ) ) $cols[] = $r['Field'];
		}
		return $cols;
	}

	private static function db_first_existing_column( array $cols, array $candidates ) {
		foreach ( $candidates as $c ) {
			if ( in_array( $c, $cols, true ) ) return $c;
		}
		return null;
	}

	private static function db_fallback_get_contact_by_email( $email ) {
		global $wpdb;
		foreach ( self::db_fallback_tables() as $table ) {
			if ( ! self::db_table_exists( $table ) ) continue;
			$cols = self::db_columns( $table );
			$email_col = self::db_first_existing_column( $cols, [ 'email', 'contact_email', 'email_address' ] );
			if ( ! $email_col ) continue;
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE {$email_col}=%s LIMIT 1", $email ), ARRAY_A );
			$norm = self::normalize_contact( $row );
			if ( $norm ) return $norm;
		}
		return null;
	}

	private static function db_fallback_search_contacts( $q, $limit ) {
		global $wpdb;
		$q = sanitize_text_field( (string) $q );
		$limit = max( 1, min( 50, (int) $limit ) );
		if ( $q === '' ) return [];
		$like = '%' . $wpdb->esc_like( $q ) . '%';

		foreach ( self::db_fallback_tables() as $table ) {
			if ( ! self::db_table_exists( $table ) ) continue;
			$cols = self::db_columns( $table );
			$email_col = self::db_first_existing_column( $cols, [ 'email', 'contact_email', 'email_address' ] );
			$name_col = self::db_first_existing_column( $cols, [ 'name', 'full_name', 'display_name' ] );
			$company_col = self::db_first_existing_column( $cols, [ 'company', 'company_name', 'organisation', 'organization' ] );
			$first_col = self::db_first_existing_column( $cols, [ 'first_name', 'firstname', 'first' ] );
			$last_col  = self::db_first_existing_column( $cols, [ 'last_name', 'lastname', 'last' ] );

			$where = [];
			$args = [];
			if ( $email_col ) { $where[] = "{$email_col} LIKE %s"; $args[] = $like; }
			if ( $name_col )  { $where[] = "{$name_col} LIKE %s"; $args[] = $like; }
			if ( $company_col ){ $where[] = "{$company_col} LIKE %s"; $args[] = $like; }
			if ( $first_col ) { $where[] = "{$first_col} LIKE %s"; $args[] = $like; }
			if ( $last_col )  { $where[] = "{$last_col} LIKE %s"; $args[] = $like; }
			if ( empty( $where ) ) continue;

			$sql = "SELECT * FROM {$table} WHERE (" . implode( ' OR ', $where ) . ") ORDER BY 1 DESC LIMIT " . (int) $limit;
			$rows = $wpdb->get_results( $wpdb->prepare( $sql, $args ), ARRAY_A );
			$norm = self::normalize_contacts_list( $rows );
			if ( ! empty( $norm ) ) return $norm;
		}
		return [];
	}

	private static function normalize_contacts_list( $rows ) {
		$out = [];
		if ( ! is_array( $rows ) ) return $out;
		foreach ( $rows as $r ) {
			$norm = self::normalize_contact( $r );
			if ( $norm && ! empty( $norm['email'] ) ) $out[] = $norm;
		}
		return $out;
	}

	private static function normalize_contact( $contact ) {
		if ( empty( $contact ) ) return null;
		if ( is_object( $contact ) ) $contact = (array) $contact;
		if ( ! is_array( $contact ) ) return null;

		$email = '';
		foreach ( [ 'email', 'contact_email', 'email_address' ] as $k ) {
			if ( ! empty( $contact[ $k ] ) ) { $email = $contact[ $k ]; break; }
		}
		$email = self::normalize_email( $email );
		if ( empty( $email ) ) return null;

		$name = '';
		foreach ( [ 'name', 'full_name', 'display_name' ] as $k ) {
			if ( ! empty( $contact[ $k ] ) ) { $name = $contact[ $k ]; break; }
		}
		if ( empty( $name ) ) {
			$first = $contact['first_name'] ?? '';
			$last  = $contact['last_name'] ?? '';
			$name = trim( sanitize_text_field( $first . ' ' . $last ) );
		}
		$name = $name ? sanitize_text_field( $name ) : '';

		$company = '';
		foreach ( [ 'company', 'company_name', 'organisation', 'organization' ] as $k ) {
			if ( ! empty( $contact[ $k ] ) ) { $company = $contact[ $k ]; break; }
		}
		$company = $company ? sanitize_text_field( $company ) : '';

		$phone = '';
		foreach ( [ 'phone', 'phone_number', 'tel', 'mobile' ] as $k ) {
			if ( ! empty( $contact[ $k ] ) ) { $phone = $contact[ $k ]; break; }
		}
		$phone = $phone ? sanitize_text_field( $phone ) : '';

		return [
			'email' => $email,
			'name' => $name,
			'company' => $company,
			'phone' => $phone,
		];
	}

	public static function normalize_email( $email ) {
		$email = sanitize_email( (string) $email );
		return $email ?: '';
	}
}
