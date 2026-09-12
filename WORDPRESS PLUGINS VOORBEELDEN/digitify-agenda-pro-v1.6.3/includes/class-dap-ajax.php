<?php
if ( ! defined('ABSPATH') ) exit;

class DAP_Ajax {
	public function register() {
		add_action( 'wp_ajax_dap_bootstrap', [ $this, 'bootstrap' ] );
		add_action( 'wp_ajax_dap_get_week', [ $this, 'get_week' ] );
		add_action( 'wp_ajax_dap_items_between', [ $this, 'items_between' ] );
		add_action( 'wp_ajax_dap_item_create', [ $this, 'item_create' ] );
		add_action( 'wp_ajax_dap_item_update', [ $this, 'item_update' ] );
		add_action( 'wp_ajax_dap_item_delete', [ $this, 'item_delete' ] );

		add_action( 'wp_ajax_dap_todo_list', [ $this, 'todo_list' ] );
		add_action( 'wp_ajax_dap_todo_create', [ $this, 'todo_create' ] );
		add_action( 'wp_ajax_dap_todo_update', [ $this, 'todo_update' ] );
		add_action( 'wp_ajax_dap_todo_toggle', [ $this, 'todo_toggle' ] );
		add_action( 'wp_ajax_dap_todo_delete', [ $this, 'todo_delete' ] );

		add_action( 'wp_ajax_dap_todo_checklist_list', [ $this, 'todo_checklist_list' ] );
		add_action( 'wp_ajax_dap_todo_checklist_add', [ $this, 'todo_checklist_add' ] );
		add_action( 'wp_ajax_dap_todo_checklist_toggle', [ $this, 'todo_checklist_toggle' ] );
		add_action( 'wp_ajax_dap_todo_checklist_update', [ $this, 'todo_checklist_update' ] );
		add_action( 'wp_ajax_dap_todo_checklist_delete', [ $this, 'todo_checklist_delete' ] );

		add_action( 'wp_ajax_dap_types_list', [ $this, 'types_list' ] );
		add_action( 'wp_ajax_dap_type_save', [ $this, 'type_save' ] );
		add_action( 'wp_ajax_dap_type_delete', [ $this, 'type_delete' ] );

		add_action( 'wp_ajax_dap_send_email', [ $this, 'send_email' ] );

		// CRM Core helpers (optional)
		add_action( 'wp_ajax_dap_crm_lookup', [ $this, 'crm_lookup' ] );
		add_action( 'wp_ajax_dap_crm_search', [ $this, 'crm_search' ] );
	}

	public function crm_lookup() {
		$this->require_ajax();
		$email = sanitize_email( $_POST['email'] ?? '' );
		$email = DAP_CRM::normalize_email( $email );
		if ( empty( $email ) ) wp_send_json_success([ 'contact' => null ]);
		$contact = DAP_CRM::get_contact_by_email( $email );
		wp_send_json_success([ 'contact' => $contact ]);
	}

	public function crm_search() {
		$this->require_ajax();
		$q = sanitize_text_field( $_POST['q'] ?? '' );
		$limit = isset($_POST['limit']) ? (int)$_POST['limit'] : 10;
		$rows = DAP_CRM::search_contacts( $q, $limit );
		wp_send_json_success([ 'contacts' => $rows ]);
	}

	private function require_ajax() {
		if ( ! current_user_can('manage_options') ) wp_send_json_error( [ 'message' => 'forbidden' ], 403 );
		check_ajax_referer( 'dap_nonce', 'nonce' );
	}

	private function week_key_from_date( $ts ) {
		$year = (int) wp_date('o', $ts);
		$week = (int) wp_date('W', $ts);
		return sprintf('%d-W%02d', $year, $week);
	}

	private function valid_week_key( $week_key ) {
		return (bool) preg_match('/^\d{4}-W\d{2}$/', (string)$week_key);
	}

