<?php
namespace DCRM\Admin;

if ( ! defined( 'ABSPATH' ) ) exit;

class AdminMenu {

    public function register(): void {
        add_action( 'admin_menu', function() {
            // Top-level Digitify Suite (CRM Core lives here)
            add_menu_page(
                'Digitify Suite',
                'Digitify Suite',
                'manage_options',
                'dcrm_dashboard',
                [ $this, 'renderDashboard' ],
                'dashicons-chart-area',
                58
            );

            add_submenu_page(
                'dcrm_dashboard',
                'CRM Dashboard',
                'CRM Dashboard',
                'manage_options',
                'dcrm_dashboard',
                [ $this, 'renderDashboard' ]
            );

            add_submenu_page(
                'dcrm_dashboard',
                'Contacten',
                'Contacten',
                'manage_options',
                'dcrm_contacts',
                [ $this, 'renderContacts' ]
            );

            add_submenu_page(
                'dcrm_dashboard',
                'Events',
                'Events',
                'manage_options',
                'dcrm_events',
                [ $this, 'renderEvents' ]
            );

            // placeholders for later
            add_submenu_page(
                'dcrm_dashboard',
                'Templates',
                'Templates',
                'manage_options',
                'dcrm_templates',
                [ $this, 'renderTemplates' ]
            );

            add_submenu_page(
                'dcrm_dashboard',
                'Instellingen',
                'Instellingen',
                'manage_options',
                'dcrm_settings',
                [ $this, 'renderSettings' ]
            );
        } );
    }

    public function renderDashboard(): void {
        ( new DashboardPage() )->render();
    }

    public function renderContacts(): void {
        ( new ContactsPage() )->render();
    }

    public function renderEvents(): void {
        ( new EventsPage() )->render();
    }

    public function renderTemplates(): void {
        echo '<div class="owmc-page"><div class="owmc-page-header"><div><h1 class="owmc-page-title">Templates</h1><p class="owmc-page-subtitle">Komt in v1.1 (HTML mail templates + preview)</p></div></div>';
        echo '<div class="owmc-card"><div class="owmc-card-body">Binnenkort: template builder, variabelen, preview (desktop/mobile) en template selector per mail.</div></div></div>';
    }

    public function renderSettings(): void {
        echo '<div class="owmc-page"><div class="owmc-page-header"><div><h1 class="owmc-page-title">Instellingen</h1><p class="owmc-page-subtitle">Basis instellingen voor CRM Core</p></div></div>';
        echo '<div class="owmc-card"><div class="owmc-card-body">V1: tracking toggles + SMTP/IMAP komen in volgende iteraties.</div></div></div>';
    }
}
