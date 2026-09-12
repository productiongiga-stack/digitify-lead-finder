<?php
namespace OWMC\Core;

/**
 * Handles DB table creation/upgrades on plugin activation.
 * All table names are prefixed with wp_owmc_ for clarity.
 */
class Installer {

    // Table slugs (without wp_ prefix)
    const COMPANIES  = 'owmc_companies';
    const LEADS      = 'owmc_leads';
    const CONTACTS   = 'owmc_contacts';
    const CONTACT_EVENTS = 'owmc_contact_events';
    const TAGS       = 'owmc_tags';
    const TAG_RELATIONS = 'owmc_tag_relations';
    const EVENTS     = 'owmc_events';
    const EMAIL_LOGS = 'owmc_email_logs';

    const DB_VERSION_OPTION = 'owmc_db_version';
    const DB_VERSION        = '2.0.0';

    public static function run(): void {
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        static::createTables();
        static::seedDefaults();
        update_option( static::DB_VERSION_OPTION, static::DB_VERSION );
        flush_rewrite_rules();
    }

    // ── Schema ────────────────────────────────────────────────────────────────

    private static function createTables(): void {
        global $wpdb;
        $cs = $wpdb->get_charset_collate();
        $p  = $wpdb->prefix;

        // 1. Companies (extended from v1)
        dbDelta( "CREATE TABLE {$p}owmc_companies (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            slug            VARCHAR(190) NOT NULL,
            name            VARCHAR(190) NOT NULL,
            logo_url        TEXT NULL,
            primary_color   VARCHAR(30) NOT NULL DEFAULT '#f7c600',
            secondary_color VARCHAR(30) NOT NULL DEFAULT '#e5b800',
            bg_color        VARCHAR(30) NOT NULL DEFAULT '#f6f7f9',
            card_color      VARCHAR(30) NOT NULL DEFAULT '#ffffff',
            text_color      VARCHAR(30) NOT NULL DEFAULT '#111318',
            muted_color     VARCHAR(30) NOT NULL DEFAULT '#5b6472',
            border_color    VARCHAR(50) NOT NULL DEFAULT 'rgba(17,19,24,.10)',
            phone           VARCHAR(64) NULL,
            email           VARCHAR(190) NULL,
            header_meta     VARCHAR(255) NOT NULL DEFAULT 'Offerte aanvraag \xe2\x80\x94 selecteer uw werken',
            thankyou_title  VARCHAR(190) NOT NULL DEFAULT 'Bedankt!',
            thankyou_text   TEXT NULL,
            wizard_json     LONGTEXT NULL,
            btw_rate        TINYINT UNSIGNED NOT NULL DEFAULT 21,
            btw_enabled     TINYINT(1) NOT NULL DEFAULT 1,
            email_template  VARCHAR(100) NOT NULL DEFAULT 'default',
            pdf_template    VARCHAR(100) NOT NULL DEFAULT 'default',
            smtp_host       VARCHAR(255) NULL,
            smtp_port       SMALLINT UNSIGNED NULL DEFAULT 587,
            smtp_user       VARCHAR(255) NULL,
            smtp_pass       TEXT NULL,
            smtp_from       VARCHAR(190) NULL,
            smtp_from_name  VARCHAR(190) NULL,
            pipeline_stages LONGTEXT NULL,
            created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY slug (slug)
        ) $cs;" );

        // 2. Leads (extended from v1)
        dbDelta( "CREATE TABLE {$p}owmc_leads (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            company_id      BIGINT UNSIGNED NOT NULL,
            contact_id      BIGINT UNSIGNED NULL,
            name            VARCHAR(190) NULL,
            email           VARCHAR(190) NULL,
            tel             VARCHAR(64) NULL,
            diensten        TEXT NULL,
            payload         LONGTEXT NOT NULL,
            page_url        TEXT NULL,
            user_agent      TEXT NULL,
            ip              VARCHAR(64) NULL,
            status          VARCHAR(50) NOT NULL DEFAULT 'new',
            pipeline_stage  VARCHAR(100) NOT NULL DEFAULT 'Nieuw',
            total_price     DECIMAL(10,2) NULL,
            currency        CHAR(3) NOT NULL DEFAULT 'EUR',
            notes           TEXT NULL,
            opened_at       DATETIME NULL,
            sent_at         DATETIME NULL,
            accepted_at     DATETIME NULL,
            created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY company_id (company_id),
            KEY contact_id (contact_id),
            KEY email (email),
            KEY status (status),
            KEY pipeline_stage (pipeline_stage),
            KEY created_at (created_at)
        ) $cs;" );

        // 3. CRM Contacts
        dbDelta( "CREATE TABLE {$p}owmc_contacts (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            email       VARCHAR(190) NOT NULL,
            name        VARCHAR(190) NULL,
            tel         VARCHAR(64) NULL,
            company_id  BIGINT UNSIGNED NULL,
            status      VARCHAR(50) NOT NULL DEFAULT 'active',
            pipeline_stage VARCHAR(100) NOT NULL DEFAULT 'Nieuw',
            notes       TEXT NULL,
            source      VARCHAR(100) NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY email (email),
            KEY company_id (company_id),
            KEY status (status),
            KEY pipeline_stage (pipeline_stage),
            KEY created_at (created_at)
        ) $cs;" );

        // 4. Contact timeline events
        dbDelta( "CREATE TABLE {$p}owmc_contact_events (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            contact_id  BIGINT UNSIGNED NOT NULL,
            event_type  VARCHAR(100) NOT NULL,
            summary     VARCHAR(500) NULL,
            meta        LONGTEXT NULL,
            created_by  BIGINT UNSIGNED NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY contact_id (contact_id),
            KEY event_type (event_type),
            KEY created_at (created_at)
        ) $cs;" );

        // 5. Tags
        dbDelta( "CREATE TABLE {$p}owmc_tags (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name        VARCHAR(100) NOT NULL,
            color       VARCHAR(20) NOT NULL DEFAULT '#6366f1',
            company_id  BIGINT UNSIGNED NULL,
            PRIMARY KEY (id),
            UNIQUE KEY name_company (name, company_id)
        ) $cs;" );

        // 6. Contact ↔ Tag (many-to-many)
        dbDelta( "CREATE TABLE {$p}owmc_tag_relations (
            contact_id  BIGINT UNSIGNED NOT NULL,
            tag_id      BIGINT UNSIGNED NOT NULL,
            PRIMARY KEY (contact_id, tag_id)
        ) $cs;" );

        // 7. System events log
        dbDelta( "CREATE TABLE {$p}owmc_events (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            event_name  VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50) NULL,
            entity_id   BIGINT UNSIGNED NULL,
            company_id  BIGINT UNSIGNED NULL,
            payload     LONGTEXT NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY event_name (event_name),
            KEY entity_type_id (entity_type, entity_id),
            KEY company_id (company_id),
            KEY created_at (created_at)
        ) $cs;" );

        // 8. Email logs
        dbDelta( "CREATE TABLE {$p}owmc_email_logs (
            id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            lead_id         BIGINT UNSIGNED NULL,
            contact_id      BIGINT UNSIGNED NULL,
            company_id      BIGINT UNSIGNED NULL,
            to_email        VARCHAR(190) NOT NULL,
            subject         VARCHAR(500) NOT NULL,
            template        VARCHAR(100) NOT NULL DEFAULT 'default',
            track_id        VARCHAR(64) NOT NULL,
            status          VARCHAR(50) NOT NULL DEFAULT 'queued',
            sent_at         DATETIME NULL,
            opened_at       DATETIME NULL,
            clicked_at      DATETIME NULL,
            open_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            click_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            error_message   TEXT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY track_id (track_id),
            KEY lead_id (lead_id),
            KEY contact_id (contact_id),
            KEY company_id (company_id),
            KEY status (status),
            KEY sent_at (sent_at)
        ) $cs;" );
    }

