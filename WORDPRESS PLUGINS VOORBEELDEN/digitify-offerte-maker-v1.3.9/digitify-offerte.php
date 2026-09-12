<?php
/**
 * Plugin Name:  Digitify Offerte Maker
 * Plugin URI:   https://digitify.be
 * Description:  Offerte-configurator voor Digitify – volledig in het WP-dashboard én als website-widget via shortcode [digitify_offerte]. Genereert een PDF en verstuurt deze via e-mail. Offertes worden opgeslagen in de WordPress-database.
 * Version:      1.3.8
 * Author:       Digitify / Klim Gaikalov
 * Author URI:   https://digitify.be
 * License:      Proprietary
 * Text Domain:  digitify-offerte
 */

defined('ABSPATH') || exit;

define('DIGITIFY_OFFERTE_VER','1.3.8');
define('DIGITIFY_OFFERTE_DIR',  plugin_dir_path(__FILE__));
define('DIGITIFY_OFFERTE_URL',  plugin_dir_url(__FILE__));
define('DIGITIFY_QUOTES_OPTION',   'digitify_offerte_quotes');
define('DIGITIFY_SETTINGS_OPTION', 'digitify_offerte_settings');

// Query var + endpoint voor iframe-embed (CSS-isolatie)
define('DIGITIFY_EMBED_QV', 'digitify_offerte_embed');

// Publieke token om AJAX te laten werken in iframes wanneer cookies/nonce geblokkeerd worden
// (bv. door SameSite third‑party cookie restricties).
define('DIGITIFY_PUBLIC_TOKEN_OPT', 'digitify_offerte_public_token');


require_once DIGITIFY_OFFERTE_DIR . 'includes/dap-agenda-pro.php';

// ─────────────────────────────────────────────────────────
// CRM CORE INTEGRATIE (Digitify CRM Core)
// - Dedupe op e-mail
// - Upsert contact + log timeline events
// - Faalt stilletjes als CRM Core niet actief is
// ─────────────────────────────────────────────────────────
function digitify_offerte_crm_is_active(): bool {
    return function_exists('digitify_crm_log_event') && function_exists('digitify_crm_upsert_contact');
}

/**
 * Upsert contact + log event in CRM Core.
 *
 * @param array  $client  client array (name/bedrijf/email/telefoon)
 * @param array  $quote   quote record (ref, totals, pdfFile, etc.)
 * @param string $event_type  event type in crm (sanitize_key)
 * @param string $summary
 * @param array  $meta
 */
function digitify_offerte_push_to_crm(array $client, array $quote, string $event_type, string $summary = '', array $meta = []): void {
    if (!digitify_offerte_crm_is_active()) return;

    $email = isset($client['email']) ? sanitize_email((string)$client['email']) : '';
    if (!is_email($email)) return;

    $name = '';
    if (!empty($client['bedrijf'])) $name = (string)$client['bedrijf'];
    if (empty($name) && !empty($client['name'])) $name = (string)$client['name'];

    $tel = '';
    if (!empty($client['telefoon'])) $tel = (string)$client['telefoon'];
    if (empty($tel) && !empty($client['tel'])) $tel = (string)$client['tel'];

    // Upsert contact (dedupe op e-mail)
    $upsert = [
        'email'  => $email,
        'name'   => $name,
        'tel'    => $tel,
        'source' => 'offerte',
    ];

    // Optioneel: status/pipeline_stage doorgeven als het in quote zit
    if (!empty($quote['status'])) {
        $upsert['status'] = (string)$quote['status'];
    }
    if (!empty($quote['pipeline_stage'])) {
        $upsert['pipeline_stage'] = (string)$quote['pipeline_stage'];
    }

    $contact_id = digitify_crm_upsert_contact($upsert, [
        'log_event' => false,
        'source_app'=> 'offerte',
    ]);

    // Event meta verrijken
    $payload = array_merge([
        'ref'        => $quote['ref']        ?? '',
        'grandTotal' => $quote['grandTotal'] ?? 0,
        'date'       => $quote['date']       ?? '',
        'expDate'    => $quote['expDate']    ?? '',
        'pdfFile'    => $quote['pdfFile']    ?? '',
        'client'     => [
            'name'    => $name,
            'email'   => $email,
            'tel'     => $tel,
            'bedrijf' => $client['bedrijf'] ?? '',
        ],
    ], $meta);

    // Log event
    digitify_crm_log_event(
        $email,
        $event_type,
        array_merge($payload, [ 'name' => $name, 'tel' => $tel ]),
        $summary ?: $event_type,
        current_time('mysql'),
        'offerte'
    );
}


// ─────────────────────────────────────────────────────────
// 1. MENU REGISTRATIE
// ─────────────────────────────────────────────────────────
add_action('admin_menu', 'digitify_register_menus');
function digitify_register_menus() {
    // Hoofdmenu
    add_menu_page(
        'Digitify Offerte',
        'Digitify Offerte',
        'manage_options',
        'digitify-offerte',
        'digitify_render_configurator_page',
        'dashicons-money-alt',
        26
    );
    // Subpagina: configurator
    add_submenu_page(
        'digitify-offerte',
        'Nieuwe Offerte',
        'Nieuwe Offerte',
        'manage_options',
        'digitify-offerte',
        'digitify_render_configurator_page'
    );
    // Subpagina: offerteoverzicht
    add_submenu_page(
        'digitify-offerte',
        'Offertes Beheren',
        'Offertes Beheren',
        'manage_options',
        'digitify-offertes-admin',
        'digitify_render_admin_page'
    );
    // Subpagina: instellingen
    add_submenu_page(
        'digitify-offerte',
        'Instellingen',
        '⚙️ Instellingen',
        'manage_options',
        'digitify-instellingen',
        'digitify_render_settings_page'
    );
}

// ─────────────────────────────────────────────────────────
// 0. EMBED ENDPOINT (voor iframe)
//    URL: /digitify-offerte/embed/
// ─────────────────────────────────────────────────────────
add_action('init', function () {
    add_rewrite_rule('^digitify-offerte/embed/?$', 'index.php?' . DIGITIFY_EMBED_QV . '=1', 'top');
});

add_filter('query_vars', function ($vars) {
    $vars[] = DIGITIFY_EMBED_QV;
    return $vars;
});

add_action('template_redirect', function () {
    if (!get_query_var(DIGITIFY_EMBED_QV)) {
        return;
    }

    // Geen theme/template laden – we renderen een standalone embed
    status_header(200);
    nocache_headers();

    // Assets voor embed laden
    digitify_enqueue_embed_assets();

    $settings = digitify_get_settings();
    $bg = !empty($settings['embed_bg']) ? $settings['embed_bg'] : '#121212';

    ?><!doctype html>
    <html <?php language_attributes(); ?>>
    <head>
        <meta charset="<?php bloginfo('charset'); ?>" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title><?php echo esc_html__('Digitify Offerte', 'digitify-offerte'); ?></title>
        <?php wp_print_styles(); ?>
    </head>
    <body style="margin:0;background:<?php echo esc_attr($bg); ?>">
        <div style="padding:20px;box-sizing:border-box;min-height:100vh;">
            <?php
            // Render configurator in shortcode-mode
            $digitify_is_shortcode = true;
            include DIGITIFY_OFFERTE_DIR . 'templates/configurator.php';
            ?>
        </div>
        <?php wp_print_scripts(); ?>
    </body>
    </html>
    <?php
    exit;
});

