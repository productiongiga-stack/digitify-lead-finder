<?php
namespace OWMC\Admin;

use OWMC\Core\Container;

/**
 * Registers admin menu structure and dispatches page rendering
 * to dedicated Page classes (no logic in this file).
 */
class AdminMenu {

    public function __construct( private readonly Container $container ) {}

    public function register(): void {
        add_menu_page(
            'Offerte Wizard',
            'Offerte Wizard',
            'manage_options',
            'owmc',
            [ $this, 'renderDashboard' ],
            'dashicons-analytics',
            58
        );

        add_submenu_page( 'owmc', 'Dashboard',     'Dashboard',     'manage_options', 'owmc',          [ $this, 'renderDashboard' ] );
        add_submenu_page( 'owmc', 'Bedrijven',      'Bedrijven',     'manage_options', 'owmc_companies',[ $this, 'renderCompanies' ] );
        add_submenu_page( 'owmc', 'Leads',          'Leads',         'manage_options', 'owmc_leads',    [ $this, 'renderLeads' ] );
        add_submenu_page( 'owmc', 'Contacten',      'Contacten',     'manage_options', 'owmc_contacts', [ $this, 'renderContacts' ] );
        add_submenu_page( 'owmc', 'Wizard Builder', 'Wizard Builder','manage_options', 'owmc_builder',  [ $this, 'renderBuilder' ] );
        add_submenu_page( 'owmc', 'Instellingen',   'Instellingen',  'manage_options', 'owmc_settings', [ $this, 'renderSettings' ] );
    }

    public function renderDashboard(): void  { $this->render( DashboardPage::class ); }
    public function renderCompanies(): void  { $this->render( CompaniesPage::class ); }
    public function renderLeads(): void      { $this->render( LeadsPage::class ); }
    public function renderContacts(): void   { $this->render( ContactsPage::class ); }
    public function renderBuilder(): void    { $this->render( BuilderPage::class ); }
    public function renderSettings(): void   { $this->render( SettingsPage::class ); }

    private function render( string $pageClass ): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Geen toegang.' );
        }

        // Lazy-init page objects — they receive services via container
        if ( ! $this->container->has( $pageClass ) ) {
            // Fallback instantiation for page classes that accept container
            $page = new $pageClass( $this->container );
        } else {
            $page = $this->container->make( $pageClass );
        }

        $page->render();
    }
}
