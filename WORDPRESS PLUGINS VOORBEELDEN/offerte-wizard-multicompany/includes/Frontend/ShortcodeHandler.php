<?php
namespace OWMC\Frontend;

use OWMC\Services\CompanyService;

/**
 * Shortcode: [offerte_wizard company="slug" title="" subtitle=""]
 * All rendering logic lives here; zero business logic in the template.
 */
class ShortcodeHandler {

    public function __construct(
        private readonly CompanyService $companyService
    ) {}

    public function register(): void {
        add_shortcode( 'offerte_wizard', [ $this, 'render' ] );
        // Backward-compat alias
        add_shortcode( 'offerte_wizard_mc', [ $this, 'render' ] );
    }

    public function render( array|string $atts ): string {
        $atts = shortcode_atts( [
            'company'  => 'default',
            'title'    => '',
            'subtitle' => '',
            'btw'      => '', // '0' to force BTW off, '21' to force 21%
        ], (array) $atts, 'offerte_wizard' );

        $company = $this->companyService->findBySlug( sanitize_title( $atts['company'] ) );
        if ( ! $company ) {
            return '<p class="owmc-error">Bedrijf niet gevonden: ' . esc_html( $atts['company'] ) . '</p>';
        }

        // Enqueue assets lazily on first shortcode use
        wp_enqueue_style( 'owmc-wizard' );
        wp_enqueue_script( 'owmc-wizard' );

        $config = $this->buildConfig( $company, $atts );
        wp_localize_script( 'owmc-wizard', 'OWMC', $config );

        ob_start();
        include OWMC_DIR . 'templates/wizard/default.php';
        return ob_get_clean();
    }

    // ── Config builder ────────────────────────────────────────────────────────

    private function buildConfig( \stdClass $company, array $atts ): array {
        $global = get_option( 'owmc_global', [] );

        // BTW override from shortcode attr
        $btwRate    = (int) ( $company->btw_rate ?? 21 );
        $btwEnabled = (bool) ( $company->btw_enabled ?? true );
        if ( $atts['btw'] === '0' )  $btwEnabled = false;
        if ( is_numeric( $atts['btw'] ) && (int) $atts['btw'] > 0 ) {
            $btwEnabled = true;
            $btwRate    = (int) $atts['btw'];
        }

        return [
            'restUrl'   => esc_url_raw( rest_url( 'offerte-wizard/v1/lead' ) ),
            'eventUrl'  => esc_url_raw( rest_url( 'offerte-wizard/v1/event' ) ),
            'token'     => (string) ( $global['public_token'] ?? '' ),
            'company'   => [
                'slug'       => $company->slug,
                'name'       => $company->name,
                'logo_url'   => $company->logo_url ?? '',
                'phone'      => $company->phone ?? '',
                'email'      => $company->email ?? '',
                'header_meta'=> $company->header_meta ?? '',
            ],
            'theme' => [
                'primary'   => $company->primary_color   ?? '#f7c600',
                'secondary' => $company->secondary_color ?? '#e5b800',
                'bg'        => $company->bg_color        ?? '#f6f7f9',
                'card'      => $company->card_color      ?? '#ffffff',
                'text'      => $company->text_color      ?? '#111318',
                'muted'     => $company->muted_color     ?? '#5b6472',
                'border'    => $company->border_color    ?? 'rgba(17,19,24,.10)',
            ],
            'copy' => [
                'pageTitle'     => (string) $atts['title'],
                'pageSubtitle'  => (string) $atts['subtitle'],
                'thankyouTitle' => $company->thankyou_title ?? 'Bedankt!',
                'thankyouText'  => $company->thankyou_text  ?? '',
            ],
            'pricing' => [
                'btwRate'    => $btwRate,
                'btwEnabled' => $btwEnabled,
                'currency'   => 'EUR',
                'validDays'  => 30,
            ],
            'wizard' => $this->companyService->getWizardSchema( $company ),
            'i18n' => [
                'required'    => 'Vul eerst alle verplichte velden in.',
                'sent'        => 'Verzonden! We nemen zo snel mogelijk contact op.',
                'failed'      => 'Verzenden mislukt. Probeer later opnieuw.',
                'newRequest'  => 'Nieuwe aanvraag',
                'btwIncl'     => 'incl. BTW',
                'btwExcl'     => 'excl. BTW',
                'indicative'  => 'Indicatieve prijs',
                'validFor'    => 'Geldig gedurende 30 dagen',
                'subtotal'    => 'Subtotaal',
                'btw'         => 'BTW',
                'total'       => 'Totaal',
                'toggleBtw'   => 'BTW toggle',
                'step'        => 'Stap',
                'of'          => 'van',
                'next'        => 'Volgende',
                'back'        => 'Terug',
                'submit'      => 'Aanvraag versturen',
            ],
        ];
    }
}