// ─────────────────────────────────────────────────────────
// 2. SCRIPTS & STYLES LADEN (WP admin)
// ─────────────────────────────────────────────────────────
add_action('admin_enqueue_scripts', 'digitify_enqueue_assets');
function digitify_enqueue_assets($hook) {
    $allowed_hooks = [
        'toplevel_page_digitify-offerte',
        'digitify-offerte_page_digitify-offertes-admin',
        'digitify-offerte_page_digitify-instellingen',
    ];
    if (!in_array($hook, $allowed_hooks)) {
        return;
    }

    // Google Fonts + plugin stijlen (alle pagina's)
    wp_enqueue_style('plus-jakarta-sans', 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    wp_enqueue_style('digitify-offerte-css', DIGITIFY_OFFERTE_URL.'assets/css/style.css', [], DIGITIFY_OFFERTE_VER);

    // jsPDF enkel voor pagina's die PDF genereren
    $needs_jspdf = in_array($hook, ['toplevel_page_digitify-offerte', 'digitify-offerte_page_digitify-offertes-admin']);
    if ($needs_jspdf) {
        wp_enqueue_script('jspdf',      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',                         [], null, true);
        wp_enqueue_script('jspdf-auto', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',  ['jspdf'], null, true);
    }

    if ($hook === 'toplevel_page_digitify-offerte') {
        wp_enqueue_script('digitify-logo', DIGITIFY_OFFERTE_URL.'assets/js/logo-b64.js',  [], DIGITIFY_OFFERTE_VER, true);
        wp_enqueue_script('digitify-app',  DIGITIFY_OFFERTE_URL.'assets/js/app-wp.js',    ['jspdf','jspdf-auto','digitify-logo'], DIGITIFY_OFFERTE_VER, true);
                $app_settings = digitify_get_settings();
        unset($app_settings['smtp_pass']);
wp_localize_script('digitify-app', 'digitifyWP', [
            'ajaxUrl'  => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('digitify_send_quote'),
            'publicToken' => get_option(DIGITIFY_PUBLIC_TOKEN_OPT, ''),
            'adminUrl' => admin_url('admin.php?page=digitify-offertes-admin'),
            'isAdmin'  => current_user_can('manage_options') ? '1' : '0',
    'settings' => $app_settings,
]);
    }

    if ($hook === 'digitify-offerte_page_digitify-offertes-admin') {
        // Logo ook laden voor factuur PDF header
        wp_enqueue_script('digitify-logo',     DIGITIFY_OFFERTE_URL.'assets/js/logo-b64.js',   [], DIGITIFY_OFFERTE_VER, true);
        wp_enqueue_script('digitify-admin-js', DIGITIFY_OFFERTE_URL.'assets/js/admin-wp.js',   ['jspdf','jspdf-auto','digitify-logo'], DIGITIFY_OFFERTE_VER, true);
        $admin_settings = digitify_get_settings();
        unset($admin_settings['smtp_pass']); // nooit wachtwoord naar client
        wp_localize_script('digitify-admin-js', 'digitifyAdmin', [
            'ajaxUrl'   => admin_url('admin-ajax.php'),
            'nonce'     => wp_create_nonce('digitify_admin'),
            'quotes'    => digitify_get_quotes(),
            'configUrl' => admin_url('admin.php?page=digitify-offerte'),
            'settings'  => $admin_settings,
        ]);
    }

    if ($hook === 'digitify-offerte_page_digitify-instellingen') {
        wp_enqueue_script('digitify-logo',        DIGITIFY_OFFERTE_URL.'assets/js/logo-b64.js',    [], DIGITIFY_OFFERTE_VER, true);
        wp_enqueue_script('digitify-settings-js', DIGITIFY_OFFERTE_URL.'assets/js/settings-wp.js', ['digitify-logo'], DIGITIFY_OFFERTE_VER, true);
        $page_settings = digitify_get_settings();
        unset($page_settings['smtp_pass']); // nooit wachtwoord naar client
        wp_localize_script('digitify-settings-js', 'digitifySettings', [
            'ajaxUrl'  => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('digitify_settings'),
            'settings' => $page_settings,
        ]);
    }
}

// ─────────────────────────────────────────────────────────
// 3. SCRIPTS & STYLES LADEN (Frontend – shortcode)
// ─────────────────────────────────────────────────────────
add_action('wp_enqueue_scripts', 'digitify_enqueue_frontend_assets');
function digitify_enqueue_frontend_assets() {
    // Alleen laden als de shortcode aanwezig is op de huidige pagina
    global $post;
    if (!is_a($post, 'WP_Post') || !has_shortcode($post->post_content, 'digitify_offerte')) {
        return;
    }

    wp_enqueue_script('jspdf',       'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',                         [], null, true);
    wp_enqueue_script('jspdf-auto',  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',  ['jspdf'], null, true);
    wp_enqueue_style('plus-jakarta-sans', 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    wp_enqueue_style('digitify-offerte-css', DIGITIFY_OFFERTE_URL.'assets/css/style.css', [], DIGITIFY_OFFERTE_VER);
    wp_enqueue_script('digitify-logo', DIGITIFY_OFFERTE_URL.'assets/js/logo-b64.js', [], DIGITIFY_OFFERTE_VER, true);
    wp_enqueue_script('digitify-app',  DIGITIFY_OFFERTE_URL.'assets/js/app-wp.js',   ['jspdf','jspdf-auto','digitify-logo'], DIGITIFY_OFFERTE_VER, true);

    // Frontend: nooit redirecten – toon enkel bedankt-popup
            $app_settings = digitify_get_settings();
        unset($app_settings['smtp_pass']);
wp_localize_script('digitify-app', 'digitifyWP', [
        'ajaxUrl'  => admin_url('admin-ajax.php'),
        'nonce'    => wp_create_nonce('digitify_send_quote'),
        'adminUrl' => '', // altijd leeg op frontend – geen redirect
        'isAdmin'  => current_user_can('manage_options') ? '1' : '0',
    'settings' => $app_settings,
]);
}

// Assets voor standalone embed (iframe)
function digitify_enqueue_embed_assets() {
    // jsPDF
    wp_enqueue_script('jspdf',       'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',                         [], null, true);
    wp_enqueue_script('jspdf-auto',  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',  ['jspdf'], null, true);

    // Fonts + stijl
    wp_enqueue_style('plus-jakarta-sans', 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    wp_enqueue_style('digitify-offerte-css', DIGITIFY_OFFERTE_URL.'assets/css/style.css', [], DIGITIFY_OFFERTE_VER);

    // App
    wp_enqueue_script('digitify-logo', DIGITIFY_OFFERTE_URL.'assets/js/logo-b64.js', [], DIGITIFY_OFFERTE_VER, true);
    wp_enqueue_script('digitify-app',  DIGITIFY_OFFERTE_URL.'assets/js/app-wp.js',   ['jspdf','jspdf-auto','digitify-logo'], DIGITIFY_OFFERTE_VER, true);

            $app_settings = digitify_get_settings();
        unset($app_settings['smtp_pass']);
wp_localize_script('digitify-app', 'digitifyWP', [
        'ajaxUrl'  => admin_url('admin-ajax.php'),
        'nonce'    => wp_create_nonce('digitify_send_quote'),
        'publicToken' => get_option(DIGITIFY_PUBLIC_TOKEN_OPT, ''),
        'adminUrl' => '',
        'isAdmin'  => current_user_can('manage_options') ? '1' : '0',
    'settings' => $app_settings,
]);
}

// ─────────────────────────────────────────────────────────
// 4. SHORTCODE  [digitify_offerte]
// ─────────────────────────────────────────────────────────
add_shortcode('digitify_offerte', 'digitify_render_shortcode');
function digitify_render_shortcode($atts) {
    $atts = shortcode_atts([
        'mode'   => 'iframe', // iframe | inline
        'height' => '980',
    ], $atts, 'digitify_offerte');

    // Inline (zoals vroeger)
    if ($atts['mode'] === 'inline') {
        $digitify_is_shortcode = true;
        ob_start();
        include DIGITIFY_OFFERTE_DIR.'templates/configurator.php';
        return ob_get_clean();
    }

    // Iframe (aanbevolen – voorkomt CSS-conflicten met theme/Elementor)
    $settings = digitify_get_settings();
    $bg = !empty($settings['embed_bg']) ? $settings['embed_bg'] : '#121212';
    $src = home_url('/digitify-offerte/embed/');
    $h = preg_replace('/[^0-9]/', '', (string)$atts['height']);
    if ($h === '') { $h = '980'; }

    return '<div class="digitify-iframe-wrap" style="background:' . esc_attr($bg) . ';padding:16px;border-radius:18px;overflow:hidden;box-sizing:border-box">'
         . '<iframe title="Digitify Offerte" src="' . esc_url($src) . '" style="width:100%;height:' . esc_attr($h) . 'px;border:0;display:block;background:transparent" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>'
         . '</div>';
}

// Backwards compatible alias (zoals vermeld in oudere settings-pagina)
add_shortcode('digitify_offerte_iframe', function($atts){
    $atts = shortcode_atts(['height' => '980'], $atts, 'digitify_offerte_iframe');
    return digitify_render_shortcode(['mode' => 'iframe', 'height' => $atts['height']]);
});

// ─────────────────────────────────────────────────────────
// 5. CONFIGURATOR PAGINA (WP admin)
// ─────────────────────────────────────────────────────────
function digitify_render_configurator_page() {
    if (!current_user_can('manage_options')) {
        wp_die(__('Geen toegang', 'digitify-offerte'));
    }
    include DIGITIFY_OFFERTE_DIR.'templates/configurator.php';
}

// ─────────────────────────────────────────────────────────
// 6. ADMIN OFFERTES PAGINA
// ─────────────────────────────────────────────────────────
function digitify_render_admin_page() {
    if (!current_user_can('manage_options')) {
        wp_die(__('Geen toegang', 'digitify-offerte'));
    }
    include DIGITIFY_OFFERTE_DIR.'templates/admin-page.php';
}

// ─────────────────────────────────────────────────────────
// 7a. INSTELLINGEN PAGINA
// ─────────────────────────────────────────────────────────
function digitify_render_settings_page() {
    if (!current_user_can('manage_options')) {
        wp_die(__('Geen toegang', 'digitify-offerte'));
    }
    include DIGITIFY_OFFERTE_DIR.'templates/settings-page.php';
}

// ─────────────────────────────────────────────────────────
// 7. HELPERS: OFFERTES OPSLAAN / LEZEN
// ─────────────────────────────────────────────────────────
function digitify_get_quotes() {
    $raw = get_option(DIGITIFY_QUOTES_OPTION, '[]');
    $arr = json_decode($raw, true);
    return is_array($arr) ? $arr : [];
}

function digitify_save_quotes(array $quotes) {
    $s = digitify_get_settings();
    $limit = max(50, min(1000, intval($s['quote_limit'] ?? 200)));
    if (count($quotes) > $limit) {
        $quotes = array_slice($quotes, 0, $limit);
    }
    update_option(DIGITIFY_QUOTES_OPTION, wp_json_encode($quotes), false);
}

// ─────────────────────────────────────────────────────────
// 7b. HELPERS: INSTELLINGEN OPSLAAN / LEZEN
// ─────────────────────────────────────────────────────────
function digitify_get_settings() {
    $raw = get_option(DIGITIFY_SETTINGS_OPTION, '{}');
    $arr = json_decode($raw, true);
    $arr = is_array($arr) ? $arr : [];

    // Defaults (zodat nieuwe velden niet "undefined" zijn)
    $defaults = [
        'embed_bg'        => '#121212',
        'payment_days'    => 30,
        'invoice_footer'  => '',
        'accent_color'    => '#ffaf51',
        'default_btw'     => '21',
        'invoice_prefix'  => 'FACT',
        'offerte_prefix'  => 'OFF',
        'debug_mode'      => '0',
        'quote_limit'     => '200',
        'hide_prices_ui'  => '0',
    ];
    return array_merge($defaults, $arr);
}

// ─────────────────────────────────────────────────────────
// 7c. SMTP CONFIGURATIE VIA phpmailer_init
// ─────────────────────────────────────────────────────────
add_action('phpmailer_init', 'digitify_configure_smtp');
function digitify_configure_smtp($phpmailer) {
    $s = digitify_get_settings();
    if (empty($s['smtp_host']) || empty($s['smtp_user'])) {
        return; // SMTP niet geconfigureerd – gebruik standaard WP mail
    }
    $phpmailer->isSMTP();
    $phpmailer->Host     = $s['smtp_host'];
    $phpmailer->SMTPAuth = true;
    $phpmailer->Port     = intval($s['smtp_port'] ?: 587);
    $phpmailer->Username = $s['smtp_user'];
    $phpmailer->Password = $s['smtp_pass'] ?? '';

    $enc = $s['smtp_enc'] ?? 'tls';
    if ($enc === 'ssl') {
        $phpmailer->SMTPSecure = 'ssl';
    } elseif ($enc === 'tls') {
        $phpmailer->SMTPSecure = 'tls';
    } else {
        $phpmailer->SMTPSecure  = '';
        $phpmailer->SMTPAutoTLS = false;
    }
}

// ─────────────────────────────────────────────────────────
// 8. PDF OPSLAAN IN UPLOADS MAP
// ─────────────────────────────────────────────────────────
function digitify_save_pdf_file($ref, $pdf_bytes) {
    $upload_dir = wp_upload_dir();
    $pdf_dir    = trailingslashit($upload_dir['basedir']) . 'digitify-offerte';
    if (!file_exists($pdf_dir)) {
        wp_mkdir_p($pdf_dir);
        // Verberg map voor directe browse-toegang
        file_put_contents($pdf_dir . '/.htaccess', "Options -Indexes\nDeny from all\n");
        file_put_contents($pdf_dir . '/index.php', '<?php // Silence is golden');
    }
    $filename = sanitize_file_name($ref) . '.pdf';
    file_put_contents($pdf_dir . '/' . $filename, $pdf_bytes);
    return $filename;
}

// ─────────────────────────────────────────────────────────
// 9. AJAX: OFFERTE VERSTUREN (admin + frontend)
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_send_quote',        'digitify_ajax_send_quote');
add_action('wp_ajax_nopriv_digitify_send_quote', 'digitify_ajax_send_quote'); // frontend bezoekers
function digitify_ajax_send_quote() {
    // In embedded/iframe context kunnen cookies geblokkeerd zijn (SameSite),
    // waardoor WordPress nonces soms falen. Daarom ondersteunen we een publieke token.
    $nonce_ok = false;
    if (isset($_POST['nonce']) && is_string($_POST['nonce'])) {
        $nonce_ok = (bool) wp_verify_nonce($_POST['nonce'], 'digitify_send_quote');
    }
    if (!$nonce_ok) {
        $pub = isset($_POST['publicToken']) ? (string) $_POST['publicToken'] : '';
        $exp = (string) get_option(DIGITIFY_PUBLIC_TOKEN_OPT, '');
        if (empty($exp) || empty($pub) || !hash_equals($exp, $pub)) {
            wp_send_json_error(['msg' => 'Beveiligingscontrole mislukt (token/nonce).'], 403);
        }
    }

    $ref        = sanitize_text_field($_POST['ref']       ?? '');
    $date_str   = sanitize_text_field($_POST['date']      ?? '');
    $exp_str    = sanitize_text_field($_POST['expDate']   ?? '');
    $grand_total= floatval($_POST['grandTotal']           ?? 0);
    $client_raw = stripslashes($_POST['client']           ?? '{}');
    $items_raw  = stripslashes($_POST['items']            ?? '[]');
    $cart_raw   = stripslashes($_POST['cartItems']        ?? '[]');
    $pdf_b64    = $_POST['pdfB64']                        ?? '';
    $edit_ref   = sanitize_text_field($_POST['editRef']   ?? '');

    $client    = json_decode($client_raw, true) ?: [];
    $items     = json_decode($items_raw,  true) ?: [];
    $cart_items= json_decode($cart_raw,   true) ?: [];

    $client_name = trim(($client['bedrijf'] ?? '') ?: ($client['name'] ?? 'Klant'));

    // ── PDF tijdelijk opslaan voor e-mailbijlage + permanente opslag ──
    $tmp_file    = null;
    $pdf_file    = null;
    $attachments = [];
    if (!empty($pdf_b64)) {
        $b64_clean = preg_replace('/^data:[^;]+;base64,/', '', $pdf_b64);
        $pdf_bytes = base64_decode($b64_clean);
        if ($pdf_bytes !== false) {
            // Tijdelijk bestand voor e-mailbijlage
            // wp_tempnam() maakt een leeg bestand aan – verwijder dit om .tmp-weesvbestanden te vermijden
            $tmp_base = wp_tempnam('digitify_offerte_');
            @unlink($tmp_base);
            $tmp_file = $tmp_base . '.pdf';
            file_put_contents($tmp_file, $pdf_bytes);
            $attachments[] = $tmp_file;
            // Permanent opslaan in uploads/digitify-offerte/
            try {
                $pdf_file = digitify_save_pdf_file($ref, $pdf_bytes);
            } catch(Exception $e) {
                error_log('Digitify: PDF opslaan mislukt – ' . $e->getMessage());
            }
        }
    }

    // ── E-mail samenstellen ──────────────────────────────
    $mail_settings = digitify_get_settings();
    $to            = !empty($mail_settings['notify_email']) ? sanitize_email($mail_settings['notify_email']) : get_option('admin_email');
    $from_email    = !empty($mail_settings['from_email'])   ? sanitize_email($mail_settings['from_email'])   : get_option('admin_email');
    $from_name     = !empty($mail_settings['from_name'])    ? $mail_settings['from_name']                    : 'Digitify Offerte Systeem';
    $subject = sprintf('Nieuwe Offerte %s – %s', $ref, $client_name);
    $message = sprintf(
        "Beste,\n\nEen nieuwe offerte werd ingediend via de Digitify Offerte Configurator.\n\n" .
        "Referentie  : %s\n" .
        "Klant       : %s\n" .
        "Bedrijf     : %s\n" .
        "E-mail      : %s\n" .
        "Telefoon    : %s\n" .
        "Datum       : %s\n" .
        "Geldig tot  : %s\n" .
        "Totaal      : € %s\n\n" .
        "De offerte-PDF is als bijlage toegevoegd.\n\n" .
        "Met vriendelijke groeten,\nDigitify Offerte Systeem",
        $ref,
        $client['name']     ?? '—',
        $client['bedrijf']  ?? '—',
        $client['email']    ?? '—',
        $client['telefoon'] ?? '—',
        $date_str,
        $exp_str,
        number_format($grand_total, 2, ',', '.')
    );

    // Correcte From-header zodat e-mail niet in spam belandt
    $headers = [
        'Content-Type: text/plain; charset=UTF-8',
        "From: {$from_name} <{$from_email}>",
    ];

    // Tijdelijk wp_mail filters toevoegen voor correcte afzender
    $set_from      = function() use ($from_email) { return $from_email; };
    $set_from_name = function() use ($from_name)  { return $from_name; };
    add_filter('wp_mail_from',      $set_from);
    add_filter('wp_mail_from_name', $set_from_name);

    $mail_sent = wp_mail($to, $subject, $message, $headers, $attachments);

    remove_filter('wp_mail_from',      $set_from);
    remove_filter('wp_mail_from_name', $set_from_name);

    // ── Tijdelijk PDF-bestand verwijderen ────────────────
    if ($tmp_file && file_exists($tmp_file)) {
        @unlink($tmp_file);
    }

    // ── Offerte record opbouwen ──────────────────────────
    $quote_record = [
        'ref'        => $ref,
        'date'       => $date_str,
        'expDate'    => $exp_str,
        'grandTotal' => $grand_total,
        'client'     => $client,
        'items'      => $items,
        'cartItems'  => $cart_items,   // volledig cart voor re-edit in configurator
        'note'       => '',
        'savedAt'    => current_time('mysql'),
        'pdfFile'    => $pdf_file ?: '',
    ];

    $quotes = digitify_get_quotes();

    // Als editRef meegegeven: bestaande offerte overschrijven
    if (!empty($edit_ref)) {
        $found = false;
        foreach ($quotes as $i => $q) {
            if (($q['ref'] ?? '') === $edit_ref) {
                // Behoud originele note indien aanwezig
                $quote_record['note'] = $q['note'] ?? '';
                $quotes[$i] = $quote_record;
                $found = true;
                break;
            }
        }
        if (!$found) {
            // Niet gevonden → gewoon prependen
            array_unshift($quotes, $quote_record);
        }
    } else {
        array_unshift($quotes, $quote_record);
    }

    digitify_save_quotes($quotes);

    // Agenda Pro sync (creates agenda item on submission day)
    if ( function_exists('digitify_offerte_emit_agenda_event') ) {
        $submitted_at = current_time('mysql');
        digitify_offerte_emit_agenda_event([
            'ref'            => $ref,
            'offerte_id'     => $edit_ref ?: $ref,
            'submitted_at'   => $submitted_at,
            'submitted_date' => date('Y-m-d', strtotime($submitted_at)),
            'client'         => is_array($client) ? $client : [],
            'quote'          => is_array($quote_record) ? $quote_record : [],
        ]);
    }


    // CRM Core sync: contact upsert + event log
    try {
        digitify_offerte_push_to_crm($client, $quote_record, 'quote_submitted', 'Offerte ingediend', [
            'itemsCount' => is_array($items) ? count($items) : 0,
            'cartCount'  => is_array($cart_items) ? count($cart_items) : 0,
            'mailSent'   => (bool) $mail_sent,
        ]);
    } catch (Exception $e) {
        // nooit blokkeren op CRM
        error_log('Digitify Offerte CRM sync error: ' . $e->getMessage());
    }

    if ($mail_sent) {
        wp_send_json_success(['ref' => $ref, 'msg' => 'Offerte verstuurd en opgeslagen.']);
    } else {
        wp_send_json_success(['ref' => $ref, 'msg' => 'Offerte opgeslagen. E-mail versturen mislukt – controleer uw WP Mail-configuratie.', 'mailError' => true]);
    }
}

// ─────────────────────────────────────────────────────────
// 10. AJAX: PDF DOWNLOADEN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_download_pdf', 'digitify_ajax_download_pdf');
function digitify_ajax_download_pdf() {
    check_ajax_referer('digitify_admin', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    $ref = sanitize_text_field($_POST['ref'] ?? '');
    if (empty($ref)) {
        wp_send_json_error(['msg' => 'Geen referentie opgegeven']);
    }
    $upload_dir = wp_upload_dir();
    $pdf_path   = trailingslashit($upload_dir['basedir']) . 'digitify-offerte/' . sanitize_file_name($ref) . '.pdf';
    if (!file_exists($pdf_path)) {
        wp_send_json_error(['msg' => 'PDF niet gevonden. Mogelijk werd de offerte aangemaakt vóór versie 1.1.0.']);
    }
    $pdf_b64 = base64_encode(file_get_contents($pdf_path));
    wp_send_json_success(['pdfB64' => $pdf_b64, 'ref' => $ref]);
}

// ─────────────────────────────────────────────────────────
// 11. AJAX: OFFERTE BEWERKEN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_update_quote', 'digitify_ajax_update_quote');
function digitify_ajax_update_quote() {
    check_ajax_referer('digitify_admin', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    $idx  = intval($_POST['idx'] ?? -1);
    $data = json_decode(stripslashes($_POST['data'] ?? '{}'), true) ?: [];
    if ($idx < 0 || empty($data)) {
        wp_send_json_error(['msg' => 'Ongeldige data']);
    }
    $quotes = digitify_get_quotes();
    if (!isset($quotes[$idx])) {
        wp_send_json_error(['msg' => 'Offerte niet gevonden']);
    }
    if (isset($data['client']))     $quotes[$idx]['client']     = array_map('sanitize_text_field', $data['client']);
    if (isset($data['expDate']))    $quotes[$idx]['expDate']    = sanitize_text_field($data['expDate']);
    if (isset($data['grandTotal'])) $quotes[$idx]['grandTotal'] = floatval($data['grandTotal']);
    if (isset($data['note']))       $quotes[$idx]['note']       = sanitize_textarea_field($data['note']);
    digitify_save_quotes($quotes);

    // CRM Core sync: status/toggles loggen
    try {
        $q = $quotes[$idx];
        $c = $q['client'] ?? [];
        $meta = [ 'field' => $field, 'value' => $field === 'status' ? ($q['status'] ?? '') : (bool)($q[$field] ?? false) ];
        digitify_offerte_push_to_crm($c, $q, 'quote_status_updated', 'Offerte status bijgewerkt', $meta);
    } catch (Exception $e) {
        error_log('Digitify Offerte CRM sync error (status): ' . $e->getMessage());
    }

    wp_send_json_success(['msg' => 'Opgeslagen']);
}

// ─────────────────────────────────────────────────────────
// 12. AJAX: OFFERTE VERWIJDEREN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_delete_quote', 'digitify_ajax_delete_quote');
function digitify_ajax_delete_quote() {
    check_ajax_referer('digitify_admin', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    $idx = intval($_POST['idx'] ?? -1);
    if ($idx < 0) {
        wp_send_json_error(['msg' => 'Ongeldig index']);
    }
    $quotes = digitify_get_quotes();
    if (isset($quotes[$idx])) {
        // Verwijder ook het PDF-bestand als het bestaat
        $ref = $quotes[$idx]['ref'] ?? '';
        if ($ref) {
            $upload_dir = wp_upload_dir();
            $pdf_path   = trailingslashit($upload_dir['basedir']) . 'digitify-offerte/' . sanitize_file_name($ref) . '.pdf';
            if (file_exists($pdf_path)) @unlink($pdf_path);
        }
        array_splice($quotes, $idx, 1);
        digitify_save_quotes($quotes);
    }
    wp_send_json_success(['msg' => 'Verwijderd']);
}

// ─────────────────────────────────────────────────────────
// 13. AJAX: ALLE OFFERTES WISSEN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_clear_quotes', 'digitify_ajax_clear_quotes');
function digitify_ajax_clear_quotes() {
    check_ajax_referer('digitify_admin', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    // Verwijder ook alle PDF-bestanden
    $upload_dir = wp_upload_dir();
    $pdf_dir    = trailingslashit($upload_dir['basedir']) . 'digitify-offerte';
    if (is_dir($pdf_dir)) {
        $files = glob($pdf_dir . '/*.pdf');
        if ($files) { foreach ($files as $f) @unlink($f); }
    }
    delete_option(DIGITIFY_QUOTES_OPTION);
    wp_send_json_success(['msg' => 'Alles gewist']);
}

// ─────────────────────────────────────────────────────────
// 14. AJAX: INSTELLINGEN OPSLAAN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_save_settings', 'digitify_ajax_save_settings');
function digitify_ajax_save_settings() {
    check_ajax_referer('digitify_settings', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    $raw = stripslashes($_POST['settings'] ?? '{}');
    $new = json_decode($raw, true) ?: [];

    $text_keys = [
        'company_name', 'company_btw', 'company_address', 'company_city',
        'company_email', 'company_phone', 'company_website', 'company_iban',
        'notify_email', 'from_name', 'from_email',
        'smtp_host', 'smtp_port', 'smtp_enc', 'smtp_user',
        'payment_days',
        'embed_bg',
        'accent_color', 'default_btw', 'invoice_prefix', 'offerte_prefix',
        'debug_mode', 'quote_limit', 'hide_prices_ui',
    ];

    // Behoud bestaande instellingen als basis
    $existing = digitify_get_settings();
    $settings = $existing;

    foreach ($text_keys as $key) {
        if (array_key_exists($key, $new)) {
            $settings[$key] = sanitize_text_field($new[$key]);
        }
    }
    // Veld met regeleinden
    if (array_key_exists('invoice_footer', $new)) {
        $settings['invoice_footer'] = sanitize_textarea_field($new['invoice_footer']);
    }
    // Wachtwoord: alleen bijwerken als opgegeven
    if (!empty($new['smtp_pass'])) {
        $settings['smtp_pass'] = $new['smtp_pass'];
    }

    update_option(DIGITIFY_SETTINGS_OPTION, wp_json_encode($settings), false);
    wp_send_json_success(['msg' => 'Instellingen opgeslagen']);
}

// ─────────────────────────────────────────────────────────
// 15. AJAX: INSTELLINGEN OPHALEN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_get_settings', 'digitify_ajax_get_settings');
function digitify_ajax_get_settings() {
    check_ajax_referer('digitify_settings', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    $s = digitify_get_settings();
    unset($s['smtp_pass']); // Stuur nooit wachtwoord naar client
    wp_send_json_success(['settings' => $s]);
}

// ─────────────────────────────────────────────────────────
// 16. AJAX: SMTP TEST E-MAIL
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_test_smtp', 'digitify_ajax_test_smtp');
function digitify_ajax_test_smtp() {
    check_ajax_referer('digitify_settings', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    $to = sanitize_email($_POST['to'] ?? '');
    if (!is_email($to)) {
        wp_send_json_error(['msg' => 'Ongeldig e-mailadres']);
    }
    $s          = digitify_get_settings();
    $from_email = !empty($s['from_email']) ? sanitize_email($s['from_email']) : get_option('admin_email');
    $from_name  = !empty($s['from_name'])  ? $s['from_name'] : 'Digitify';

    $result = wp_mail(
        $to,
        'Digitify SMTP Test – ' . date('Y-m-d H:i:s'),
        "Dit is een test e-mail van de Digitify Offerte Plugin.\n\n" .
        "Als u dit bericht ontvangt, werkt uw SMTP-configuratie correct.\n\n" .
        "Met vriendelijke groeten,\nDigitify Offerte Systeem",
        [
            'Content-Type: text/plain; charset=UTF-8',
            "From: {$from_name} <{$from_email}>",
        ]
    );

    if ($result) {
        wp_send_json_success(['msg' => 'Test e-mail verstuurd naar ' . $to]);
    } else {
        global $phpmailer;
        $err = (is_object($phpmailer) && !empty($phpmailer->ErrorInfo)) ? $phpmailer->ErrorInfo : 'Onbekende fout';
        wp_send_json_error(['msg' => 'Versturen mislukt: ' . $err]);
    }
}

// ─────────────────────────────────────────────────────────
// 17. AJAX: STATUS / BOOLEANS BIJWERKEN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_update_quote_status', 'digitify_ajax_update_quote_status');
function digitify_ajax_update_quote_status() {
    check_ajax_referer('digitify_admin', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    $idx   = intval($_POST['idx']   ?? -1);
    $field = sanitize_key($_POST['field'] ?? '');
    $value = $_POST['value'] ?? '';

    // Boolean velden die we in de admin UI tonen
    $allowed_fields = ['status', 'offerte_verstuurd', 'factuur_verstuurd', 'voorschot_verstuurd', 'voorstel_verstuurd'];
    if ($idx < 0 || !in_array($field, $allowed_fields, true)) {
        wp_send_json_error(['msg' => 'Ongeldig verzoek']);
    }

    $quotes = digitify_get_quotes();
    if (!isset($quotes[$idx])) {
        wp_send_json_error(['msg' => 'Offerte niet gevonden']);
    }

    if ($field === 'status') {
        $allowed = ['aanvaard', 'geweigerd', 'opvolgen', 'voorstel', ''];
        $status = sanitize_text_field($value);
        if (!in_array($status, $allowed, true)) {
            wp_send_json_error(['msg' => 'Ongeldige status']);
        }
        $quotes[$idx]['status'] = $status;
    } else {
        // Boolean veld (offerte_verstuurd / factuur_verstuurd)
        $quotes[$idx][$field] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    digitify_save_quotes($quotes);
    wp_send_json_success(['msg' => 'Bijgewerkt']);
}

// ─────────────────────────────────────────────────────────
// 18. AJAX: DOCUMENT PER E-MAIL VERSTUREN (met HTML-template)
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_send_document_email', 'digitify_ajax_send_document_email');
function digitify_ajax_send_document_email() {
    check_ajax_referer('digitify_admin', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }

    $idx             = intval($_POST['idx']            ?? -1);
    $type            = sanitize_text_field($_POST['type']         ?? 'offerte');
    $to              = sanitize_email($_POST['to']                ?? '');
    $personal_msg    = sanitize_textarea_field(stripslashes($_POST['message']  ?? ''));
    $custom_subject  = sanitize_text_field(stripslashes($_POST['subject']      ?? ''));
    $voorschot_pct   = max(1, min(100, intval($_POST['voorschotPct'] ?? 50)));
    // Optionele bijlage (voor alle types)
    $attachment_b64  = $_POST['attachmentB64']                    ?? '';
    $attachment_name = sanitize_file_name(stripslashes($_POST['attachmentName'] ?? ''));

    if ($idx < 0 || !is_email($to)) {
        wp_send_json_error(['msg' => 'Ongeldig e-mailadres of offerte-index']);
    }

    $quotes = digitify_get_quotes();
    if (!isset($quotes[$idx])) {
        wp_send_json_error(['msg' => 'Offerte niet gevonden']);
    }

    $q           = $quotes[$idx];
    $ref         = $q['ref']    ?? 'REF';
    $client      = $q['client'] ?? [];
    $client_name = trim(($client['bedrijf'] ?? '') ?: ($client['name'] ?? 'Klant'));
    $s           = digitify_get_settings();
    $from_email  = !empty($s['from_email']) ? sanitize_email($s['from_email']) : get_option('admin_email');
    $from_name   = !empty($s['from_name'])  ? $s['from_name'] : 'Digitify';
    $ref_safe    = preg_replace('/[^a-zA-Z0-9_\-]/', '', $ref);

    $doc_labels  = [
        'offerte'  => 'Offerte',
        'factuur'  => 'Factuur',
        'voorstel' => 'Voorstel',
        'voorschot'=> 'Voorschotfactuur',
        'geen'     => 'Bericht',
    ];
    $doc_label = $doc_labels[$type] ?? 'Offerte';

    // ── Bijlagen (optioneel) ─────────────────────────
    $attachments     = [];
    $tmp_attach_file = null;
    if (!empty($attachment_b64) && !empty($attachment_name)) {
        $allowed_ext = ['pdf','jpg','jpeg','png','doc','docx','xls','xlsx'];
        $ext = strtolower(pathinfo($attachment_name, PATHINFO_EXTENSION));
        if (in_array($ext, $allowed_ext, true)) {
            $b64c         = preg_replace('/^data:[^;]+;base64,/', '', $attachment_b64);
            $b64c         = str_replace(' ', '+', $b64c);
            $attach_bytes = base64_decode($b64c);
            if ($attach_bytes !== false && strlen($attach_bytes) > 0 && strlen($attach_bytes) <= 5 * 1024 * 1024) {
                $tmp_attach_file  = trailingslashit(get_temp_dir()) . sanitize_file_name($attachment_name) . '_' . uniqid() . '.' . $ext;
                file_put_contents($tmp_attach_file, $attach_bytes);
                $attachments[] = $tmp_attach_file;
            }
        }
    }

    // ── HTML e-mail bouwen ───────────────────────────
    $default_subject = ($type === 'geen')
        ? "Bericht van Digitify – {$ref}"
        : "{$doc_label} {$ref} – {$client_name} | Digitify";
    $subject   = !empty($custom_subject) ? $custom_subject : $default_subject;
    // Geen automatische PDF generatie/links meer: enkel template + optionele bijlage
    $body_html = digitify_build_html_email($type, $q, $s, $personal_msg, '', $voorschot_pct, $attachment_name);

    $headers = [
        'Content-Type: text/html; charset=UTF-8',
        "From: {$from_name} <{$from_email}>",
        "Reply-To: {$from_email}",
    ];

    $set_from      = function() use ($from_email) { return $from_email; };
    $set_from_name = function() use ($from_name)  { return $from_name; };
    add_filter('wp_mail_from',      $set_from);
    add_filter('wp_mail_from_name', $set_from_name);

    $sent = wp_mail($to, $subject, $body_html, $headers, $attachments);

    remove_filter('wp_mail_from',      $set_from);
    remove_filter('wp_mail_from_name', $set_from_name);

    // ── Extra bijlage temp-bestand opruimen ──────────
    if ($tmp_attach_file && file_exists($tmp_attach_file)) {
        @unlink($tmp_attach_file);
    }

    // ── Verzendstatus bijwerken ───────────────────────
    if ($type === 'factuur') {
        $quotes[$idx]['factuur_verstuurd'] = true;
    } elseif ($type === 'voorschot') {
        $quotes[$idx]['voorschot_verstuurd'] = true;
    } elseif ($type === 'voorstel') {
        $quotes[$idx]['voorstel_verstuurd'] = true;
    } elseif ($type === 'offerte') {
        $quotes[$idx]['offerte_verstuurd'] = true;
    }
    digitify_save_quotes($quotes);

    if ($sent) {
        // CRM Core sync: document e-mail event
        try {
            $q_for_crm = $quotes[$idx];
            $c_for_crm = $q_for_crm['client'] ?? [];
            $subject_for_crm = $custom_subject ?: ($doc_label . ' ' . $ref);
            digitify_offerte_push_to_crm($c_for_crm, $q_for_crm, 'document_email_sent', 'Document e-mail verstuurd', [
                'docType'  => $type,
                'to'       => $to,
                'subject'  => $subject_for_crm,
                'hasExtraAttachment' => !empty($attachment_name),
            ]);
        } catch (Exception $e) {
            error_log('Digitify Offerte CRM sync error (email): ' . $e->getMessage());
        }

        wp_send_json_success(['msg' => "{$doc_label} verstuurd naar {$to}"]);
    } else {
        wp_send_json_error(['msg' => 'Versturen mislukt – controleer uw SMTP-configuratie.']);
    }
}

// ─────────────────────────────────────────────────────────
// 18a. AJAX: OFFERTE DUPLICEREN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_digitify_duplicate_quote', 'digitify_ajax_duplicate_quote');
function digitify_ajax_duplicate_quote() {
    check_ajax_referer('digitify_admin', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['msg' => 'Geen toegang'], 403);
    }
    $idx = intval($_POST['idx'] ?? -1);
    if ($idx < 0) {
        wp_send_json_error(['msg' => 'Ongeldig index']);
    }
    $quotes = digitify_get_quotes();
    if (!isset($quotes[$idx])) {
        wp_send_json_error(['msg' => 'Offerte niet gevonden']);
    }

    $original = $quotes[$idx];
    $s = digitify_get_settings();
    $prefix = sanitize_text_field($s['offerte_prefix'] ?? 'OFF');

    // Genereer nieuw uniek referentienummer
    $new_ref = strtoupper($prefix) . '-' . strtoupper(substr(wp_generate_password(6, false, false), 0, 6)) . '-' . date('Y');

    $duplicate = $original;
    $duplicate['ref']      = $new_ref;
    $duplicate['date']     = date_i18n('d/m/Y');
    $duplicate['expDate']  = date_i18n('d/m/Y', strtotime('+30 days'));
    $duplicate['savedAt']  = current_time('mysql');
    $duplicate['note']     = 'Kopie van ' . ($original['ref'] ?? '—') . "\n" . ($original['note'] ?? '');
    $duplicate['pdfFile']  = '';
    // Reset verzend-vlaggen en status
    unset($duplicate['status'], $duplicate['offerte_verstuurd'], $duplicate['factuur_verstuurd'],
          $duplicate['voorschot_verstuurd'], $duplicate['voorstel_verstuurd']);

    array_unshift($quotes, $duplicate);
    digitify_save_quotes($quotes);

    digitify_debug_log('Offerte gedupliceerd: ' . ($original['ref'] ?? '—') . ' → ' . $new_ref);
    wp_send_json_success(['msg' => 'Offerte gedupliceerd', 'newRef' => $new_ref, 'quote' => $duplicate]);
}

// ─────────────────────────────────────────────────────────
// 18b. DEBUG LOGGING HELPER
// ─────────────────────────────────────────────────────────
function digitify_debug_log($msg) {
    $s = digitify_get_settings();
    if (!empty($s['debug_mode']) && $s['debug_mode'] === '1') {
        error_log('[Digitify v' . DIGITIFY_OFFERTE_VER . '] ' . $msg);
    }
}

// ─────────────────────────────────────────────────────────
// 18c. PUBLIEKE PDF DOWNLOAD VIA FRONTEND QUERY VAR
// (alternatief voor admin-ajax, nuttig wanneer wp-admin links worden geblokkeerd)
// ─────────────────────────────────────────────────────────
add_action('template_redirect', 'digitify_handle_public_pdf_download');
function digitify_handle_public_pdf_download() {
    if (!isset($_GET['digitify_pdf_token'])) return;
    $token = sanitize_text_field($_GET['digitify_pdf_token']);
    if (empty($token)) return;
    // Hergebruik dezelfde handler als de ajax-download
    $_GET['token'] = $token;
    digitify_ajax_dl_pdf();
    exit;
}

// ─────────────────────────────────────────────────────────
// 18b. BEVEILIGDE PDF DOWNLOAD VIA TOKEN
// ─────────────────────────────────────────────────────────
add_action('wp_ajax_nopriv_digitify_dl_pdf', 'digitify_ajax_dl_pdf');
add_action('wp_ajax_digitify_dl_pdf',        'digitify_ajax_dl_pdf');
function digitify_ajax_dl_pdf() {
    $token = sanitize_text_field($_GET['token'] ?? '');
    if (empty($token)) {
        wp_die('Ongeldige downloadlink.', 'Fout', ['response' => 400]);
    }
    $data = get_transient('digitify_pdf_' . $token);
    if (!$data || empty($data['path'])) {
        wp_die('Deze downloadlink is verlopen of ongeldig. Vraag een nieuw exemplaar aan.', 'Link verlopen', ['response' => 410]);
    }
    $file_path = $data['path'];
    $file_name = $data['name'] ?? basename($file_path);

    // Beveiligingscheck: bestand moet in digitify-offerte uploads-map staan
    $upload_dir  = wp_upload_dir();
    $allowed_dir = realpath(trailingslashit($upload_dir['basedir']) . 'digitify-offerte');
    $real_path   = realpath($file_path);
    if (!$real_path || !$allowed_dir || strpos($real_path, $allowed_dir) !== 0 || !file_exists($real_path)) {
        wp_die('Bestand niet gevonden.', 'Niet gevonden', ['response' => 404]);
    }

    // Serveer het PDF-bestand
    nocache_headers();
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . sanitize_file_name($file_name) . '"');
    header('Content-Length: ' . filesize($real_path));
    header('X-Content-Type-Options: nosniff');
    readfile($real_path);
    exit;
}

// ─────────────────────────────────────────────────────────
// 19. HTML E-MAIL TEMPLATE (Digitify huisstijl)
// ─────────────────────────────────────────────────────────
function digitify_build_html_email($type, $q, $s = [], $personal_msg = '', $download_url = '', $voorschot_pct = 50, $attachment_name = '') {
    $ref          = esc_html($q['ref']     ?? 'REF');
    $client       = $q['client']           ?? [];
    $grand_total_f= floatval($q['grandTotal'] ?? 0);
    $total        = number_format($grand_total_f, 2, ',', '.');
    $date         = esc_html($q['date']    ?? '');
    $exp          = esc_html($q['expDate'] ?? '');
    $client_name  = esc_html(trim(($client['bedrijf'] ?? '') ?: ($client['name'] ?? 'Klant')));
    $doc_labels   = ['offerte'=>'Offerte','factuur'=>'Factuur','voorstel'=>'Voorstel','voorschot'=>'Voorschotfactuur','geen'=>'Bericht'];
    $doc_emojis   = ['offerte'=>'📋','factuur'=>'🧾','voorstel'=>'📝','voorschot'=>'💰','geen'=>'✉️'];
    $doc_label    = $doc_labels[$type]  ?? 'Offerte';
    $doc_emoji    = $doc_emojis[$type]  ?? '📋';
    $comp_name    = esc_html($s['company_name']   ?? 'Digitify BV');
    $comp_email   = esc_html($s['company_email']  ?? 'contact@digitify.be');
    $comp_phone   = esc_html($s['company_phone']  ?? '+32 (0) 465 83 72 64');
    $comp_web     = esc_html($s['company_website'] ?? 'www.digitify.be');
    $greeting     = ($client_name !== 'Klant') ? "Beste {$client_name}," : 'Beste klant,';
    if ($type === 'factuur') {
        $intro = "Hierbij ontvangt u de <strong>factuur</strong> voor onze geleverde diensten. Gelieve het verschuldigde bedrag te voldoen volgens de vermelde betaalgegevens.";
    } elseif ($type === 'voorschot') {
        $pct   = intval($voorschot_pct);
        $intro = "Hierbij ontvangt u de <strong>voorschotfactuur ({$pct}%)</strong> voor de aangevraagde diensten.";
    } elseif ($type === 'voorstel') {
        $intro = "Hierbij ontvangt u ons <strong>voorstel</strong> op maat. Indien u akkoord bent, laat het ons gerust weten – dan werken we dit verder uit.";
    } elseif ($type === 'geen') {
        $intro = "U ontvangt dit bericht van <strong>{$comp_name}</strong>. Neem gerust contact op via de gegevens onderaan.";
    } else {
        $intro = "Hierbij vindt u uw <strong>persoonlijke offerte op maat</strong>.";
    }

    // Bijlage callout (indien aanwezig)
    $attach_note = '';
    if (!empty($attachment_name)) {
        $an = esc_html($attachment_name);
        $attach_note = "
      <tr>
        <td class='dg-pad' style='padding:0 40px 18px;'>
          <div style='background:#f7f7f7;border:1px solid #eee;border-radius:12px;padding:12px 14px;font-size:13px;color:#444;line-height:1.6;'>
            <strong>Bijlage toegevoegd:</strong> {$an}<br>
            <span style='color:#777'>Gelieve het document te openen via de bijlage van deze e-mail.</span>
          </div>
        </td>
      </tr>";
    }

    // Persoonlijk bericht blok
    $personal_block = '';
    if (!empty($personal_msg)) {
        $pm = nl2br(esc_html($personal_msg));
        $personal_block = "
      <tr>
        <td class='dg-pad' style='padding:0 40px 24px;'>
          <div style='background:#fffbf0;border-left:4px solid #ffaf51;border-radius:0 8px 8px 0;padding:14px 18px;font-size:14px;color:#555;line-height:1.6;'>{$pm}</div>
        </td>
      </tr>";
    }

    // Diensten tabel (niet voor 'klant' type)
    $items      = ($type !== 'klant') ? ($q['items'] ?? []) : [];
    $items_html = '';
    foreach ($items as $it) {
        $lbl  = esc_html($it['prodLabel'] ?? '—');
        $cat  = esc_html($it['catLabel']  ?? '—');
        $excl = number_format(floatval($it['excl']  ?? 0), 2, ',', '.');
        $tot  = number_format(floatval($it['total'] ?? 0), 2, ',', '.');
        $items_html .= "
              <tr>
                <td style='padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;font-weight:600;word-break:break-word;'>{$lbl}</td>
                <td style='padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#888;word-break:break-word;'>{$cat}</td>
                <td style='padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#555;text-align:right;white-space:nowrap;'>€ {$excl}</td>
                <td style='padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#e0922a;font-weight:700;text-align:right;white-space:nowrap;'>€ {$tot}</td>
              </tr>";
    }

    $items_table = '';
    if (!empty($items)) {
        // Voor voorschotfactuur: voeg betalingsoverzicht toe aan de tabel footer
        $voorschot_tfoot_extra = '';
        if ($type === 'voorschot') {
            $pct_v     = intval($voorschot_pct);
            $deposit_v = number_format(max(0.0, $grand_total_f * ($pct_v / 100.0)), 2, ',', '.');
            $rest_v    = number_format(max(0.0, $grand_total_f * ((100 - $pct_v) / 100.0)), 2, ',', '.');
            $voorschot_tfoot_extra = "
              <tr style='background:#fff8ee;border-top:2px solid #ffaf51;'>
                <td colspan='2' style='padding:10px;font-size:11px;font-weight:700;color:#555;text-align:right;'>Totaal project incl. BTW</td>
                <td colspan='2' style='padding:10px;font-size:11px;font-weight:700;color:#555;text-align:right;white-space:nowrap;'>€ {$total}</td>
              </tr>
              <tr style='background:#fff3e0;'>
                <td colspan='2' style='padding:10px;font-size:12px;font-weight:900;color:#e0922a;text-align:right;'>Voorschot {$pct_v}% &nbsp;→&nbsp; TE BETALEN</td>
                <td colspan='2' style='padding:10px;font-size:14px;font-weight:900;color:#e0922a;text-align:right;white-space:nowrap;'>€ {$deposit_v}</td>
              </tr>
              <tr style='background:#f7f7f7;'>
                <td colspan='2' style='padding:8px 10px;font-size:10px;font-weight:600;color:#888;text-align:right;'>Resterend saldo ({$pct_v}% reeds voldaan)</td>
                <td colspan='2' style='padding:8px 10px;font-size:11px;font-weight:700;color:#888;text-align:right;white-space:nowrap;'>€ {$rest_v}</td>
              </tr>";
        }
        $items_table = "
      <tr>
        <td class='dg-pad' style='padding:0 40px 24px;'>
          <div style='font-size:10px;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;'>Overzicht diensten</div>
          <div style='overflow-x:auto;-webkit-overflow-scrolling:touch;'>
          <table class='dg-tbl' cellpadding='0' cellspacing='0' border='0' width='100%' style='border-collapse:collapse;min-width:380px;'>
            <thead>
              <tr style='background:#111;'>
                <th style='padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#ffaf51;text-transform:uppercase;letter-spacing:0.5px;'>Dienst</th>
                <th style='padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;'>Categorie</th>
                <th style='padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;'>Excl. BTW</th>
                <th style='padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:#ffaf51;text-transform:uppercase;'>Totaal</th>
              </tr>
            </thead>
            <tbody>{$items_html}</tbody>
            <tfoot>
              <tr style='background:#f7f7f7;'>
                <td colspan='3' style='padding:10px;font-size:11px;font-weight:800;color:#111;text-align:right;'>Totaal incl. BTW</td>
                <td style='padding:10px;font-size:12px;font-weight:700;color:#e0922a;text-align:right;white-space:nowrap;'>€ {$total}</td>
              </tr>
              {$voorschot_tfoot_extra}
            </tfoot>
          </table>
          </div>
        </td>
      </tr>";
    }

    $exp_str  = $exp ? " · geldig tot {$exp}" : '';
    $year     = date('Y');
    $comp_url = (strpos($comp_web,'http') === 0) ? $comp_web : 'https://' . $comp_web;


    // Show ref/total info cards (niet bij "alleen bericht")
    $info_cards = '';
    if ($type !== 'klant' && $type !== 'geen') {
        // Voorschot: toon voorschotbedrag + totaal
        if ($type === 'voorschot') {
            $pct = intval($voorschot_pct);
            $deposit_f = max(0.0, $grand_total_f * ($pct / 100.0));
            $deposit   = number_format($deposit_f, 2, ',', '.');
            $info_cards = "
      <tr>
        <td class='dg-pad' style='padding:0 40px 24px;'>
          <table cellpadding='0' cellspacing='0' border='0' width='100%'>
            <tr>
              <td class='dg-info-a' style='background:#f7f7f7;border-radius:10px;padding:14px 16px;width:48%;vertical-align:top;'>
                <div style='font-size:10px;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;'>Referentie</div>
                <div style='font-size:15px;font-weight:800;color:#111;font-family:monospace;word-break:break-all;'>{$ref}</div>
                <div style='font-size:12px;color:#888;margin-top:4px;'>{$date}{$exp_str}</div>
              </td>
              <td class='dg-info-spc' style='width:4%;'></td>
              <td class='dg-info-b' style='background:#111;border-radius:10px;padding:14px 16px;width:48%;vertical-align:top;'>
                <div style='font-size:10px;font-weight:800;color:#666;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;'>Voorschot ({$pct}%)</div>
                <div style='font-size:22px;font-weight:900;color:#ffaf51;'>€ {$deposit}</div>
                <div style='font-size:12px;color:rgba(255,255,255,.55);margin-top:6px;'>Totaal: € {$total}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>";
        } else {
        $info_cards = "
      <tr>
        <td class='dg-pad' style='padding:0 40px 24px;'>
          <table cellpadding='0' cellspacing='0' border='0' width='100%'>
            <tr>
              <td class='dg-info-a' style='background:#f7f7f7;border-radius:10px;padding:14px 16px;width:48%;vertical-align:top;'>
                <div style='font-size:10px;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;'>Referentie</div>
                <div style='font-size:15px;font-weight:800;color:#111;font-family:monospace;word-break:break-all;'>{$ref}</div>
                <div style='font-size:12px;color:#888;margin-top:4px;'>{$date}{$exp_str}</div>
              </td>
              <td class='dg-info-spc' style='width:4%;'></td>
              <td class='dg-info-b' style='background:#111;border-radius:10px;padding:14px 16px;width:48%;vertical-align:top;'>
                <div style='font-size:10px;font-weight:800;color:#666;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;'>Totaal incl. BTW</div>
                <div style='font-size:22px;font-weight:900;color:#ffaf51;'>€ {$total}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>";
        }
    }

    // Bij "alleen bericht": geen diensten-overzicht tonen
    if ($type === 'geen') {
        $items_table = '';
    }

    return "<!DOCTYPE html>
<html lang='nl'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width,initial-scale=1.0'>
<title>{$doc_label} {$ref}</title>
<style type='text/css'>
  @media only screen and (max-width:600px){
    .dg-outer{padding:0 !important;}
    .dg-card{border-radius:0 !important;}
    .dg-hdr{padding:20px !important;}
    .dg-hdr-right{display:none !important;}
    .dg-hdr-mob{display:block !important;}
    .dg-pad{padding-left:20px !important;padding-right:20px !important;}
    .dg-info-a{display:block !important;width:100% !important;box-sizing:border-box !important;}
    .dg-info-spc{display:none !important;}
    .dg-info-b{display:block !important;width:100% !important;margin-top:10px !important;box-sizing:border-box !important;}
    .dg-foot-l{display:block !important;width:100% !important;text-align:center !important;}
    .dg-foot-r{display:block !important;width:100% !important;text-align:center !important;padding-top:10px !important;}
    .dg-tbl th,.dg-tbl td{font-size:10px !important;padding:5px 6px !important;}
    .dg-footer-pad{padding:20px !important;}
  }
</style>
</head>
<body style='margin:0;padding:0;background:#f5f5f5;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;'>
<table class='dg-outer' cellpadding='0' cellspacing='0' border='0' width='100%' style='background:#f5f5f5;padding:32px 16px;'>
  <tr><td>
    <table class='dg-card' cellpadding='0' cellspacing='0' border='0' width='100%' style='max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);'>

      <!-- HEADER -->
      <tr>
        <td class='dg-hdr' style='background:#111;padding:28px 40px;'>
          <table cellpadding='0' cellspacing='0' border='0' width='100%'>
            <tr>
              <td>
                <div style='font-size:22px;font-weight:900;color:#fff;letter-spacing:-.5px;'>{$comp_name}</div>
                <div style='font-size:11px;color:#ffaf51;font-weight:600;margin-top:2px;'>Partner in Digital Solutions</div>
                <div class='dg-hdr-mob' style='display:none;margin-top:10px;'>
                  <span style='background:#ffaf51;color:#111;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;padding:4px 14px;border-radius:99px;display:inline-block;'>{$doc_emoji} {$doc_label}</span>
                  <div style='font-size:11px;color:rgba(255,255,255,.4);margin-top:5px;font-family:monospace;'>{$ref}</div>
                </div>
              </td>
              <td class='dg-hdr-right' style='text-align:right;vertical-align:top;'>
                <div style='background:#ffaf51;color:#111;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;padding:4px 14px;border-radius:99px;display:inline-block;'>{$doc_emoji} {$doc_label}</div>
                <div style='font-size:12px;color:rgba(255,255,255,.45);margin-top:6px;font-family:monospace;'>{$ref}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ACCENT LINE -->
      <tr><td style='background:#ffaf51;height:4px;font-size:0;line-height:0;'>&nbsp;</td></tr>

      <!-- GREETING -->
      <tr>
        <td class='dg-pad' style='padding:28px 40px 20px;'>
          <p style='margin:0 0 12px;font-size:16px;font-weight:700;color:#111;'>{$greeting}</p>
          <p style='margin:0;font-size:14px;color:#555;line-height:1.7;'>{$intro}</p>
        </td>
      </tr>

      <!-- PERSONAL MESSAGE -->
      {$personal_block}

      <!-- ATTACHMENT NOTE -->
      {$attach_note}

      <!-- REF / TOTAL CARDS -->
      {$info_cards}

      <!-- ITEMS TABLE -->
      {$items_table}

      <!-- CTA -->
      <tr>
        <td class='dg-pad' style='padding:0 40px 32px;text-align:center;'>
          <a href='{$comp_url}' style='display:inline-block;background:#ffaf51;color:#111;font-size:13px;font-weight:800;text-decoration:none;padding:12px 28px;border-radius:99px;'>Naar {$comp_web} →</a>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td class='dg-footer-pad' style='background:#111;padding:24px 40px;border-top:3px solid #ffaf51;'>
          <div style='text-align:center;'>
            <div style='font-size:12px;font-weight:900;color:#fff;letter-spacing:-.2px;margin-bottom:10px;'>{$comp_name}</div>
            <div style='font-size:11px;color:#888;line-height:1.8;'>
              ✉️ <a href='mailto:{$comp_email}' style='color:#888;text-decoration:none;'>{$comp_email}</a>
              &nbsp;·&nbsp;
              📞 {$comp_phone}
              &nbsp;·&nbsp;
              🌐 <a href='{$comp_url}' style='color:#888;text-decoration:none;'>{$comp_web}</a>
            </div>
            <div style='font-size:10px;color:#444;margin-top:10px;'>© {$year} {$comp_name}</div>
          </div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>";
}

// ─────────────────────────────────────────────────────────
// 21. PLUGIN ACTIVATIE / DEACTIVATIE
// ─────────────────────────────────────────────────────────
register_activation_hook(__FILE__, 'digitify_activate');
function digitify_activate() {
    if (!get_option(DIGITIFY_QUOTES_OPTION)) {
        add_option(DIGITIFY_QUOTES_OPTION, '[]', '', false);
    }
    if (!get_option(DIGITIFY_SETTINGS_OPTION)) {
        add_option(DIGITIFY_SETTINGS_OPTION, '{}', '', false);
    }

    // Publieke token voor iframe/embedded AJAX (geen afhankelijkheid van cookies)
    if (!get_option(DIGITIFY_PUBLIC_TOKEN_OPT)) {
        add_option(DIGITIFY_PUBLIC_TOKEN_OPT, wp_generate_password(40, false, false), '', false);
    }

    // Rewrite voor /digitify-offerte/embed/
    add_rewrite_rule('^digitify-offerte/embed/?$', 'index.php?' . DIGITIFY_EMBED_QV . '=1', 'top');
    flush_rewrite_rules();
}

register_deactivation_hook(__FILE__, 'digitify_deactivate');
function digitify_deactivate() {
    // Gegevens bewaren bij deactivatie – enkel bij uninstall verwijderen
    flush_rewrite_rules();
}
