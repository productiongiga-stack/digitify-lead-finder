<?php
defined( 'ABSPATH' ) || exit;

/**
 * Frontend booking widget — Cal.com inspired layout with iFrame embed.
 */
class Digitify_Booking_Widget {

    public function init(): void {
        add_shortcode( 'digitify_booking', [ $this, 'render_shortcode' ] );
        // Register frontend assets. We enqueue them only when the shortcode is rendered
        // to avoid loading CSS/JS site-wide.
        add_action( 'wp_enqueue_scripts', [ $this, 'register_assets' ] );
        add_action( 'template_redirect',  [ $this, 'handle_cancel_link' ] );

        add_action( 'wp_ajax_digitify_get_event_widget',        [ $this, 'ajax_get_event_widget' ] );
        add_action( 'wp_ajax_nopriv_digitify_get_event_widget', [ $this, 'ajax_get_event_widget' ] );
    }

    /* ---------------------------------------------------------------
     * AJAX: return single-event widget HTML
     * ------------------------------------------------------------- */
    public function ajax_get_event_widget(): void {
        check_ajax_referer( 'digitify_booking_nonce', 'nonce' );
        $event_id   = absint( $_POST['event_id'] ?? 0 );
        $handler    = new Digitify_Booking_Handler();
        $event_type = $handler->get_event_type( $event_id );
        if ( ! $event_type ) {
            wp_send_json_error( 'Evenementtype niet gevonden.' );
        }
        wp_send_json_success( [ 'html' => $this->render_single_event( $event_type ) ] );
    }

    /* ---------------------------------------------------------------
     * Assets (normal page — not embed)
     * ------------------------------------------------------------- */
    public function register_assets(): void {
        wp_register_style(
            'digitify-booking',
            DIGITIFY_BOOKING_URL . 'public/css/booking.css',
            [],
            DIGITIFY_BOOKING_VERSION
        );
        wp_register_script(
            'digitify-booking',
            DIGITIFY_BOOKING_URL . 'public/js/booking.js',
            [ 'jquery' ],
            DIGITIFY_BOOKING_VERSION,
            true
        );
    }

