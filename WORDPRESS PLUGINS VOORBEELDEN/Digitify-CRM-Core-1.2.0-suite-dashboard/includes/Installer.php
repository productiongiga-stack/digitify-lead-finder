<?php
namespace DCRM;

if ( ! defined( 'ABSPATH' ) ) exit;

class Installer {

    public static function activate(): void {
        self::maybeCreateTables();
        // store version for future migrations
        update_option( 'dcrm_core_version', defined('DCRM_CORE_VERSION') ? DCRM_CORE_VERSION : '1.0.0' );
    }

    public static function maybeCreateTables(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();

        $contacts = $wpdb->prefix . DCRM_CORE_TABLE_CONTACTS;
        $events   = $wpdb->prefix . DCRM_CORE_TABLE_EVENTS;
        $tags     = $wpdb->prefix . DCRM_CORE_TABLE_TAGS;
        $tagrel   = $wpdb->prefix . DCRM_CORE_TABLE_TAG_REL;
        $emails   = $wpdb->prefix . DCRM_CORE_TABLE_EMAILS;

        // Contacts
        $sqlContacts = "CREATE TABLE $contacts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email VARCHAR(190) NOT NULL,
            name VARCHAR(190) NULL,
            tel VARCHAR(64) NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'lead',
            pipeline_stage VARCHAR(64) NULL,
            notes LONGTEXT NULL,
            source VARCHAR(32) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL,
            last_activity_at DATETIME NULL,
            last_contacted_at DATETIME NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY email (email),
            KEY status (status),
            KEY pipeline_stage (pipeline_stage),
            KEY last_activity_at (last_activity_at)
        ) $charset;";

        // Events
        $sqlEvents = "CREATE TABLE $events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            contact_id BIGINT UNSIGNED NOT NULL,
            event_type VARCHAR(64) NOT NULL,
            summary VARCHAR(255) NULL,
            source_app VARCHAR(32) NULL,
            meta LONGTEXT NULL,
            created_by BIGINT UNSIGNED NULL,
            occurred_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY contact_id (contact_id),
            KEY event_type (event_type),
            KEY occurred_at (occurred_at)
        ) $charset;";

        // Tags
        $sqlTags = "CREATE TABLE $tags (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(80) NOT NULL,
            color VARCHAR(16) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY name (name)
        ) $charset;";

        // Tag relations
        $sqlTagRel = "CREATE TABLE $tagrel (
            contact_id BIGINT UNSIGNED NOT NULL,
            tag_id BIGINT UNSIGNED NOT NULL,
            PRIMARY KEY (contact_id, tag_id),
            KEY tag_id (tag_id)
        ) $charset;";

        // Email logs (basic)
        $sqlEmails = "CREATE TABLE $emails (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            company_id BIGINT UNSIGNED NULL,
            contact_id BIGINT UNSIGNED NULL,
            track_id VARCHAR(64) NULL,
            subject VARCHAR(255) NULL,
            template_id VARCHAR(64) NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'queued',
            error_message TEXT NULL,
            open_count INT UNSIGNED NOT NULL DEFAULT 0,
            click_count INT UNSIGNED NOT NULL DEFAULT 0,
            sent_at DATETIME NULL,
            opened_at DATETIME NULL,
            clicked_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY contact_id (contact_id),
            KEY company_id (company_id),
            KEY track_id (track_id),
            KEY sent_at (sent_at)
        ) $charset;";

        dbDelta( $sqlContacts );
        dbDelta( $sqlEvents );
        dbDelta( $sqlTags );
        dbDelta( $sqlTagRel );
        dbDelta( $sqlEmails );

        // Compatibility migration: copy from old owmc_* tables if they exist and new tables are empty.
        self::maybeMigrateFromLegacy( $wpdb, $contacts, $events, $tags, $tagrel, $emails );
    }

    private static function tableExists( $wpdb, string $table ): bool {
        $like = $wpdb->esc_like( $table );
        $found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $like ) );
        return ! empty( $found );
    }

    private static function maybeMigrateFromLegacy( $wpdb, $contacts, $events, $tags, $tagrel, $emails ): void {
        $legacyContacts = $wpdb->prefix . 'owmc_contacts';
        $legacyEvents   = $wpdb->prefix . 'owmc_contact_events';
        $legacyTags     = $wpdb->prefix . 'owmc_tags';
        $legacyTagRel   = $wpdb->prefix . 'owmc_tag_relations';
        $legacyEmails   = $wpdb->prefix . 'owmc_email_logs';

        // Only migrate when legacy exists and new is empty
        if ( self::tableExists( $wpdb, $legacyContacts ) ) {
            $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $contacts" );
            if ( $count === 0 ) {
                $wpdb->query( "INSERT INTO $contacts (id,email,name,tel,status,pipeline_stage,notes,source,created_at)
                              SELECT id,email,name,tel,COALESCE(status,'lead'),pipeline_stage,notes,'legacy',created_at
                              FROM $legacyContacts" );
            }
        }

        if ( self::tableExists( $wpdb, $legacyEvents ) ) {
            $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $events" );
            if ( $count === 0 ) {
                $wpdb->query( "INSERT INTO $events (id,contact_id,event_type,summary,meta,created_by,occurred_at,created_at,source_app)
                              SELECT id,contact_id,event_type,summary,meta,created_by,created_at,created_at,'legacy'
                              FROM $legacyEvents" );
            }
        }

        if ( self::tableExists( $wpdb, $legacyTags ) ) {
            $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $tags" );
            if ( $count === 0 ) {
                // legacy table may have different columns; best-effort
                $wpdb->query( "INSERT IGNORE INTO $tags (id,name,color,created_at)
                              SELECT id,name,color,COALESCE(created_at,NOW())
                              FROM $legacyTags" );
            }
        }

        if ( self::tableExists( $wpdb, $legacyTagRel ) ) {
            $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $tagrel" );
            if ( $count === 0 ) {
                $wpdb->query( "INSERT IGNORE INTO $tagrel (contact_id,tag_id)
                              SELECT contact_id,tag_id FROM $legacyTagRel" );
            }
        }

        if ( self::tableExists( $wpdb, $legacyEmails ) ) {
            $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $emails" );
            if ( $count === 0 ) {
                // copy overlapping columns
                $wpdb->query( "INSERT INTO $emails (id,company_id,contact_id,track_id,subject,template_id,status,error_message,open_count,click_count,sent_at,opened_at,clicked_at,created_at)
                              SELECT id,company_id,contact_id,track_id,subject,template_id,status,error_message,open_count,click_count,sent_at,opened_at,clicked_at,COALESCE(created_at,NOW())
                              FROM $legacyEmails" );
            }
        }
    }
}