    // ── Seed ──────────────────────────────────────────────────────────────────

    private static function seedDefaults(): void {
        global $wpdb;

        // Global options
        $opt = get_option( 'owmc_global', [] );
        if ( ! is_array( $opt ) ) $opt = [];
        if ( empty( $opt['public_token'] ) ) {
            $opt['public_token'] = static::randomToken();
        }
        if ( empty( $opt['notify_email'] ) ) {
            $opt['notify_email'] = get_option( 'admin_email' );
        }
        update_option( 'owmc_global', $opt );

        // Seed default company if none exist (backward compat with v1 table name too)
        $comp = $wpdb->prefix . 'owmc_companies';
        $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $comp" );
        if ( $count === 0 ) {
            $wpdb->insert( $comp, [
                'slug'          => 'default',
                'name'          => get_bloginfo( 'name' ) ?: 'Mijn Bedrijf',
                'email'         => get_option( 'admin_email' ),
                'wizard_json'   => wp_json_encode( static::defaultWizardSchema(), JSON_UNESCAPED_UNICODE ),
                'pipeline_stages' => wp_json_encode( static::defaultPipelineStages() ),
            ] );
        }
    }

    public static function randomToken(): string {
        $raw = wp_generate_password( 48, true, true );
        return hash( 'sha256', $raw . '|' . wp_salt( 'auth' ) );
    }

