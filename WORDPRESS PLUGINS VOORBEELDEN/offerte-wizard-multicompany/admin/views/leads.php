<?php if ( ! defined( 'ABSPATH' ) ) exit;
$items = $result['items'] ?? [];
$total = $result['total'] ?? 0;
$pages = $result['pages'] ?? 1;
?>
<div class="owmc-page">

  <div class="owmc-page-header">
    <div>
      <h1 class="owmc-page-title">Leads</h1>
      <p class="owmc-page-subtitle"><?php echo number_format( $total ); ?> aanvragen totaal</p>
    </div>
    <form method="post" style="display:inline">
      <?php wp_nonce_field( 'owmc_export_leads_csv' ); ?>
      <input type="hidden" name="owmc_export_leads_csv" value="1">
      <input type="hidden" name="company_id" value="<?php echo (int) $companyId; ?>">
      <button type="submit" class="owmc-btn owmc-btn--secondary">⬇ CSV export</button>
    </form>
  </div>

  <!-- Sticky filter bar -->
  <div class="owmc-filter-bar">
    <form method="get" class="owmc-filter-form">
      <input type="hidden" name="page" value="owmc_leads">
      <select class="owmc-select" name="company_id" onchange="this.form.submit()">
        <option value="0">Alle bedrijven</option>
        <?php foreach ( $companies as $c ) : ?>
          <option value="<?php echo (int) $c->id; ?>" <?php selected( $companyId, $c->id ); ?>>
            <?php echo esc_html( $c->name ); ?>
          </option>
        <?php endforeach; ?>
      </select>
      <input class="owmc-input owmc-input--search" type="search" name="q" value="<?php echo esc_attr( $q ); ?>" placeholder="Zoek op naam, e-mail, telefoon…">
      <button type="submit" class="owmc-btn owmc-btn--primary">Zoeken</button>
      <?php if ( $q || $companyId ) : ?>
        <a href="?page=owmc_leads" class="owmc-btn owmc-btn--ghost">✕ Wissen</a>
      <?php endif; ?>
    </form>
  </div>

  <!-- Table -->
  <div class="owmc-card">
    <div class="owmc-card-body owmc-table-wrap">
      <?php if ( empty( $items ) ) : ?>
        <p class="owmc-empty">Geen leads gevonden.</p>
      <?php else : ?>
      <table class="owmc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Datum</th>
            <th>Naam</th>
            <th>E-mail</th>
            <th>Telefoon</th>
            <th>Bedrijf</th>
            <th>Diensten</th>
            <th>Pipeline</th>
            <th>Waarde</th>
            <th>Acties</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ( $items as $lead ) :
            $stageColors = [
              'Nieuw'             => '#6366f1',
              'Gecontacteerd'     => '#3b82f6',
              'Offerte verzonden' => '#f59e0b',
              'Gewonnen'          => '#10b981',
              'Verloren'          => '#ef4444',
            ];
            $stageColor = $stageColors[ $lead->pipeline_stage ?? 'Nieuw' ] ?? '#6366f1';
          ?>
          <tr>
            <td class="owmc-id"><?php echo (int) $lead->id; ?></td>
            <td class="owmc-date"><?php echo esc_html( substr( $lead->created_at, 0, 10 ) ); ?></td>
            <td><?php echo esc_html( $lead->name ?: '—' ); ?></td>
            <td><a href="mailto:<?php echo esc_attr( $lead->email ); ?>"><?php echo esc_html( $lead->email ?: '—' ); ?></a></td>
            <td><?php echo esc_html( $lead->tel ?: '—' ); ?></td>
            <td><span class="owmc-badge"><?php echo esc_html( $lead->company_name ?? $lead->company_slug ?? '—' ); ?></span></td>
            <td class="owmc-diensten"><?php echo esc_html( $lead->diensten ?: '—' ); ?></td>
            <td>
              <span class="owmc-pipeline-badge" style="background:<?php echo esc_attr( $stageColor ); ?>20;color:<?php echo esc_attr( $stageColor ); ?>;border-color:<?php echo esc_attr( $stageColor ); ?>40">
                <?php echo esc_html( $lead->pipeline_stage ?? 'Nieuw' ); ?>
              </span>
            </td>
            <td><?php echo $lead->total_price ? '€' . number_format( (float) $lead->total_price, 0, ',', '.' ) : '—'; ?></td>
            <td>
              <?php if ( $lead->contact_id ) : ?>
                <a href="?page=owmc_contacts&id=<?php echo (int) $lead->contact_id; ?>" class="owmc-action-btn">👤</a>
              <?php endif; ?>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>

      <!-- Pagination -->
      <?php if ( $pages > 1 ) : ?>
      <div class="owmc-pagination">
        <?php for ( $i = 1; $i <= $pages; $i++ ) :
          $url = add_query_arg( [ 'paged' => $i, 'company_id' => $companyId, 'q' => $q ] );
        ?>
          <a href="<?php echo esc_url( $url ); ?>" class="owmc-page-btn <?php echo $page === $i ? 'owmc-page-btn--active' : ''; ?>">
            <?php echo $i; ?>
          </a>
        <?php endfor; ?>
      </div>
      <?php endif; ?>

      <?php endif; ?>
    </div>
  </div>

</div>
