<?php
namespace OWMC\Admin;

use OWMC\Core\Container;
use OWMC\Services\LeadService;
use OWMC\Services\CompanyService;
use OWMC\Repositories\EventRepository;
use OWMC\Repositories\EmailLogRepository;

class DashboardPage {

    private LeadService       $leads;
    private CompanyService    $companies;
    private EventRepository   $events;
    private EmailLogRepository $emailLogs;

    public function __construct( Container $c ) {
        $this->leads     = $c->make( LeadService::class );
        $this->companies = $c->make( CompanyService::class );
        $this->events    = $c->make( EventRepository::class );
        $this->emailLogs = $c->make( EmailLogRepository::class );
    }

    public function render(): void {
        // Resolve current company filter
        $companyId = (int) ( $_GET['company_id'] ?? 0 );

        $kpi       = $this->leads->monthlyStats( $companyId );
        $funnel    = $this->events->funnelStats( $companyId, 30 );
        $openRate  = $this->emailLogs->openRate( $companyId, 30 );
        $activity  = $this->events->recentForCompany( $companyId ?: 0, 15 );
        $companies = $this->companies->allForList();

        include OWMC_DIR . 'admin/views/dashboard.php';
    }
}