	private function week_range_from_key( $week_key ) {
		if ( ! $this->valid_week_key($week_key) ) return [ 'title' => $week_key, 'range' => '' ];
		list($y, $w) = explode('-W', $week_key);
		$y = (int)$y; $w = (int)$w;
		$dt = new DateTime();
		$dt->setISODate($y, $w, 1);
		$monday = $dt->format('Y-m-d');
		$dt->setISODate($y, $w, 7);
		$sunday = $dt->format('Y-m-d');
		$mon_ts = strtotime($monday . ' 00:00:00');
		$sun_ts = strtotime($sunday . ' 00:00:00');
		return [
			'title' => sprintf( __('Week %d', 'digitify-agenda-pro'), $w ),
			'range' => wp_date('d M Y', $mon_ts) . ' – ' . wp_date('d M Y', $sun_ts),
			'monday' => $monday,
			'sunday' => $sunday,
		];
	}

	public function bootstrap() {
		$this->require_ajax();
		$types = $this->get_types();

        wp_send_json_success(
        [ 'types' => $types ]);
	}

	private function get_types() {
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_types';
		$rows = $wpdb->get_results("SELECT type_key,label,color,is_active,sort_order FROM $tbl ORDER BY sort_order ASC, id ASC", ARRAY_A);
		return $rows ?: [];
	}

	public function types_list() {
		$this->require_ajax();

        wp_send_json_success(
        [ 'types' => $this->get_types() ]);
	}

	public function type_save() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_types';

		$type_key = sanitize_key( $_POST['typeKey'] ?? '' );
		$label = sanitize_text_field( $_POST['label'] ?? '' );
		$color = sanitize_text_field( $_POST['color'] ?? '' );
		$is_active = isset($_POST['isActive']) ? (int)$_POST['isActive'] : 1;
		$sort_order = isset($_POST['sortOrder']) ? (int)$_POST['sortOrder'] : 0;

		if ( empty($type_key) || empty($label) ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		if ( empty($color) ) $color = '#64748b';

		$exists = $wpdb->get_var( $wpdb->prepare("SELECT id FROM $tbl WHERE type_key=%s", $type_key ) );
		if ( $exists ) {
			$wpdb->update(
				$tbl,
				[
					'label' => $label,
					'color' => $color,
					'is_active' => $is_active ? 1 : 0,
					'sort_order' => $sort_order,
				],
				[ 'type_key' => $type_key ],
				[ '%s','%s','%d','%d' ],
				[ '%s' ]
			);
		} else {
			$wpdb->insert(
				$tbl,
				[
					'type_key' => $type_key,
					'label' => $label,
					'color' => $color,
					'is_active' => $is_active ? 1 : 0,
					'sort_order' => $sort_order,
				],
				[ '%s','%s','%s','%d','%d' ]
			);
		}

        wp_send_json_success(
        [ 'types' => $this->get_types() ]);
	}

	public function type_delete() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_types';
		$type_key = sanitize_key( $_POST['typeKey'] ?? '' );
		if ( empty($type_key) ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		// Avoid deleting core keys used by UI
		if ( in_array($type_key, [ 'meeting','todo' ], true) ) wp_send_json_error([ 'message'=>'locked' ], 400);
		$wpdb->delete($tbl, [ 'type_key' => $type_key ], [ '%s' ]);

        wp_send_json_success(
        [ 'types' => $this->get_types() ]);
	}

	public function get_week() {
		$this->require_ajax();

		$week_key = sanitize_text_field( $_POST['weekKey'] ?? '' );
		if ( ! $this->valid_week_key($week_key) ) wp_send_json_error([ 'message' => 'invalid_week' ], 400);

		$range = $this->week_range_from_key($week_key);
		$items = $this->get_items_between( $range['monday'] . ' 00:00:00', $range['sunday'] . ' 23:59:59' );
		$todos = $this->get_todos_between( $range['monday'] . ' 00:00:00', $range['sunday'] . ' 23:59:59' );

        wp_send_json_success(
        [
			'weekKey' => $week_key,
			'weekTitle' => $range['title'],
			'weekRange' => $range['range'],
			'items' => $items,
			'todos' => $todos,
			'types' => $this->get_types(),
		]);
	}

