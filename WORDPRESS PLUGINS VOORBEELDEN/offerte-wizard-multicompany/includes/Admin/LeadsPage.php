<?php
namespace OWMC\Admin;

use OWMC\Core\Container;
use OWMC\Services\LeadService;
use OWMC\Services\CompanyService;

class LeadsPage {

    private LeadService    $leadService;
    private CompanyService $companyService;

    public function __construct( Container $c ) {
        $this->leadService    = $c->make( LeadService::class );
        $this->companyService = $c->make( CompanyService::class );
    }

    public function render(): void {
        // CSV export (early exit before headers are sent)
        if ( isset( $_POST['owmc_export_leads_csv'] ) ) {
            check_admin_referer( 'owmc_export_leads_csv' );
            $this->exportCsv();
        }

        $companyId = (int) ( $_GET['company_id'] ?? 0 );
        $q         = sanitize_text_field( $_GET['q'] ?? '' );
        $page      = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
        $perPage   = 25;

        $result    = $this->leadService->paginatedList( $companyId, $q, $perPage, $page );
        $companies = $this->companyService->allForList();
        $nonce     = wp_create_nonce( 'owmc_admin' );

        include OWMC_DIR . 'admin/views/leads.php';
    }

    private function exportCsv(): void {
        if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Geen toegang.' );

        $companyId = (int) ( $_POST['company_id'] ?? 0 );
        $items     = $this->leadService->allForCsv( $companyId );

        $filename = 'offerte-leads-' . date( 'Y-m-d' ) . '.csv';
        header( 'Content-Type: text/csv; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename=' . $filename );
        header( 'Pragma: no-cache' );

        $out = fopen( 'php://output', 'w' );
        fputcsv( $out, [ 'id', 'company', 'datum', 'naam', 'email', 'telefoon', 'diensten', 'pipeline', 'pagina', 'ip' ] );

        foreach ( $items as $row ) {
            fputcsv( $out, [
                $row['id'],
                $row['company_name']   ?? '',
                $row['created_at']     ?? '',
                $row['name']           ?? '',
                $row['email']          ?? '',
                $row['tel']            ?? '',
                $row['diensten']       ?? '',
                $row['pipeline_stage'] ?? '',
                $row['page_url']       ?? '',
                $row['ip']             ?? '',
            ] );
        }
        fclose( $out );
        exit;
    }
}
