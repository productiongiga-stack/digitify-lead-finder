<?php
namespace OWMC\Admin;

use OWMC\Core\Container;
use OWMC\Services\CompanyService;

class CompaniesPage {

    private CompanyService $service;

    public function __construct( Container $c ) {
        $this->service = $c->make( CompanyService::class );
    }

    public function render(): void {
        $notice = '';

        // Handle form submissions (POST → same page pattern for non-AJAX fallback)
        if ( $_SERVER['REQUEST_METHOD'] === 'POST' ) {
            if ( isset( $_POST['owmc_save_company'] ) ) {
                check_admin_referer( 'owmc_save_company' );
                $id     = (int) ( $_POST['id'] ?? 0 );
                $result = $this->service->save( $_POST, $id );
                $notice = is_wp_error( $result )
                    ? [ 'type' => 'error',   'msg' => $result->get_error_message() ]
                    : [ 'type' => 'success', 'msg' => 'Bedrijf opgeslagen.' ];
            }

            if ( isset( $_POST['owmc_delete_company'] ) ) {
                check_admin_referer( 'owmc_delete_company' );
                $id = (int) ( $_POST['id'] ?? 0 );
                if ( $id ) {
                    $this->service->delete( $id );
                    $notice = [ 'type' => 'success', 'msg' => 'Bedrijf verwijderd.' ];
                }
            }
        }

        $editId  = (int) ( $_GET['edit'] ?? 0 );
        $company = $editId ? $this->service->findById( $editId ) : null;
        $rows    = $this->service->allForList();
        $nonce   = wp_create_nonce( 'owmc_admin' );

        include OWMC_DIR . 'admin/views/companies.php';
    }
}