    private function enqueue_frontend_assets(): void {
        if ( ! wp_style_is( 'digitify-booking', 'registered' ) ) {
            $this->register_assets();
        }
        wp_enqueue_style( 'digitify-booking' );
        wp_enqueue_script( 'digitify-booking' );
        wp_localize_script( 'digitify-booking', 'digitifyBooking', [
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'digitify_booking_nonce' ),
            'isEmbed' => false,
            'strings' => $this->get_js_strings(),
        ] );
    }

    private function get_js_strings(): array {
        return [
            'select_date'   => 'Selecteer een datum',
            'no_slots'      => 'Geen beschikbare tijdsloten op deze dag.',
            'booking_ok'    => 'Aanvraag ontvangen!',
            'booking_error' => 'Er ging iets mis. Probeer opnieuw.',
            'loading'       => 'Laden...',
            'confirm_btn'   => 'Aanvragen',
            'back_btn'      => '← Terug',
        ];
    }

    /* ---------------------------------------------------------------
     * Cancel link handler
     * ------------------------------------------------------------- */
    public function handle_cancel_link(): void {
        if ( ! isset( $_GET['digitify_cancel'] ) ) {
            return;
        }
        $uid = sanitize_text_field( $_GET['digitify_cancel'] );
        global $wpdb;
        $booking = $wpdb->get_row( $wpdb->prepare(
            "SELECT b.*, e.title FROM {$wpdb->prefix}digitify_bookings b
             LEFT JOIN {$wpdb->prefix}digitify_event_types e ON b.event_type_id = e.id
             WHERE b.uid = %s",
            $uid
        ), ARRAY_A );
        add_filter( 'the_content', function () use ( $booking, $uid ) {
            return $this->render_cancel_confirmation( $booking, $uid );
        } );
    }

    private function render_cancel_confirmation( $booking, string $uid ): string {
        if ( ! $booking ) {
            return '<div class="dg-cancel-page"><p>Boeking niet gevonden.</p></div>';
        }
        if ( $booking['status'] === 'cancelled' ) {
            return '<div class="dg-cancel-page"><p>Deze boeking is al geannuleerd.</p></div>';
        }
        $tz    = new DateTimeZone( wp_timezone_string() );
        $start = new DateTime( $booking['start_time'], $tz );
        ob_start();
        ?>
        <div class="dg-cancel-page">
            <div class="dg-confirm-header">
                <span class="dg-confirm-icon">⚠️</span>
                <h2>Afspraak annuleren</h2>
            </div>
            <p>Wil je de volgende afspraak annuleren?</p>
            <div class="dg-booking-summary">
                <div class="dg-summary-row"><strong>Evenement</strong><span><?php echo esc_html( $booking['title'] ); ?></span></div>
                <div class="dg-summary-row"><strong>Datum</strong><span><?php echo esc_html( $start->format( 'd/m/Y' ) ); ?></span></div>
                <div class="dg-summary-row"><strong>Tijd</strong><span><?php echo esc_html( $start->format( 'H:i' ) ); ?></span></div>
            </div>
            <div class="dg-cancel-actions">
                <button class="dg-btn-danger" id="dg-confirm-cancel" data-uid="<?php echo esc_attr( $uid ); ?>">Ja, annuleren</button>
                <a href="<?php echo esc_url( home_url() ); ?>" class="dg-btn-secondary">Nee, terug</a>
            </div>
            <div id="dg-cancel-result"></div>
        </div>
        <?php
        return ob_get_clean();
    }

    /* ---------------------------------------------------------------
     * Shortcode
     * ------------------------------------------------------------- */
    public function render_shortcode( array $atts ): string {
        $atts    = shortcode_atts( [
            'id'     => 0,
            'inline' => 0,
            // default behaviour: iframe (strongest CSS-isolation)
            // inline=1 remains supported for backwards compatibility.
            'mode'   => '', // '', 'iframe', 'inline'
        ], $atts, 'digitify_booking' );

        // Ensure CSS/JS only loads when shortcode is used.
        $this->enqueue_frontend_assets();

        // Normalize mode
        $mode = strtolower( (string) $atts['mode'] );
        if ( $mode === 'inline' ) {
            $atts['inline'] = 1;
        } elseif ( $mode === 'iframe' ) {
            $atts['inline'] = 0;
        }

        $handler = new Digitify_Booking_Handler();

        if ( $atts['id'] ) {
            $event_type = $handler->get_event_type( (int) $atts['id'] );
            if ( ! $event_type ) {
                return '<p>Evenementtype niet gevonden.</p>';
            }
            return $atts['inline']
                ? $this->render_single_event( $event_type )
                : $this->render_iframe( (int) $atts['id'] );
        }

        $event_types = $handler->get_all_event_types();
        if ( empty( $event_types ) ) {
            return '<p>Geen boekingstypen beschikbaar.</p>';
        }

        if ( count( $event_types ) === 1 ) {
            return $atts['inline']
                ? $this->render_single_event( $event_types[0] )
                : $this->render_iframe( (int) $event_types[0]['id'] );
        }

        return $this->render_event_list( $event_types );
    }

    /* ---------------------------------------------------------------
     * iFrame wrapper (output on normal page)
     * ------------------------------------------------------------- */
    private function render_iframe( int $event_id ): string {
        $src = add_query_arg( 'digitify_embed', $event_id, home_url( '/' ) );
        $uid = 'dg-iframe-' . $event_id . '-' . uniqid();
        ob_start();
        ?>
        <div class="dg-iframe-wrap">
            <iframe src="<?php echo esc_url( $src ); ?>"
                    class="dg-booking-iframe"
                    id="<?php echo esc_attr( $uid ); ?>"
                    frameborder="0"
                    scrolling="no"
                    loading="lazy"
                    title="Afspraak boeken"></iframe>
        </div>
        <script>
        (function(){
            var iframeId = <?php echo wp_json_encode( $uid ); ?>;
            window.addEventListener('message', function(e) {
                if (e.data && typeof e.data.digitifyHeight === 'number') {
                    var f = document.getElementById(iframeId);
                    if (f) { f.style.height = (e.data.digitifyHeight + 24) + 'px'; }
                }
            });
        })();
        </script>
        <?php
        return ob_get_clean();
    }

    /* ---------------------------------------------------------------
     * Standalone embed page (rendered inside iframe)
     * ------------------------------------------------------------- */
    public function render_embed_page( array $event_type ): void {
        $branding = get_option( 'digitify_booking_branding', [] );
        $primary  = $branding['primary_color'] ?? '#6366f1';
        $bg       = $branding['bg_color']      ?? '#ffffff';
        $css_url  = DIGITIFY_BOOKING_URL . 'public/css/booking.css?v=' . DIGITIFY_BOOKING_VERSION;
        $js_url   = DIGITIFY_BOOKING_URL . 'public/js/booking.js?v='  . DIGITIFY_BOOKING_VERSION;
        $ajax_url = admin_url( 'admin-ajax.php' );
        $nonce    = wp_create_nonce( 'digitify_booking_nonce' );
        $jquery   = includes_url( 'js/jquery/jquery.min.js' );

        header( 'Content-Type: text/html; charset=utf-8' );
        header_remove( 'X-Frame-Options' );
        header( 'X-Frame-Options: SAMEORIGIN' );
        ?><!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html( $event_type['title'] ); ?> — Afspraak boeken</title>
    <link rel="stylesheet" href="<?php echo esc_url( $css_url ); ?>">
    <style>
        :root { --dg-primary: <?php echo esc_attr( $primary ); ?>; }
        html, body { margin: 0; padding: 0; background: <?php echo esc_attr( $bg ); ?>; }
        .dg-booking-widget { border: none; border-radius: 0; box-shadow: none; min-height: 100vh; }
    </style>
</head>
<body>
<?php echo $this->render_single_event( $event_type ); ?>
<script src="<?php echo esc_url( $jquery ); ?>"></script>
<script>
window.digitifyBooking = <?php echo wp_json_encode( [
    'ajaxUrl' => $ajax_url,
    'nonce'   => $nonce,
    'isEmbed' => true,
    'strings' => $this->get_js_strings(),
] ); ?>;
</script>
<script src="<?php echo esc_url( $js_url ); ?>"></script>
<script>
(function() {
    function dgNotifyHeight() {
        var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.parent.postMessage({ digitifyHeight: h }, '*');
    }
    window.addEventListener('load', dgNotifyHeight);
    var obs = new MutationObserver(dgNotifyHeight);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
})();
</script>
</body>
</html>
<?php
    }

    /* ---------------------------------------------------------------
     * Event list (multiple types)
     * ------------------------------------------------------------- */
    private function render_event_list( array $event_types ): string {
        $branding     = get_option( 'digitify_booking_branding', [] );
        $company_name = $branding['company_name'] ?? get_bloginfo( 'name' );
        $tagline      = $branding['tagline']       ?? 'Kies een evenementtype om een afspraak te boeken';
        $logo_url     = $branding['logo_url']      ?? '';
        ob_start();
        ?>
        <div class="dg-event-list" data-dg-list-mode="iframe">
            <div class="dg-event-list-header">
                <?php if ( $logo_url ) : ?>
                    <img src="<?php echo esc_url( $logo_url ); ?>"
                         alt="<?php echo esc_attr( $company_name ); ?>"
                         class="dg-event-list-logo">
                <?php else : ?>
                    <div class="dg-event-list-company"><?php echo esc_html( $company_name ); ?></div>
                <?php endif; ?>
                <h2><?php echo esc_html( $company_name ); ?></h2>
                <p><?php echo esc_html( $tagline ); ?></p>
            </div>
            <div class="dg-event-cards">
                <?php foreach ( $event_types as $et ) : ?>
                <?php $embed_src = add_query_arg( 'digitify_embed', (int) $et['id'], home_url( '/' ) ); ?>
                <a class="dg-event-card"
                   href="<?php echo esc_url( $embed_src ); ?>"
                   data-event-id="<?php echo (int) $et['id']; ?>"
                   data-embed-src="<?php echo esc_url( $embed_src ); ?>">
                    <span class="dg-event-card-dot" style="background:<?php echo esc_attr( $et['color'] ); ?>"></span>
                    <div class="dg-event-card-body">
                        <strong><?php echo esc_html( $et['title'] ); ?></strong>
                        <?php if ( $et['description'] ) : ?>
                            <p><?php echo esc_html( $et['description'] ); ?></p>
                        <?php endif; ?>
                        <div class="dg-event-card-meta">
                            <span>⏱ <?php echo (int) $et['duration']; ?> min</span>
                            <?php if ( $et['location'] ) : ?>
                                <span>📍 <?php echo esc_html( $et['location'] ); ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <span class="dg-event-card-arrow">→</span>
                </a>
                <?php endforeach; ?>
            </div>
        </div>
        <div id="dg-booking-modal-root"></div>
        <?php
        return ob_get_clean();
    }

    /* ---------------------------------------------------------------
     * Single event booking widget — Cal.com 3-column layout
     * ------------------------------------------------------------- */
    public function render_single_event( array $et ): string {
        $branding     = get_option( 'digitify_booking_branding', [] );
        $company_name = $branding['company_name']   ?? get_bloginfo( 'name' );
        $logo_url     = $branding['logo_url']        ?? '';
        $tz_label     = $branding['timezone_label']  ?? wp_timezone_string();
        $primary      = $branding['primary_color']   ?? '#ff6a00';

        $bg_color     = $branding['bg_color']        ?? '#ffffff';
        $widget_title  = $branding['widget_title']    ?? '';
        $widget_sub    = $branding['widget_subtitle'] ?? '';


        $tz       = new DateTimeZone( wp_timezone_string() );
        $today    = new DateTime( 'today', $tz );
        $cal_year = (int) $today->format( 'Y' );
        $cal_mon  = (int) $today->format( 'n' );

        ob_start();
        ?>
        <div class="dg-booking-widget"
             data-event-id="<?php echo (int) $et['id']; ?>"
             data-cal-year="<?php echo $cal_year; ?>"
             data-cal-month="<?php echo $cal_mon; ?>"
             style="--dg-primary:<?php echo esc_attr( $primary ); ?>;--dg-bg:<?php echo esc_attr( $bg_color ); ?>">

            <!-- ══ Sidebar ══ -->
            <aside class="dg-sidebar">
                <?php if ( $logo_url ) : ?>
                    <img src="<?php echo esc_url( $logo_url ); ?>"
                         alt="<?php echo esc_attr( $company_name ); ?>"
                         class="dg-sidebar-logo">
                <?php else : ?>
                    <div class="dg-sidebar-brand"><?php echo esc_html( $company_name ); ?></div>
                <?php endif; ?>

                <div class="dg-sidebar-divider"></div>

                <div class="dg-sidebar-event">
                    <span class="dg-event-color-dot" style="background:<?php echo esc_attr( $et['color'] ); ?>"></span>
                    <h2 class="dg-sidebar-title"><?php echo esc_html( $et['title'] ); ?></h2>

                    <div class="dg-sidebar-meta">
                        <div class="dg-meta-row">
                            <span class="dg-meta-icon">⏱</span>
                            <span><?php echo (int) $et['duration']; ?> minuten</span>
                        </div>
                        <?php if ( $et['location'] ) : ?>
                        <div class="dg-meta-row">
                            <span class="dg-meta-icon">📍</span>
                            <span><?php echo esc_html( $et['location'] ); ?></span>
                        </div>
                        <?php endif; ?>
                        <div class="dg-meta-row">
                            <span class="dg-meta-icon">🌐</span>
                            <span><?php echo esc_html( $tz_label ); ?></span>
                        </div>
                    </div>

                    <?php if ( $et['description'] ) : ?>
                        <p class="dg-sidebar-desc"><?php echo esc_html( $et['description'] ); ?></p>
                    <?php endif; ?>
                </div>
            </aside>

            <!-- ══ Main ══ -->
            <div class="dg-main">
                <div class="dg-topbar">
                    <div class="dg-topbar-left">
                        <div class="dg-topbar-title"><?php echo esc_html( $widget_title ?: 'Plan je afspraak' ); ?></div>
                        <?php if ( $widget_sub ) : ?>
                            <div class="dg-topbar-sub"><?php echo esc_html( $widget_sub ); ?></div>
                        <?php elseif ( ! empty( $branding['tagline'] ) ) : ?>
                            <div class="dg-topbar-sub"><?php echo esc_html( $branding['tagline'] ); ?></div>
                        <?php endif; ?>
                    </div>
                    <div class="dg-stepper" role="list" aria-label="Boekingsstappen">
                        <div class="dg-stepper-item dg-stepper-active" data-stepper="1" role="listitem"><span class="dg-stepper-dot">1</span><span class="dg-stepper-label">Datum</span></div>
                        <div class="dg-stepper-item" data-stepper="2" role="listitem"><span class="dg-stepper-dot">2</span><span class="dg-stepper-label">Gegevens</span></div>
                        <div class="dg-stepper-item" data-stepper="3" role="listitem"><span class="dg-stepper-dot">3</span><span class="dg-stepper-label">Bevestiging</span></div>
                    </div>
                </div>


                <!-- Step 1 · Calendar + time panel -->
                <div class="dg-step dg-step-calendar" id="dg-step-date" data-step="1">

                    <div class="dg-calendar-area">
                        <p class="dg-pick-label">Selecteer een datum</p>

                        <div class="dg-month-nav">
                            <button class="dg-prev-month" aria-label="Vorige maand">&#8592;</button>
                            <span class="dg-month-label" id="dg-month-label"></span>
                            <button class="dg-next-month" aria-label="Volgende maand">&#8594;</button>
                        </div>

                        <div class="dg-cal-grid" id="dg-cal-grid">
                            <!-- JS renders days here -->
                        </div>
                    </div>

                    <div class="dg-time-panel" id="dg-time-panel">
                        <div class="dg-time-date-label" id="dg-time-date-label"></div>
                        <div id="dg-slots-container">
                            <p class="dg-slots-placeholder">← Selecteer een datum</p>
                        </div>
                    </div>

                </div><!-- /step-1 -->

                <!-- Step 2 · Booking form -->
                <div class="dg-step dg-step-hidden dg-step-form" id="dg-step-form" data-step="2">

                    <div class="dg-form-header">
                        <button class="dg-back-btn" id="dg-back-to-calendar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2.5">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                            Terug
                        </button>
                        <div class="dg-selected-slot-display" id="dg-selected-display"></div>
                    </div>

                    <form class="dg-booking-form" id="dg-booking-form" novalidate>
                        <input type="hidden" id="dg-start-time"    name="start_time">
                        <input type="hidden" id="dg-event-type-id" name="event_type_id"
                               value="<?php echo (int) $et['id']; ?>">

                        <div class="dg-form-group">
                            <label for="dg-name">Naam <span class="dg-req">*</span></label>
                            <input type="text" id="dg-name" name="name"
                                   placeholder="Jan Peeters" autocomplete="name">
                            <span class="dg-field-error" id="dg-error-name"></span>
                        </div>

                        <div class="dg-form-group">
                            <label for="dg-email">E-mailadres <span class="dg-req">*</span></label>
                            <input type="email" id="dg-email" name="email"
                                   placeholder="jan@voorbeeld.be" autocomplete="email">
                            <span class="dg-field-error" id="dg-error-email"></span>
                        </div>

                        <div class="dg-form-group">
                            <label for="dg-phone">Telefoonnummer <span class="dg-req">*</span></label>
                            <input type="tel" id="dg-phone" name="phone"
                                   placeholder="+32 470 12 34 56" autocomplete="tel">
                            <span class="dg-field-error" id="dg-error-phone"></span>
                        </div>

                        <div class="dg-form-group">
                            <label for="dg-notes">Opmerkingen
                                <span class="dg-opt">(optioneel)</span>
                            </label>
                            <textarea id="dg-notes" name="notes" rows="3"
                                      placeholder="Eventuele vragen of opmerkingen..."></textarea>
                        </div>

                        <div class="dg-form-banner" id="dg-form-error-banner" style="display:none"></div>

                        <button type="submit" class="dg-btn-submit" id="dg-submit-btn">
                            <span class="dg-btn-text">Aanvragen</span>
                            <span class="dg-btn-spin" style="display:none">
                                <svg class="dg-spin-anim" width="16" height="16"
                                     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <circle cx="12" cy="12" r="10" stroke-opacity=".25"/>
                                    <path d="M12 2a10 10 0 0 1 10 10"/>
                                </svg>
                            </span>
                        </button>
                    </form>

                </div><!-- /step-2 -->

                <!-- Step 3 · Pending confirmation -->
                <div class="dg-step dg-step-hidden" id="dg-step-confirm" data-step="3">
                    <div class="dg-confirm-screen">
                        <div class="dg-confirm-icon-wrap">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2.5">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                        <h2 class="dg-confirm-title">Aanvraag ontvangen!</h2>
                        <p class="dg-confirm-sub">
                            Je afspraak is aangevraagd en wacht op bevestiging.<br>
                            Je ontvangt een e-mail zodra de afspraak is bevestigd.
                        </p>
                        <div class="dg-booking-summary" id="dg-confirm-details"></div>
                        <button class="dg-btn-outline" id="dg-new-booking">Nieuwe aanvraag</button>
                    </div>
                </div><!-- /step-3 -->

            </div><!-- /.dg-main -->
        </div><!-- /.dg-booking-widget -->
        <?php
        return ob_get_clean();
    }

    /* ---------------------------------------------------------------
     * Stub kept for backward compat
     * ------------------------------------------------------------- */
    private function get_calendar_months( int $count ): array {
        return [];
    }
}