    // ── Defaults ──────────────────────────────────────────────────────────────

    public static function defaultPipelineStages(): array {
        return [
            [ 'key' => 'Nieuw',              'label' => 'Nieuw',              'color' => '#6366f1' ],
            [ 'key' => 'Gecontacteerd',      'label' => 'Gecontacteerd',      'color' => '#3b82f6' ],
            [ 'key' => 'Offerte verzonden',  'label' => 'Offerte verzonden',  'color' => '#f59e0b' ],
            [ 'key' => 'Gewonnen',           'label' => 'Gewonnen',           'color' => '#10b981' ],
            [ 'key' => 'Verloren',           'label' => 'Verloren',           'color' => '#ef4444' ],
        ];
    }

    public static function defaultWizardSchema(): array {
        return [
            'meta' => [
                'version'    => 2,
                'stepLabels' => [ 'Diensten', 'Details', 'Locatie', 'Contact' ],
                'step1' => [ 'title' => 'Welke werken wenst u?',      'subtitle' => 'Selecteer één of meerdere diensten.' ],
                'step2' => [ 'title' => 'Projectdetails',             'subtitle' => 'Nog enkele korte vragen.' ],
                'step3' => [ 'title' => 'Locatie',                    'subtitle' => 'Geef ons de basisinfo over de werf.' ],
                'step4' => [ 'title' => 'Contact',                    'subtitle' => 'We nemen zo snel mogelijk contact op.' ],
            ],
            'services' => [
                [
                    'id' => 'afbraak', 'title' => 'Afbraak', 'desc' => 'Afbraak & ontmanteling', 'icon' => '🏗️',
                    'questions' => [
                        [ 'key' => 'soort',      'label' => 'Wat moet afgebroken worden?',   'type' => 'select', 'required' => true,  'options' => [ 'Volledige woning', 'Bijgebouw', 'Interieur', 'Andere' ] ],
                        [ 'key' => 'oppervlakte','label' => 'Geschatte oppervlakte (m²)',     'type' => 'number', 'required' => true,  'placeholder' => 'bijv. 120' ],
                        [ 'key' => 'asbest',     'label' => 'Vermoeden van asbest?',          'type' => 'chips',  'required' => true,  'options' => [ 'Ja', 'Nee', 'Weet ik niet' ] ],
                    ],
                ],
                [
                    'id' => 'riolering', 'title' => 'Riolering', 'desc' => 'Aanleg & herstelling', 'icon' => '🚧',
                    'questions' => [
                        [ 'key' => 'type',          'label' => 'Type werk',                       'type' => 'select', 'required' => true, 'options' => [ 'Nieuwe aanleg', 'Herstelling', 'Aansluiting / keuring' ] ],
                        [ 'key' => 'bereikbaarheid','label' => 'Is het terrein goed bereikbaar?', 'type' => 'chips',  'required' => true, 'options' => [ 'Ja', 'Nee', 'Beperkt' ] ],
                    ],
                ],
            ],
            'location' => [
                'propertyTypes'    => [ 'Woning', 'Appartement', 'Commercieel', 'Industrieel' ],
                'ownershipOptions' => [ 'Eigenaar', 'Huurder', 'Syndicus' ],
                'labels'           => [ 'type' => 'Type pand', 'ownership' => 'Eigendom', 'postcode' => 'Postcode', 'city' => 'Stad/Gemeente' ],
            ],
            'contact' => [
                'labels' => [ 'name' => 'Naam', 'email' => 'E-mailadres', 'tel' => 'Telefoonnummer', 'notes' => 'Extra opmerkingen' ],
            ],
        ];
    }
}
