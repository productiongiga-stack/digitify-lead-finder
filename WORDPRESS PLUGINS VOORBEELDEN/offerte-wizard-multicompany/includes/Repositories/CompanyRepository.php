<?php
namespace OWMC\Repositories;

class CompanyRepository extends BaseRepository {

    protected function tableName(): string { return 'owmc_companies'; }

    public function findBySlug( string $slug ): ?\stdClass {
        $row = $this->db->get_row(
            $this->db->prepare( "SELECT * FROM {$this->table()} WHERE slug = %s LIMIT 1", $slug )
        );
        return $row ?: null;
    }

    /** @return \stdClass[] */
    public function allForList(): array {
        return $this->db->get_results(
            "SELECT id, slug, name, email, phone, logo_url, primary_color, created_at FROM {$this->table()} ORDER BY name ASC"
        ) ?: [];
    }

    public function updateWizardJson( int $id, string $json ): void {
        $this->update( [ 'wizard_json' => $json ], [ 'id' => $id ] );
    }

    public function getWizardJson( int $id ): ?string {
        return $this->db->get_var(
            $this->db->prepare( "SELECT wizard_json FROM {$this->table()} WHERE id = %d", $id )
        );
    }

    public function deleteWithCascade( int $id ): void {
        global $wpdb;
        // Delete associated leads (cascade manually)
        $wpdb->delete( $wpdb->prefix . 'owmc_leads', [ 'company_id' => $id ] );
        $this->delete( [ 'id' => $id ] );
    }
}