	public function items_between() {
		$this->require_ajax();
		$from = sanitize_text_field($_POST['from'] ?? '');
		$to = sanitize_text_field($_POST['to'] ?? '');
		if ( empty($from) || empty($to) ) wp_send_json_error([ 'message' => 'invalid' ], 400);
		$from_dt = $from . ' 00:00:00';
		$to_dt = $to . ' 23:59:59';
		$items = $this->get_items_between($from_dt, $to_dt);

        wp_send_json_success(
        [ 'items' => $items, 'types' => $this->get_types() ]);
	}

	private function get_items_between( $from, $to ) {
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_agenda_items';
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $tbl WHERE start_at >= %s AND start_at <= %s ORDER BY start_at ASC, id DESC",
			$from, $to
		), ARRAY_A );
		return $rows ?: [];
	}

	private function get_todos_between( $from, $to ) {
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_todos';
		$tbl_chk = $wpdb->prefix . 'dap_todo_checklist';
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $tbl WHERE (due_at IS NULL OR (due_at >= %s AND due_at <= %s)) ORDER BY status ASC, due_at ASC, id DESC",
			$from, $to
		), ARRAY_A );
		$rows = $rows ?: [];
		if ( empty($rows) ) return [];

		// Enrich todos with checklist minute totals (preferred for display/agenda totals)
		$ids = array_map( fn($r)=> (int)($r['id'] ?? 0), $rows );
		$ids = array_values(array_filter($ids));
		if ( ! empty($ids) ) {
			$placeholders = implode(',', array_fill(0, count($ids), '%d'));
			$q = $wpdb->prepare(
				"SELECT todo_id,
					SUM(COALESCE(estimated_minutes,0)) AS total_minutes,
					SUM(CASE WHEN is_done=1 THEN COALESCE(estimated_minutes,0) ELSE 0 END) AS done_minutes
				 FROM $tbl_chk
				 WHERE todo_id IN ($placeholders)
				 GROUP BY todo_id",
				...$ids
			);
			$sums = $wpdb->get_results($q, ARRAY_A);
			$map = [];
			foreach ( ($sums ?: []) as $s ) {
				$map[(int)$s['todo_id']] = [
					'total' => (int) ($s['total_minutes'] ?? 0),
					'done'  => (int) ($s['done_minutes'] ?? 0),
				];
			}
			foreach ( $rows as &$r ) {
				$tid = (int) ($r['id'] ?? 0);
				$tot = $map[$tid]['total'] ?? 0;
				$done = $map[$tid]['done'] ?? 0;
				$r['checklist_minutes_total'] = $tot;
				$r['checklist_minutes_done'] = $done;
			}
			unset($r);
		}

		return $rows;
	}

	public function item_create() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_agenda_items';

		$title = sanitize_text_field($_POST['title'] ?? '');
		$description = wp_kses_post($_POST['description'] ?? '');
		$start_at = sanitize_text_field($_POST['startAt'] ?? '');
		$end_at = sanitize_text_field($_POST['endAt'] ?? '');
		$type_key = sanitize_key($_POST['typeKey'] ?? 'meeting');
		$color = sanitize_text_field($_POST['color'] ?? '');
		$status = sanitize_key($_POST['status'] ?? 'open');
		$contact_email = sanitize_email($_POST['email'] ?? '');
		$assigned = isset($_POST['assignedUserId']) ? (int)$_POST['assignedUserId'] : 0;

		if ( empty($title) || empty($start_at) ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		if ( empty($color) ) $color = $this->infer_color_for_type($type_key);

		$now = current_time('mysql');
		$wpdb->insert($tbl, [
			'title' => $title,
			'description' => $description,
			'start_at' => $start_at,
			'end_at' => $end_at ?: null,
			'type_key' => $type_key ?: 'meeting',
			'color' => $color,
			'status' => $status ?: 'open',
			'contact_email' => $contact_email ?: null,
			'assigned_user_id' => $assigned ?: null,
			'created_by' => get_current_user_id(),
			'created_at' => $now,
			'updated_at' => $now,
		], [ '%s','%s','%s','%s','%s','%s','%s','%s','%d','%d','%s','%s' ]);

		$item_id = (int) $wpdb->insert_id;

		$this->crm_log_for_item( 'agenda_item_created', $item_id, $contact_email, [
			'title' => $title,
			'start_at' => $start_at,
			'end_at' => $end_at ?: null,
			'type' => $type_key,
			'status' => $status,
			'color' => $color,
		] );

        wp_send_json_success(
        [ 'itemId' => $item_id ]);
	}

	public function item_update() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_agenda_items';

		$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
		if ( $id <= 0 ) wp_send_json_error([ 'message'=>'invalid' ], 400);

		$existing = $wpdb->get_row( $wpdb->prepare("SELECT * FROM $tbl WHERE id=%d", $id), ARRAY_A );
		if ( ! $existing ) wp_send_json_error([ 'message'=>'not_found' ], 404);

		$title = sanitize_text_field($_POST['title'] ?? $existing['title']);
		$description = wp_kses_post($_POST['description'] ?? $existing['description']);
		$start_at = sanitize_text_field($_POST['startAt'] ?? $existing['start_at']);
		$end_at = sanitize_text_field($_POST['endAt'] ?? $existing['end_at']);
		$type_key = sanitize_key($_POST['typeKey'] ?? $existing['type_key']);
		$color = sanitize_text_field($_POST['color'] ?? $existing['color']);
		$status = sanitize_key($_POST['status'] ?? $existing['status']);
		$contact_email = sanitize_email($_POST['email'] ?? $existing['contact_email']);
		$assigned = isset($_POST['assignedUserId']) ? (int)$_POST['assignedUserId'] : (int)$existing['assigned_user_id'];

		if ( empty($title) || empty($start_at) ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		if ( empty($color) ) $color = $this->infer_color_for_type($type_key);

		$wpdb->update($tbl, [
			'title' => $title,
			'description' => $description,
			'start_at' => $start_at,
			'end_at' => $end_at ?: null,
			'type_key' => $type_key,
			'color' => $color,
			'status' => $status,
			'contact_email' => $contact_email ?: null,
			'assigned_user_id' => $assigned ?: null,
			'updated_at' => current_time('mysql'),
		], [ 'id' => $id ], [ '%s','%s','%s','%s','%s','%s','%s','%s','%d','%s' ], [ '%d' ]);

		$this->crm_log_for_item( 'agenda_item_updated', $id, $contact_email, [
			'title' => $title,
			'start_at' => $start_at,
			'end_at' => $end_at ?: null,
			'type' => $type_key,
			'status' => $status,
			'color' => $color,
		] );

        wp_send_json_success(
        [ 'ok' => true ]);
	}

	public function item_delete() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_agenda_items';

		$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
		if ( $id <= 0 ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		$item = $wpdb->get_row( $wpdb->prepare("SELECT * FROM $tbl WHERE id=%d", $id), ARRAY_A );
		if ( ! $item ) wp_send_json_error([ 'message'=>'not_found' ], 404);

		$wpdb->delete($tbl, [ 'id' => $id ], [ '%d' ]);

		$this->crm_log_for_item( 'agenda_item_deleted', $id, $item['contact_email'], [
			'title' => $item['title'],
			'start_at' => $item['start_at'],
			'end_at' => $item['end_at'],
			'type' => $item['type_key'],
			'status' => $item['status'],
			'color' => $item['color'],
		] );

        wp_send_json_success(
        [ 'ok' => true ]);
	}

	private function infer_color_for_type( $type_key ) {
		$type_key = sanitize_key((string)$type_key);
		$types = $this->get_types();
		foreach ( $types as $t ) {
			if ( $t['type_key'] === $type_key ) return (string)$t['color'];
		}
		return '#64748b';
	}

	private function crm_log_for_item( $event_type, $item_id, $email, array $meta ) {
		$email = DAP_CRM::normalize_email( $email );
		if ( empty($email) ) return;
		$meta['agenda_item_id'] = (int)$item_id;
		$meta['source_id'] = 'agenda_item:' . (int)$item_id;
		$summary = isset($meta['title']) ? (string)$meta['title'] : $event_type;
		DAP_CRM::log_event( $email, $event_type, $meta, $summary, current_time('mysql') );
	}

	public function todo_list() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_todos';
		$rows = $wpdb->get_results("SELECT * FROM $tbl ORDER BY status ASC, due_at ASC, id DESC", ARRAY_A);

        wp_send_json_success(
        [ 'todos' => $rows ?: [], 'types' => $this->get_types() ]);
	}

	public function todo_create() {
		$client_email = isset($_POST['client_email']) ? sanitize_email($_POST['client_email']) : '';
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_todos';

		$title = sanitize_text_field($_POST['title'] ?? '');
		// Minutes-first. Keep hours for backward compatibility.
		$estimated_minutes = isset($_POST['estimatedMinutes']) ? (int) $_POST['estimatedMinutes'] : null;
		$estimated_hours = isset($_POST['estimatedHours']) ? (float) $_POST['estimatedHours'] : 0;
		if ( $estimated_minutes === null ) {
			$estimated_minutes = (int) round( max(0, $estimated_hours) * 60 );
		}
		if ( $estimated_minutes < 0 ) $estimated_minutes = 0;
		if ( $estimated_minutes > 999999 ) $estimated_minutes = 999999;
		$estimated_hours = round( $estimated_minutes / 60, 2 );
		$notes = wp_kses_post($_POST['notes'] ?? '');
		$due_at = sanitize_text_field($_POST['dueAt'] ?? '');
		$priority = sanitize_key($_POST['priority'] ?? 'normal');
		$status = sanitize_key($_POST['status'] ?? 'open');
		$type_key = sanitize_key($_POST['typeKey'] ?? 'todo');
		$color = sanitize_text_field($_POST['color'] ?? '');
		$contact_email = sanitize_email($_POST['email'] ?? '');
		$agenda_item_id = isset($_POST['agendaItemId']) ? (int)$_POST['agendaItemId'] : 0;

		if ( empty($title) ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		// (hours validation kept only for legacy inputs)
		if ( $estimated_hours < 0 ) $estimated_hours = 0;
		if ( $estimated_hours > 9999 ) $estimated_hours = 9999;
		if ( empty($color) ) $color = $this->infer_color_for_type($type_key);
		$now = current_time('mysql');

		$wpdb->insert($tbl, [
			'title' => $title,
			'estimated_minutes' => $estimated_minutes,
			'estimated_hours' => $estimated_hours,
			'notes' => $notes,
			'due_at' => $due_at ?: null,
			'priority' => $priority ?: 'normal',
			'status' => $status ?: 'open',
			'type_key' => $type_key ?: 'todo',
			'color' => $color,
			'contact_email' => $contact_email ?: null,
			'agenda_item_id' => $agenda_item_id ?: null,
			'assigned_user_id' => null,
			'created_by' => get_current_user_id(),
			'created_at' => $now,
			'updated_at' => $now,
		], [ '%s','%d','%f','%s','%s','%s','%s','%s','%s','%s','%d','%d','%d','%s','%s' ]);

		$todo_id = (int)$wpdb->insert_id;

		$email = DAP_CRM::normalize_email($contact_email);
		if ( $email ) {
			DAP_CRM::log_event( $email, 'todo_created', [
				'todo_id' => $todo_id,
				'title' => $title,
				'estimated_minutes' => $estimated_minutes,
				'estimated_hours' => $estimated_hours,
				'due_at' => $due_at ?: null,
				'priority' => $priority,
				'status' => $status,
				'color' => $color,
				'agenda_item_id' => $agenda_item_id ?: null,
				'source_id' => 'todo:' . $todo_id,
			], $title, current_time('mysql') );
		}

        wp_send_json_success(
        [ 'todoId' => $todo_id ]);
	}

	public function todo_update() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_todos';

		$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
		if ( $id <= 0 ) wp_send_json_error([ 'message'=>'invalid' ], 400);

		$existing = $wpdb->get_row( $wpdb->prepare("SELECT * FROM $tbl WHERE id=%d", $id), ARRAY_A );
		if ( ! $existing ) wp_send_json_error([ 'message'=>'not_found' ], 404);

		$title = sanitize_text_field($_POST['title'] ?? $existing['title']);
		$estimated_minutes = isset($_POST['estimatedMinutes']) ? (int) $_POST['estimatedMinutes'] : null;
		$estimated_hours = isset($_POST['estimatedHours']) ? (float) $_POST['estimatedHours'] : (float) ($existing['estimated_hours'] ?? 0);
		if ( $estimated_minutes === null ) {
			$estimated_minutes = (int) ($existing['estimated_minutes'] ?? 0);
			if ( $estimated_minutes <= 0 && $estimated_hours > 0 ) {
				$estimated_minutes = (int) round( $estimated_hours * 60 );
			}
		}
		if ( $estimated_minutes < 0 ) $estimated_minutes = 0;
		if ( $estimated_minutes > 999999 ) $estimated_minutes = 999999;
		$estimated_hours = round( $estimated_minutes / 60, 2 );
		$notes = wp_kses_post($_POST['notes'] ?? $existing['notes']);
		$due_at = sanitize_text_field($_POST['dueAt'] ?? $existing['due_at']);
		$priority = sanitize_key($_POST['priority'] ?? $existing['priority']);
		$status = sanitize_key($_POST['status'] ?? $existing['status']);
		$type_key = sanitize_key($_POST['typeKey'] ?? $existing['type_key']);
		$color = sanitize_text_field($_POST['color'] ?? $existing['color']);
		$contact_email = sanitize_email($_POST['email'] ?? $existing['contact_email']);
		$agenda_item_id = isset($_POST['agendaItemId']) ? (int) $_POST['agendaItemId'] : (int) ($existing['agenda_item_id'] ?? 0);

		if ( empty($title) ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		if ( $estimated_hours < 0 ) $estimated_hours = 0;
		if ( $estimated_hours > 9999 ) $estimated_hours = 9999;
		if ( empty($color) ) $color = $this->infer_color_for_type($type_key);

		$wpdb->update($tbl, [
			'title' => $title,
			'estimated_minutes' => $estimated_minutes,
			'estimated_hours' => $estimated_hours,
			'notes' => $notes,
			'due_at' => $due_at ?: null,
			'priority' => $priority ?: 'normal',
			'status' => $status ?: 'open',
			'type_key' => $type_key ?: 'todo',
			'color' => $color,
			'contact_email' => $contact_email ?: null,
			'agenda_item_id' => $agenda_item_id ?: null,
			'updated_at' => current_time('mysql'),
		], [ 'id' => $id ], [ '%s','%d','%f','%s','%s','%s','%s','%s','%s','%s','%d','%s' ], [ '%d' ] );

		$email = DAP_CRM::normalize_email($contact_email);
		if ( $email ) {
			DAP_CRM::log_event( $email, 'todo_updated', [
				'todo_id' => $id,
				'title' => $title,
				'estimated_minutes' => $estimated_minutes,
				'estimated_hours' => $estimated_hours,
				'due_at' => $due_at ?: null,
				'priority' => $priority,
				'status' => $status,
				'source_id' => 'todo:' . $id,
			], $title, current_time('mysql') );
		}

        wp_send_json_success(
        [ 'ok' => true ]);
	}

	public function todo_toggle() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_todos';
		$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
		$status = sanitize_key($_POST['status'] ?? 'open');
		if ( $id <= 0 ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		$todo = $wpdb->get_row( $wpdb->prepare("SELECT * FROM $tbl WHERE id=%d", $id), ARRAY_A );
		if ( ! $todo ) wp_send_json_error([ 'message'=>'not_found' ], 404);
		$wpdb->update($tbl, [ 'status' => $status, 'updated_at' => current_time('mysql') ], [ 'id' => $id ], [ '%s','%s' ], [ '%d' ]);

		$email = DAP_CRM::normalize_email($todo['contact_email']);
		if ( $email ) {
			DAP_CRM::log_event( $email, $status === 'done' ? 'todo_completed' : 'todo_updated', [
				'todo_id' => $id,
				'title' => $todo['title'],
				'status' => $status,
				'source_id' => 'todo:' . $id,
			], $todo['title'], current_time('mysql') );
		}

        wp_send_json_success(
        [ 'ok' => true ]);
	}

	public function todo_delete() {
		$this->require_ajax();
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_todos';
		$tbl_chk = $wpdb->prefix . 'dap_todo_checklist';
		$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
		if ( $id <= 0 ) wp_send_json_error([ 'message'=>'invalid' ], 400);
		$todo = $wpdb->get_row( $wpdb->prepare("SELECT * FROM $tbl WHERE id=%d", $id), ARRAY_A );
		if ( ! $todo ) wp_send_json_error([ 'message'=>'not_found' ], 404);
		// Clean up checklist items
		$wpdb->delete($tbl_chk, [ 'todo_id' => $id ], [ '%d' ]);
		$wpdb->delete($tbl, [ 'id' => $id ], [ '%d' ]);

		$email = DAP_CRM::normalize_email($todo['contact_email']);
		if ( $email ) {
			DAP_CRM::log_event( $email, 'todo_deleted', [
				'todo_id' => $id,
				'title' => $todo['title'],
				'source_id' => 'todo:' . $id,
			], $todo['title'], current_time('mysql') );
		}

        wp_send_json_success(
        [ 'ok' => true ]);
	}

	private function checklist_table() {
		global $wpdb;
		return $wpdb->prefix . 'dap_todo_checklist';
	}

	public function todo_checklist_list() {
		$this->require_ajax();
		global $wpdb;
		$todo_id = isset($_POST['todoId']) ? (int) $_POST['todoId'] : 0;
		if ( $todo_id <= 0 ) wp_send_json_error([ 'message' => 'invalid' ], 400);
		$tbl = $this->checklist_table();
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM $tbl WHERE todo_id=%d ORDER BY sort_order ASC, id ASC",
			$todo_id
		), ARRAY_A );

        wp_send_json_success(
        [ 'items' => $rows ?: [] ]);
	}

	public function todo_checklist_add() {
		$this->require_ajax();
		global $wpdb;
		$todo_id = isset($_POST['todoId']) ? (int) $_POST['todoId'] : 0;
		$label = sanitize_text_field($_POST['label'] ?? '');
		$minutes = isset($_POST['minutes']) ? (int) $_POST['minutes'] : null;
		$hours = isset($_POST['hours']) ? (float) $_POST['hours'] : null; // legacy
		if ( $minutes === null ) {
			$minutes = $hours !== null ? (int) round( max(0, $hours) * 60 ) : 0;
		}
		if ( $minutes < 0 ) $minutes = 0;
		if ( $todo_id <= 0 || empty($label) ) wp_send_json_error([ 'message' => 'invalid' ], 400);
		$tbl = $this->checklist_table();
		$now = current_time('mysql');
		$max_sort = (int) $wpdb->get_var( $wpdb->prepare("SELECT MAX(sort_order) FROM $tbl WHERE todo_id=%d", $todo_id) );
		$wpdb->insert($tbl, [
			'todo_id' => $todo_id,
			'label' => $label,
			'estimated_minutes' => $minutes,
			'estimated_hours' => round( $minutes / 60, 2 ),
			'is_done' => 0,
			'sort_order' => $max_sort + 1,
			'created_at' => $now,
			'updated_at' => $now,
		], [ '%d','%s','%d','%f','%d','%d','%s','%s' ] );

        wp_send_json_success(
        [ 'id' => (int)$wpdb->insert_id ]);
	}

	public function todo_checklist_toggle() {
		$this->require_ajax();
		global $wpdb;
		$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
		$is_done = isset($_POST['isDone']) ? (int) $_POST['isDone'] : 0;
		if ( $id <= 0 ) wp_send_json_error([ 'message' => 'invalid' ], 400);
		$tbl = $this->checklist_table();
		$wpdb->update($tbl, [ 'is_done' => $is_done ? 1 : 0, 'updated_at' => current_time('mysql') ], [ 'id' => $id ], [ '%d','%s' ], [ '%d' ]);

        wp_send_json_success(
        [ 'ok' => true ]);
	}

	public function todo_checklist_update() {
		$this->require_ajax();
		global $wpdb;
		$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
		$label = sanitize_text_field($_POST['label'] ?? '');
		$minutes = isset($_POST['minutes']) ? (int) $_POST['minutes'] : null;
		$hours = isset($_POST['hours']) ? (float) $_POST['hours'] : null; // legacy
		if ( $minutes === null && $hours !== null ) {
			$minutes = (int) round( max(0, $hours) * 60 );
		}
		if ( $minutes !== null && $minutes < 0 ) $minutes = 0;
		if ( $id <= 0 || empty($label) ) wp_send_json_error([ 'message' => 'invalid' ], 400);
		$tbl = $this->checklist_table();
		$data = [ 'label' => $label, 'updated_at' => current_time('mysql') ];
		$formats = [ '%s', '%s' ];
		if ( $minutes !== null ) {
			$data['estimated_minutes'] = $minutes;
			$data['estimated_hours'] = round( $minutes / 60, 2 );
			$formats[] = '%d';
			$formats[] = '%f';
		}
		$wpdb->update($tbl, $data, [ 'id' => $id ], $formats, [ '%d' ]);

		wp_send_json_success([ 'ok' => true ]);
	}

	public function todo_checklist_delete() {
		$this->require_ajax();
		global $wpdb;
		$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
		if ( $id <= 0 ) wp_send_json_error([ 'message' => 'invalid' ], 400);
		$tbl = $this->checklist_table();
		$wpdb->delete($tbl, [ 'id' => $id ], [ '%d' ]);

        wp_send_json_success(
        [ 'ok' => true ]);
	}

	public function send_email() {
		$this->require_ajax();
		$item_id = isset($_POST['agendaItemId']) ? (int)$_POST['agendaItemId'] : 0;
		$email = sanitize_email($_POST['email'] ?? '');
		$subject = sanitize_text_field($_POST['subject'] ?? '');
		$body = wp_kses_post($_POST['body'] ?? '');
		if ( empty($email) || empty($subject) || empty($body) ) wp_send_json_error([ 'message'=>'invalid' ], 400);

		$headers = [ 'Content-Type: text/html; charset=UTF-8' ];
		$sent = wp_mail( $email, $subject, $body, $headers );
		if ( ! $sent ) wp_send_json_error([ 'message'=>'send_fail' ], 500);

		// Log to CRM if possible
		DAP_CRM::log_event( $email, 'agenda_email_sent', [
			'agenda_item_id' => $item_id ?: null,
			'subject' => $subject,
			'source_id' => $item_id ? ('agenda_item:' . $item_id) : 'agenda_email',
		], $subject, current_time('mysql') );

        wp_send_json_success(
        [ 'ok' => true ]);
	}
}
