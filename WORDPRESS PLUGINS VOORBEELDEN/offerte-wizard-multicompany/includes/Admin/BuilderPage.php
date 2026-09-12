<?php
namespace OWMC\Admin;

use OWMC\Core\Container;
use OWMC\Services\CompanyService;
use OWMC\Core\Installer;

class BuilderPage {

    private CompanyService $service;

    public function __construct( Container $c ) {
        $this->service = $c->make( CompanyService::class );
    }

    public function render(): void {
        $companies    = $this->service->allForList();
        $selectedSlug = sanitize_title( $_GET['company'] ?? ( $companies[0]->slug ?? 'default' ) );

        $selected = null;
        foreach ( $companies as $c ) {
            if ( $c->slug === $selectedSlug ) {
                $selected = $this->service->findBySlug( $selectedSlug );
                break;
            }
        }
        if ( ! $selected && ! empty( $companies ) ) {
            $selected = $this->service->findBySlug( $companies[0]->slug );
        }

        $schema = '';
        if ( $selected ) {
            $full   = $this->service->findById( (int) $selected->id );
            $schema = $full && ! empty( $full->wizard_json )
                ? $full->wizard_json
                : wp_json_encode( Installer::defaultWizardSchema(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
        }

        $saved = (int) ( $_GET['saved'] ?? 0 );
        $error = sanitize_text_field( $_GET['error'] ?? '' );
        $nonce = wp_create_nonce( 'owmc_save_builder' );

        include OWMC_DIR . 'admin/views/builder.php';
    }
}
