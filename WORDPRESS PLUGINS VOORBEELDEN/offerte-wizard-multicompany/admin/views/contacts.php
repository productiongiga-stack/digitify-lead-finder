<?php if ( ! defined( 'ABSPATH' ) ) exit;
$items = $result['items'] ?? [];
$total = $result['total'] ?? 0;
$pages = $result['pages'] ?? 1;
$pipelineStages = [ 'Nieuw', 'Gecontacteerd', 'Offerte verzonden', 'Gewonnen', 'Verloren' ];
$stageColors    = [
  'Nieuw'             => '#6366f1',
  'Gecontacteerd'     => '#3b82f6',
  'Offerte verzonden' => '#f59e0b',
  'Gewonnen'          => '#10b981',
  'Verloren'          => '#ef4444',
];
?>
<div class="owmc-page">

  <div class="owmc-page-header">
    <div>
      <h1 class="owmc-page-title">CRM Contacten</h1>
      <p class="owmc-page-subtitle"><?php echo number_format( $total ); ?> contacten in uw database</p>
    </div>
  </div>

  <!-- Filter bar -->
  <div class="owmc-filter-bar">
    <form method="get" class="owmc-filter-form">
      <input type="hidden" name="page" value="owmc_contacts">
      <input class="owmc-input owmc-input--search" type="search" name="q"
             value="<?php echo esc_attr( $filters['q'] ?? '' ); ?>" placeholder="Zoek op naam of e-mail…">
      <select class="owmc-select" name="pipeline_stage" onchange="this.form.submit()">
        <option value="">Alle fasen</option>
        <?php foreach ( $pipelineStages as $s ) : ?>
          <option value="<?php echo esc_attr( $s ); ?>" <?php selected( $filters['pipeline_stage'] ?? '', $s ); ?>>
            <?php echo esc_html( $s ); ?>
          </option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="owmc-btn owmc-btn--primary">Zoeken</button>
    </form>
  </div>

  <!-- Pipeline board -->
  <div class="owmc-pipeline-board">
    <?php foreach ( $pipelineStages as $stage ) :
      $stageItems = array_filter( $items, fn( $c ) => ( $c->pipeline_stage ?? 'Nieuw' ) === $stage );
      $color = $stageColors[ $stage ] ?? '#6366f1';
    ?>
    <div class="owmc-pipeline-col">
      <div class="owmc-pipeline-header" style="border-color:<?php echo esc_attr( $color ); ?>">
        <span class="owmc-pipeline-dot" style="background:<?php echo esc_attr( $color ); ?>"></span>
        <?php echo esc_html( $stage ); ?>
        <span class="owmc-pipeline-count"><?php echo count( $stageItems ); ?></span>
      </div>
      <div class="owmc-pipeline-cards">
        <?php foreach ( $stageItems as $contact ) : ?>
        <a href="?page=owmc_contacts&id=<?php echo (int) $contact->id; ?>" class="owmc-contact-card">
          <div class="owmc-contact-avatar"><?php echo esc_html( mb_strtoupper( mb_substr( $contact->name ?: $contact->email, 0, 1 ) ) ); ?></div>
          <div class="owmc-contact-info">
            <div class="owmc-contact-name"><?php echo esc_html( $contact->name ?: '—' ); ?></div>
            <div class="owmc-contact-email"><?php echo esc_html( $contact->email ); ?></div>
            <?php if ( $contact->tel ) : ?>
              <div class="owmc-contact-tel"><?php echo esc_html( $contact->tel ); ?></div>
            <?php endif; ?>
          </div>
          <div class="owmc-contact-date"><?php echo esc_html( substr( $contact->created_at, 0, 10 ) ); ?></div>
        </a>
        <?php endforeach; ?>
        <?php if ( empty( $stageItems ) ) : ?>
          <div class="owmc-pipeline-empty">Leeg</div>
        <?php endif; ?>
      </div>
    </div>
    <?php endforeach; ?>
  </div>

  <!-- Standard table fallback -->
  <div class="owmc-card" style="margin-top:24px">
    <div class="owmc-card-header">
      <h2 class="owmc-card-title">Alle contacten</h2>
    </div>
    <div class="owmc-card-body owmc-table-wrap">
      <?php if ( empty( $items ) ) : ?>
        <p class="owmc-empty">Geen contacten gevonden.</p>
      <?php else : ?>
      <table class="owmc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Naam</th>
            <th>E-mail</th>
            <th>Telefoon</th>
            <th>Fase</th>
            <th>Bron</th>
            <th>Aangemaakt</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ( $items as $contact ) :
            $color = $stageColors[ $contact->pipeline_stage ?? 'Nieuw' ] ?? '#6366f1';
          ?>
          <tr>
            <td class="owmc-id"><?php echo (int) $contact->id; ?></td>
            <td><?php echo esc_html( $contact->name ?: '—' ); ?></td>
            <td><a href="mailto:<?php echo esc_attr( $contact->email ); ?>"><?php echo esc_html( $contact->email ); ?></a></td>
            <td><?php echo esc_html( $contact->tel ?: '—' ); ?></td>
            <td>
              <span class="owmc-pipeline-badge" style="background:<?php echo esc_attr( $color ); ?>20;color:<?php echo esc_attr( $color ); ?>">
                <?php echo esc_html( $contact->pipeline_stage ?? 'Nieuw' ); ?>
              </span>
            </td>
            <td><?php echo esc_html( $contact->source ?? 'wizard' ); ?></td>
            <td><?php echo esc_html( substr( $contact->created_at, 0, 10 ) ); ?></td>
            <td><a href="?page=owmc_contacts&id=<?php echo (int) $contact->id; ?>" class="owmc-action-btn">Bekijken →</a></td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>

      <?php if ( $pages > 1 ) : ?>
      <div class="owmc-pagination">
        <?php for ( $i = 1; $i <= $pages; $i++ ) :
          $url = add_query_arg( [ 'paged' => $i, 'page' => 'owmc_contacts' ] );
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
