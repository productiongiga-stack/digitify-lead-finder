<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="owmc-page">
  <div class="owmc-page-header">
    <div>
      <h1 class="owmc-page-title">Events</h1>
      <p class="owmc-page-subtitle">Centraal logboek van alle Digitify apps (gekoppeld op e-mail → contact).</p>
    </div>
  </div>

  <form method="get" class="owmc-filter-bar">
    <input type="hidden" name="page" value="dcrm_events" />
    <input class="owmc-input" name="q" value="<?php echo esc_attr($q); ?>" placeholder="Zoek email / naam / type / summary" />
    <input class="owmc-input" name="type" value="<?php echo esc_attr($type); ?>" placeholder="event_type (bv quote_sent)" />
    <input class="owmc-input" name="source" value="<?php echo esc_attr($source); ?>" placeholder="source (booking/offerte/chatbot)" />
    <span class="owmc-filter-sep"></span>
    <button class="owmc-btn owmc-btn--primary" type="submit">Filter</button>
    <a class="owmc-btn owmc-btn--secondary" href="<?php echo esc_url( admin_url('admin.php?page=dcrm_events') ); ?>">Reset</a>
  </form>

  <div class="owmc-card">
    <div class="owmc-card-header">
      <h2 class="owmc-card-title"><?php echo (int) $total; ?> events</h2>
    </div>
    <div class="owmc-card-body">
      <div class="owmc-table-wrap">
        <table class="owmc-table">
          <thead>
            <tr>
              <th>Tijd</th>
              <th>Type</th>
              <th>Contact</th>
              <th>Source</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <?php if ( empty($items) ) : ?>
              <tr><td colspan="5" style="color:#5b6472;">Geen events gevonden.</td></tr>
            <?php else : ?>
              <?php foreach ( $items as $e ) : ?>
                <tr>
                  <td style="white-space:nowrap; color:#5b6472; font-size:12px;">
                    <?php echo esc_html( $e->occurred_at ?: $e->created_at ); ?>
                  </td>
                  <td><span class="owmc-badge owmc-badge--sent"><?php echo esc_html( $e->event_type ); ?></span></td>
                  <td>
                    <?php if ( ! empty($e->contact_id) ) : ?>
                      <a href="<?php echo esc_url( admin_url('admin.php?page=dcrm_contacts&id='.(int)$e->contact_id) ); ?>">
                        <?php echo esc_html( $e->email ?: ('Contact #'.$e->contact_id) ); ?>
                      </a>
                    <?php else: ?>
                      —
                    <?php endif; ?>
                  </td>
                  <td><span class="owmc-badge owmc-badge--queued"><?php echo esc_html( $e->source_app ?: 'core' ); ?></span></td>
                  <td><?php echo esc_html( $e->summary ); ?></td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>

      <?php if ( $pages > 1 ) : ?>
        <div class="owmc-pagination">
          <?php for ( $p = 1; $p <= $pages; $p++ ) :
            $url = add_query_arg( [ 'page' => 'dcrm_events', 'paged' => $p, 'q' => $q, 'type' => $type, 'source' => $source ], admin_url('admin.php') );
          ?>
            <a class="owmc-page-link <?php echo $p === $page ? 'owmc-page-link--active' : ''; ?>" href="<?php echo esc_url($url); ?>"><?php echo (int) $p; ?></a>
          <?php endfor; ?>
        </div>
      <?php endif; ?>

    </div>
  </div>
</div>
