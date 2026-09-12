<?php
namespace OWMC\Services;

use OWMC\Repositories\LeadRepository;
use OWMC\Events\EventDispatcher;
use OWMC\Events\Events\QuoteCreated;

/**
 * Orchestrates the full lead intake flow:
 *  1. Dedupe/create CRM contact
 *  2. Persist lead record
 *  3. Calculate indicative price
 *  4. Send notification email
 *  5. Dispatch domain event
 */
class LeadService {

    public function __construct(
        private readonly LeadRepository  $leadRepo,
        private readonly ContactService  $contactService,
        private readonly EmailService    $emailService,
        private readonly EventDispatcher $dispatcher,
        private readonly PricingEngine   $pricing,
    ) {}

    // ── Primary intake ────────────────────────────────────────────────────────

    /**
     * Process a validated wizard submission.
     *
     * @param array    $body      Sanitized request payload
     * @param \stdClass $company  Company record
     * @param string   $ip        Submitter IP
     * @param string   $ua        User-Agent string
     * @return int lead ID
     */
    public function intake( array $body, \stdClass $company, string $ip = '', string $ua = '' ): int {
        $contact = $body['contact'] ?? [];
        $email   = sanitize_email( $contact['email'] ?? '' );
        $name    = sanitize_text_field( $contact['naam']  ?? $contact['name'] ?? '' );
        $tel     = sanitize_text_field( $contact['tel']   ?? '' );

        $diensten    = array_map( 'sanitize_text_field', (array) ( $body['diensten'] ?? [] ) );
        $dienstenStr = implode( ', ', $diensten );
        $pageUrl     = esc_url_raw( $body['meta']['page'] ?? '' );

        // 1. CRM dedupe
        $contactId = 0;
        if ( $email ) {
            $contactId = $this->contactService->findOrCreateByEmail( $email, [
                'name'   => $name,
                'tel'    => $tel,
                'source' => 'wizard',
            ], (int) $company->id );
        }

        // 2. Price calculation (indicative)
        $priceData = $this->pricing->calculate( $body, $company );
        $total     = $priceData['total'] ?? 0.0;

        // 3. Persist lead
        $leadId = $this->leadRepo->createLead( [
            'company_id'    => (int) $company->id,
            'contact_id'    => $contactId ?: null,
            'name'          => $name,
            'email'         => $email,
            'tel'           => $tel,
            'diensten'      => $dienstenStr,
            'payload'       => wp_json_encode( $body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ),
            'page_url'      => $pageUrl,
            'user_agent'    => substr( $ua, 0, 500 ),
            'ip'            => $ip,
            'total_price'   => $total ?: null,
            'pipeline_stage'=> 'Nieuw',
            'status'        => 'new',
            'created_at'    => current_time( 'mysql' ),
        ] );

        // 4. Contact timeline entry
        if ( $contactId ) {
            $this->contactService->logEvent( $contactId, 'lead_created', "Offerte aanvraag ingediend voor: $dienstenStr", [
                'lead_id'    => $leadId,
                'company_id' => (int) $company->id,
                'diensten'   => $diensten,
            ] );
        }

        // 5. Notification email
        $this->sendNotification( $leadId, $company, [
            'name'          => $name,
            'email'         => $email,
            'tel'           => $tel,
            'diensten'      => $dienstenStr,
            'page_url'      => $pageUrl,
            'price_data'    => $priceData,
            'lead_id'       => $leadId,
            'contact_id'    => $contactId,
        ] );

        // 6. Domain event
        $this->dispatcher->dispatch( new QuoteCreated(
            [
                'lead_id'    => $leadId,
                'company_id' => (int) $company->id,
                'email'      => $email,
                'diensten'   => $diensten,
                'total'      => $total,
            ],
            companyId: (int) $company->id,
            entityId:  $leadId
        ) );

        return $leadId;
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private function sendNotification( int $leadId, \stdClass $company, array $data ): void {
        $global  = get_option( 'owmc_global', [] );
        $notify  = sanitize_email( $global['notify_email'] ?? '' );
        if ( ! $notify ) return;

        $this->emailService->send( [
            'to'         => $notify,
            'subject'    => sprintf( '[%s] Nieuwe offerte aanvraag (%s)', $company->name, $data['diensten'] ),
            'template'   => $company->email_template ?? 'lead-notification',
            'vars'       => array_merge( $data, [ 'company' => $company ] ),
            'lead_id'    => $leadId,
            'contact_id' => $data['contact_id'] ?? 0,
            'company_id' => (int) $company->id,
            'company'    => $company,
        ] );
    }

    // ── Admin helpers ─────────────────────────────────────────────────────────

    public function paginatedList( int $companyId = 0, string $q = '', int $perPage = 25, int $page = 1 ): array {
        return $this->leadRepo->paginatedList( $companyId, $q, $perPage, $page );
    }

    public function monthlyStats( int $companyId = 0 ): array {
        return $this->leadRepo->monthlyStats( $companyId );
    }

    public function allForCsv( int $companyId = 0 ): array {
        return $this->leadRepo->allForCsv( $companyId );
    }

    public function updateStatus( int $leadId, string $status, string $stage = '' ): void {
        $this->leadRepo->updateStatus( $leadId, $status, $stage );
    }

    public function findById( int $id ): ?\stdClass {
        return $this->leadRepo->findById( $id );
    }
}
