<?php
if ( ! defined('ABSPATH') ) exit;

class DAP_Installer {
	public static function activate() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();

		$tbl_items = $wpdb->prefix . 'dap_agenda_items';
		$tbl_todos = $wpdb->prefix . 'dap_todos';
		$tbl_checklist = $wpdb->prefix . 'dap_todo_checklist';
		$tbl_types = $wpdb->prefix . 'dap_types';

		$sql_items = "CREATE TABLE $tbl_items (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			title VARCHAR(190) NOT NULL,
			description LONGTEXT NULL,
			start_at DATETIME NOT NULL,
			end_at DATETIME NULL,
			type_key VARCHAR(60) NOT NULL DEFAULT 'meeting',
			color VARCHAR(20) NOT NULL DEFAULT '#2563eb',
			status VARCHAR(30) NOT NULL DEFAULT 'open',
			contact_email VARCHAR(190) NULL,
			source_app VARCHAR(60) NULL,
			source_id VARCHAR(190) NULL,
			assigned_user_id BIGINT UNSIGNED NULL,
			created_by BIGINT UNSIGNED NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY (id),
			KEY start_at (start_at),
			KEY contact_email (contact_email),
			KEY type_key (type_key),
			KEY source_lookup (source_app, source_id)
		) $charset;";

		$sql_todos = "CREATE TABLE $tbl_todos (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			title VARCHAR(190) NOT NULL,
			estimated_minutes INT NOT NULL DEFAULT 0,
			estimated_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
			notes LONGTEXT NULL,
			due_at DATETIME NULL,
			priority VARCHAR(20) NOT NULL DEFAULT 'normal',
			status VARCHAR(20) NOT NULL DEFAULT 'open',
			type_key VARCHAR(60) NOT NULL DEFAULT 'todo',
			color VARCHAR(20) NOT NULL DEFAULT '#64748b',
			contact_email VARCHAR(190) NULL,
			agenda_item_id BIGINT UNSIGNED NULL,
			assigned_user_id BIGINT UNSIGNED NULL,
			created_by BIGINT UNSIGNED NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY (id),
			KEY due_at (due_at),
			KEY status (status),
			KEY contact_email (contact_email),
			KEY agenda_item_id (agenda_item_id)
		) $charset;";

		$sql_types = "CREATE TABLE $tbl_types (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			type_key VARCHAR(60) NOT NULL,
			label VARCHAR(120) NOT NULL,
			color VARCHAR(20) NOT NULL,
			is_active TINYINT(1) NOT NULL DEFAULT 1,
			sort_order INT NOT NULL DEFAULT 0,
			PRIMARY KEY (id),
			UNIQUE KEY type_key (type_key)
		) $charset;";

		$sql_checklist = "CREATE TABLE $tbl_checklist (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			todo_id BIGINT UNSIGNED NOT NULL,
			label VARCHAR(190) NOT NULL,
			estimated_minutes INT NOT NULL DEFAULT 0,
			estimated_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
			is_done TINYINT(1) NOT NULL DEFAULT 0,
			sort_order INT NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY (id),
			KEY todo_id (todo_id),
			KEY is_done (is_done)
		) $charset;";

		dbDelta( $sql_items );
		// Upgrade: add source columns for inbound app integrations.
		$col_src_app = $wpdb->get_var( $wpdb->prepare("SHOW COLUMNS FROM $tbl_items LIKE %s", 'source_app') );
		if ( empty($col_src_app) ) {
			$wpdb->query("ALTER TABLE $tbl_items ADD COLUMN source_app VARCHAR(60) NULL AFTER contact_email");
		}
		$col_src_id = $wpdb->get_var( $wpdb->prepare("SHOW COLUMNS FROM $tbl_items LIKE %s", 'source_id') );
		if ( empty($col_src_id) ) {
			$wpdb->query("ALTER TABLE $tbl_items ADD COLUMN source_id VARCHAR(190) NULL AFTER source_app");
		}
		// Best-effort index (ignore errors)
		$wpdb->query("CREATE INDEX source_lookup ON $tbl_items (source_app, source_id)");

		dbDelta( $sql_todos );
		dbDelta( $sql_checklist );
		dbDelta( $sql_types );

		// Backward-compatible upgrade: add estimated_minutes and migrate from estimated_hours when upgrading.
		$col = $wpdb->get_var( $wpdb->prepare("SHOW COLUMNS FROM $tbl_todos LIKE %s", 'estimated_minutes') );
		if ( empty($col) ) {
			$wpdb->query("ALTER TABLE $tbl_todos ADD COLUMN estimated_minutes INT NOT NULL DEFAULT 0 AFTER title");
			// Best-effort migration (hours -> minutes)
			$wpdb->query("UPDATE $tbl_todos SET estimated_minutes = ROUND(estimated_hours * 60) WHERE estimated_minutes = 0 AND estimated_hours > 0");
		}

		$col2 = $wpdb->get_var( $wpdb->prepare("SHOW COLUMNS FROM $tbl_checklist LIKE %s", 'estimated_minutes') );
		if ( empty($col2) ) {
			$wpdb->query("ALTER TABLE $tbl_checklist ADD COLUMN estimated_minutes INT NOT NULL DEFAULT 0 AFTER label");
			// Best-effort migration (hours -> minutes)
			$wpdb->query("UPDATE $tbl_checklist SET estimated_minutes = ROUND(estimated_hours * 60) WHERE estimated_minutes = 0 AND estimated_hours > 0");
		}

		self::seed_types();
		update_option( 'dap_db_version', defined('DAP_VERSION') ? DAP_VERSION : '1.0.0' );
	}

	private static function seed_types() {
		global $wpdb;
		$tbl = $wpdb->prefix . 'dap_types';

		$defaults = [
			[ 'meeting', 'Meeting', '#2563eb', 1 ],
			[ 'confirmed', 'Afspraak bevestigd', '#16a34a', 2 ],
			[ 'followup', 'Follow-up', '#f59e0b', 3 ],
			[ 'quote', 'Offerte', '#f97316', 4 ],
			[ 'urgent', 'Dringend', '#dc2626', 5 ],
			[ 'internal', 'Intern', '#7c3aed', 6 ],
			[ 'done', 'Afgerond', '#64748b', 7 ],
			[ 'todo', 'To-do', '#0f172a', 8 ],
		];

		foreach ( $defaults as $i => $row ) {
			list($key,$label,$color,$order) = $row;
			$exists = $wpdb->get_var( $wpdb->prepare("SELECT id FROM $tbl WHERE type_key=%s", $key ) );
			if ( $exists ) {
				// Keep defaults in sync (eg label changes)
				$wpdb->update( $tbl, [
					'label' => $label,
					'color' => $color,
					'sort_order' => (int)$order,
					'is_active' => 1,
				], [ 'id' => (int)$exists ], [ '%s','%s','%d','%d' ], [ '%d' ] );
				continue;
			}
			$wpdb->insert( $tbl, [
				'type_key' => $key,
				'label' => $label,
				'color' => $color,
				'is_active' => 1,
				'sort_order' => (int)$order,
			], [ '%s','%s','%s','%d','%d' ] );
		}
	}
}
