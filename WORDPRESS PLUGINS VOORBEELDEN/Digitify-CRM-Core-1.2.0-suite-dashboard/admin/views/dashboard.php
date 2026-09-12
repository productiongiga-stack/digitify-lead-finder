<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="owmc-page">
  <div class="owmc-page-header">
    <div>
      <h1 class="owmc-page-title">Digitify Suite</h1>
      <p class="owmc-page-subtitle">Centrale hub: snelkoppelingen + KPI's + CRM timeline (contacten dedupe op e-mail).</p>
    </div>
  </div>

  <!-- Suite quick actions -->
  <div class="owmc-card" style="margin-bottom:16px;">
    <div class="owmc-card-header">
      <h2 class="owmc-card-title">Snelkoppelingen</h2>
      <div style="font-size:12px;color:#5b6472;">Toont alleen apps die actief zijn (best-effort detectie).</div>
    </div>
    <div class="owmc-card-body">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">
        <?php foreach ( (array) $suiteApps as $app ) :
          $isActive = ! empty($app['active']);
          $k = (string) ($app['key'] ?? '');
          $kpi = is_array($suiteKpis ?? null) && isset($suiteKpis[$k]) ? (array) $suiteKpis[$k] : [];
        ?>
          <div style="border:1px solid #e6e8ee;border-radius:16px;padding:14px;background:#fff;box-shadow:0 1px 1px rgba(0,0,0,.03);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="dashicons <?php echo esc_attr( $app['icon'] ?? 'dashicons-admin-generic' ); ?>" style="font-size:18px;line-height:1;"></span>
                <div>
                  <div style="font-weight:700;"><?php echo esc_html( $app['name'] ?? $k ); ?></div>
                  <div style="font-size:12px;color:<?php echo $isActive ? '#1f7a3f' : '#9aa3af'; ?>;">
                    <?php echo $isActive ? 'Actief' : 'Niet actief'; ?>
                  </div>
                </div>
              </div>

              <?php if ( ! empty($kpi) ) : ?>
                <div style="text-align:right;">
                  <?php foreach ( array_slice($kpi, 0, 2, true) as $label => $value ) : ?>
                    <div style="font-size:12px;color:#5b6472;">
                      <?php echo esc_html( str_replace('_', ' ', $label) ); ?>: <strong style="color:#111318;"><?php echo esc_html( (string) $value ); ?></strong>
                    </div>
                  <?php endforeach; ?>
                </div>
              <?php endif; ?>
            </div>

            <?php if ( $isActive && ! empty($app['links']) && is_array($app['links']) ) : ?>
              <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
                <?php foreach ( $app['links'] as $lnk ) : ?>
                  <a class="owmc-btn owmc-btn--secondary owmc-btn--sm" href="<?php echo esc_url( $lnk['url'] ?? '#' ); ?>"><?php echo esc_html( $lnk['label'] ?? 'Open' ); ?></a>
                <?php endforeach; ?>
              </div>
            <?php else : ?>
              <div style="margin-top:10px;font-size:12px;color:#5b6472;">
                Activeer de plugin om snelkoppelingen en KPI's te zien.
              </div>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  </div>

  <div class="owmc-kpi-row">
    <div class="owmc-kpi-card">
      <div class="owmc-kpi-label">Contacten</div>
      <div class="owmc-kpi-value"><?php echo (int) $totalContacts; ?></div>
      <div class="owmc-kpi-meta">Uniek op e-mail</div>
    </div>
    <div class="owmc-kpi-card">
      <div class="owmc-kpi-label">Actief (7d)</div>
      <div class="owmc-kpi-value"><?php echo (int) $active7d; ?></div>
      <div class="owmc-kpi-meta">Last activity ≤ 7 dagen</div>
    </div>
    <div class="owmc-kpi-card">
      <div class="owmc-kpi-label">Events (7d)</div>
      <div class="owmc-kpi-value"><?php echo (int) $events7d; ?></div>
      <div class="owmc-kpi-meta">Alle apps samen</div>
    </div>
    <div class="owmc-kpi-card">
      <div class="owmc-kpi-label">Open rate (30d)</div>
      <div class="owmc-kpi-value"><?php echo esc_html( $openRate30 ); ?>%</div>
      <div class="owmc-kpi-meta">Op basis van email logs</div>
    </div>
  </div>

  <div class="owmc-dashboard-grid">
    <div>
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h2 class="owmc-card-title">Recente activity</h2>
          <div>
            <a class="owmc-btn owmc-btn--secondary owmc-btn--sm" href="<?php echo esc_url( admin_url('admin.php?page=dcrm_events') ); ?>">Alle events</a>
            <a class="owmc-btn owmc-btn--primary owmc-btn--sm" href="<?php echo esc_url( admin_url('admin.php?page=dcrm_contacts') ); ?>">Contacten</a>
          </div>
        </div>
        <div class="owmc-card-body">
          <div class="owmc-activity-feed">
            <?php if ( empty( $recentEvents ) ) : ?>
              <div class="owmc-activity-item">
                <div class="owmc-activity-icon">⏳</div>
                <div class="owmc-activity-body">
                  <div class="owmc-activity-text">Nog geen events. Zodra Booking/Offerte/Chatbot events sturen, verschijnt hier de timeline.</div>
                </div>
              </div>
            <?php else : ?>
              <?php foreach ( $recentEvents as $e ) : ?>
                <div class="owmc-activity-item">
                  <div class="owmc-activity-icon">⚡</div>
                  <div class="owmc-activity-body">
                    <div class="owmc-activity-text">
                      <strong><?php echo esc_html( $e->event_type ); ?></strong>
                      <?php if ( ! empty( $e->summary ) ) : ?> — <?php echo esc_html( $e->summary ); ?><?php endif; ?>
                      <?php if ( ! empty( $e->email ) ) : ?>
                        <span style="color:#5b6472;">(<?php echo esc_html( $e->email ); ?>)</span>
                      <?php endif; ?>
                    </div>
                    <div class="owmc-activity-time"><?php echo esc_html( $e->occurred_at ?: $e->created_at ); ?> · <?php echo esc_html( $e->source_app ?: 'core' ); ?></div>
                  </div>
                </div>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h2 class="owmc-card-title">Integratie (snelle checklist)</h2>
        </div>
        <div class="owmc-card-body">
          <ol style="margin:0; padding-left:18px; color:#111318;">
            <li>Activeer CRM Core (maakt DB tabellen aan).</li>
            <li>Laat elke app events sturen via <code>digitify_crm_log_event()</code>.</li>
            <li>Controleer timeline op een contact (detail pagina).</li>
          </ol>
          <div style="margin-top:14px; font-size:13px; color:#5b6472;">
            Voorbeeld:
            <div class="owmc-token-display" style="margin-top:8px;">
              <div class="owmc-token-value">digitify_crm_log_event('john@doe.be','quote_sent',['quote_id'=>123],'Offerte verzonden',null,'offerte');</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
