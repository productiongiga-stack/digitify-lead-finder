<?php if ( ! defined( 'ABSPATH' ) ) exit;
$pipelineStages = [ 'Nieuw', 'Gecontacteerd', 'Offerte verzonden', 'Gewonnen', 'Verloren' ];
$stageColors    = [
  'Nieuw'             => '#6366f1',
  'Gecontacteerd'     => '#3b82f6',
  'Offerte verzonden' => '#f59e0b',
  'Gewonnen'          => '#10b981',
  'Verloren'          => '#ef4444',
];
$currentStage = $contact->pipeline_stage ?? 'Nieuw';
$stageColor   = $stageColors[ $currentStage ] ?? '#6366f1';
?>
<div class="owmc-page">

  <div class="owmc-page-header">
    <a href="?page=dcrm_contacts" class="owmc-back-link">← Alle contacten</a>
    <div>
      <h1 class="owmc-page-title"><?php echo esc_html( $contact->name ?: $contact->email ); ?></h1>
      <p class="owmc-page-subtitle">Contact #<?php echo (int) $contact->id; ?> · Aangemaakt <?php echo esc_html( substr( $contact->created_at, 0, 10 ) ); ?></p>
    </div>
  </div>

  <div class="owmc-detail-layout">

    <!-- Left: Contact info + actions -->
    <div class="owmc-detail-sidebar">

      <!-- Contact card -->
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h3 class="owmc-card-title">Contactgegevens</h3>
        </div>
        <div class="owmc-card-body">
          <div class="owmc-contact-avatar owmc-contact-avatar--lg"><?php echo esc_html( mb_strtoupper( mb_substr( $contact->name ?: $contact->email, 0, 1 ) ) ); ?></div>
          <div class="owmc-detail-fields">
            <div class="owmc-detail-field">
              <span class="owmc-detail-label">E-mail</span>
              <a href="mailto:<?php echo esc_attr( $contact->email ); ?>"><?php echo esc_html( $contact->email ); ?></a>
            </div>
            <?php if ( $contact->tel ) : ?>
            <div class="owmc-detail-field">
              <span class="owmc-detail-label">Telefoon</span>
              <a href="tel:<?php echo esc_attr( preg_replace( '/\s/', '', $contact->tel ) ); ?>"><?php echo esc_html( $contact->tel ); ?></a>
            </div>
            <?php endif; ?>
            <div class="owmc-detail-field">
              <span class="owmc-detail-label">Status</span>
              <span class="owmc-badge owmc-badge--<?php echo esc_attr( $contact->status ?? 'active' ); ?>"><?php echo esc_html( $contact->status ?? 'active' ); ?></span>
            </div>
            <div class="owmc-detail-field">
              <span class="owmc-detail-label">Bron</span>
              <span><?php echo esc_html( $contact->source ?? 'wizard' ); ?></span>
            </div>
          </div>

          <!-- Quick actions -->
          <div class="owmc-actions" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
            <a class="owmc-btn owmc-btn--primary owmc-btn--sm" href="mailto:<?php echo esc_attr( $contact->email ); ?>">
              Mailen
            </a>
            <?php if ( $contact->tel ) :
              $telClean = preg_replace( '/\s+/', '', (string) $contact->tel );
            ?>
              <a class="owmc-btn owmc-btn--secondary owmc-btn--sm" href="tel:<?php echo esc_attr( $telClean ); ?>">Bellen</a>
              <a class="owmc-btn owmc-btn--secondary owmc-btn--sm" target="_blank" rel="noopener" href="https://wa.me/<?php echo esc_attr( preg_replace( '/[^0-9]/', '', $telClean ) ); ?>">WhatsApp</a>
            <?php endif; ?>
            <a class="owmc-btn owmc-btn--ghost owmc-btn--sm" href="?page=dcrm_contacts&amp;id=<?php echo (int) $contact->id; ?>#timeline">Naar tijdlijn</a>
          </div>
        </div>
      </div>

      <!-- Pipeline stage -->
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h3 class="owmc-card-title">Pipeline fase</h3>
        </div>
        <div class="owmc-card-body">
          <div class="owmc-pipeline-select" data-contact="<?php echo (int) $contact->id; ?>" >
            <?php foreach ( $pipelineStages as $stage ) :
              $active = $stage === $currentStage;
              $color  = $stageColors[ $stage ] ?? '#6366f1';
            ?>
            <button class="owmc-pipeline-btn <?php echo $active ? 'owmc-pipeline-btn--active' : ''; ?>"
                    style="<?php echo $active ? "background:{$color};color:#fff;border-color:{$color}" : ''; ?>"
                    data-stage="<?php echo esc_attr( $stage ); ?>">
              <?php echo esc_html( $stage ); ?>
            </button>
            <?php endforeach; ?>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <?php if ( ! empty( $tags ) ) : ?>
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h3 class="owmc-card-title">Tags</h3>
        </div>
        <div class="owmc-card-body">
          <div class="owmc-tags-list">
            <?php foreach ( $tags as $tag ) : ?>
              <span class="owmc-tag" style="background:<?php echo esc_attr( $tag->color ); ?>20;color:<?php echo esc_attr( $tag->color ); ?>"><?php echo esc_html( $tag->name ); ?></span>
            <?php endforeach; ?>
          </div>
        </div>
      </div>
      <?php endif; ?>

      <!-- Notes -->
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h3 class="owmc-card-title">Notities</h3>
        </div>
        <div class="owmc-card-body">
          <textarea class="owmc-textarea" id="owmc-contact-notes" rows="5"><?php echo esc_textarea( $contact->notes ?? '' ); ?></textarea>
          <button class="owmc-btn owmc-btn--primary owmc-btn--sm" style="margin-top:8px"
                  onclick="dcrmSaveNote(<?php echo (int) $contact->id; ?>)">
            Opslaan
          </button>
        </div>
      </div>

    </div><!-- /.owmc-detail-sidebar -->

    <!-- Right: Timeline + Email logs -->
    <div class="owmc-detail-main">

      <!-- Email logs -->
      <?php if ( ! empty( $emails ) ) : ?>
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h3 class="owmc-card-title">E-mail log</h3>
        </div>
        <div class="owmc-card-body owmc-table-wrap">
          <table class="owmc-table owmc-table--compact">
            <thead>
              <tr><th>Onderwerp</th><th>Verstuurd</th><th>Geopend</th><th>Geklikt</th><th>Status</th></tr>
            </thead>
            <tbody>
              <?php foreach ( $emails as $log ) : ?>
              <tr>
                <td><?php echo esc_html( $log->subject ); ?></td>
                <td><?php echo $log->sent_at    ? esc_html( substr( $log->sent_at, 0, 16 ) )    : '—'; ?></td>
                <td><?php echo $log->opened_at  ? esc_html( substr( $log->opened_at, 0, 16 ) )  : '—'; ?>
                    <?php if ( $log->open_count > 1 ) echo '<span class="owmc-badge">' . (int) $log->open_count . 'x</span>'; ?>
                </td>
                <td><?php echo $log->clicked_at ? esc_html( substr( $log->clicked_at, 0, 16 ) ) : '—'; ?></td>
                <td><span class="owmc-status-<?php echo esc_attr( $log->status ); ?>"><?php echo esc_html( $log->status ); ?></span></td>
              </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>
      <?php endif; ?>

      <!-- Timeline -->
      <div class="owmc-card" id="timeline">
        <div class="owmc-card-header">
          <h3 class="owmc-card-title">Activiteit tijdlijn</h3>
        </div>
        <div class="owmc-card-body">
          <?php if ( empty( $timeline ) ) : ?>
            <p class="owmc-empty">Nog geen activiteit gelogd.</p>
          <?php else : ?>
          <div class="owmc-timeline">
            <?php foreach ( $timeline as $event ) :
              // PHP 7.4 compat (no match expression)
              switch ( $event->event_type ) {
                case 'contact_created': $icon = '👤'; break;
                case 'lead_created':    $icon = '📋'; break;
                case 'email_sent':      $icon = '📧'; break;
                case 'note_added':      $icon = '📝'; break;
                case 'pipeline_moved':  $icon = '→'; break;
                case 'status_changed':  $icon = '🔄'; break;
                case 'tag_attached':    $icon = '🏷'; break;
                default:                $icon = '🔔';
              }
            ?>
            <div class="owmc-timeline-item">
              <div class="owmc-timeline-icon"><?php echo $icon; ?></div>
              <div class="owmc-timeline-body">
                <div class="owmc-timeline-summary"><?php echo esc_html( $event->summary ); ?></div>
                <div class="owmc-timeline-time"><?php echo esc_html( $event->created_at ); ?></div>
              </div>
            </div>
            <?php endforeach; ?>
          </div>
          <?php endif; ?>
        </div>
      </div>

    </div><!-- /.owmc-detail-main -->
  </div><!-- /.owmc-detail-layout -->

</div>

