<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="owmc-page">

  <!-- Header -->
  <div class="owmc-page-header">
    <div>
      <h1 class="owmc-page-title">Dashboard</h1>
      <p class="owmc-page-subtitle">Overzicht van uw offerte activiteit</p>
    </div>
    <div class="owmc-header-actions">
      <select class="owmc-select" id="owmc-company-filter" onchange="location='?page=owmc&company_id='+this.value">
        <option value="0">Alle bedrijven</option>
        <?php foreach ( $companies as $c ) : ?>
          <option value="<?php echo (int) $c->id; ?>" <?php selected( $companyId, $c->id ); ?>>
            <?php echo esc_html( $c->name ); ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
  </div>

  <!-- KPI row -->
  <div class="owmc-kpi-row">
    <div class="owmc-kpi-card">
      <div class="owmc-kpi-icon owmc-kpi-icon--blue">📋</div>
      <div class="owmc-kpi-body">
        <div class="owmc-kpi-value"><?php echo number_format( $kpi['total'] ); ?></div>
        <div class="owmc-kpi-label">Offertes deze maand</div>
      </div>
    </div>
    <div class="owmc-kpi-card">
      <div class="owmc-kpi-icon owmc-kpi-icon--green">📈</div>
      <div class="owmc-kpi-body">
        <div class="owmc-kpi-value"><?php echo $kpi['conversion']; ?>%</div>
        <div class="owmc-kpi-label">Conversieratio</div>
      </div>
    </div>
    <div class="owmc-kpi-card">
      <div class="owmc-kpi-icon owmc-kpi-icon--yellow">💶</div>
      <div class="owmc-kpi-body">
        <div class="owmc-kpi-value">€<?php echo number_format( $kpi['avg_value'], 0, ',', '.' ); ?></div>
        <div class="owmc-kpi-label">Gem. offertewaarde</div>
      </div>
    </div>
    <div class="owmc-kpi-card">
      <div class="owmc-kpi-icon owmc-kpi-icon--purple">📧</div>
      <div class="owmc-kpi-body">
        <div class="owmc-kpi-value"><?php echo $openRate; ?>%</div>
        <div class="owmc-kpi-label">E-mail open rate (30d)</div>
      </div>
    </div>
  </div>

  <!-- Charts + Funnel row -->
  <div class="owmc-dashboard-grid">

    <!-- Funnel -->
    <div class="owmc-card">
      <div class="owmc-card-header">
        <h2 class="owmc-card-title">Conversie funnel (30 dagen)</h2>
      </div>
      <div class="owmc-card-body">
        <?php
        $funnelSteps = [
            'wizard_started'   => 'Wizard gestart',
            'wizard_completed' => 'Wizard voltooid',
            'quote_created'    => 'Offerte aangemaakt',
            'quote_sent'       => 'Offerte verstuurd',
            'quote_accepted'   => 'Offerte geaccepteerd',
        ];
        $maxVal = max( 1, max( array_values( array_intersect_key( $funnel, $funnelSteps ) ) ) );
        foreach ( $funnelSteps as $key => $label ) :
            $count  = $funnel[ $key ] ?? 0;
            $pct    = round( ( $count / $maxVal ) * 100 );
        ?>
        <div class="owmc-funnel-row">
          <div class="owmc-funnel-label"><?php echo esc_html( $label ); ?></div>
          <div class="owmc-funnel-bar-wrap">
            <div class="owmc-funnel-bar" style="width:<?php echo $pct; ?>%"></div>
          </div>
          <div class="owmc-funnel-count"><?php echo number_format( $count ); ?></div>
        </div>
        <?php endforeach; ?>
      </div>
    </div>

    <!-- Activity feed -->
    <div class="owmc-card">
      <div class="owmc-card-header">
        <h2 class="owmc-card-title">Recente activiteit</h2>
      </div>
      <div class="owmc-card-body owmc-activity-feed">
        <?php if ( empty( $activity ) ) : ?>
          <p class="owmc-empty">Nog geen activiteit.</p>
        <?php else : ?>
          <?php foreach ( $activity as $event ) :
            $icon = match( $event->event_name ) {
                'quote_created'   => '📋',
                'quote_sent'      => '📤',
                'quote_accepted'  => '✅',
                'email_sent'      => '📧',
                'email_opened'    => '👁',
                'contact_created' => '👤',
                default           => '🔔',
            };
          ?>
          <div class="owmc-activity-item">
            <div class="owmc-activity-icon"><?php echo $icon; ?></div>
            <div class="owmc-activity-body">
              <div class="owmc-activity-name"><?php echo esc_html( str_replace( '_', ' ', $event->event_name ) ); ?></div>
              <div class="owmc-activity-time"><?php echo esc_html( human_time_diff( strtotime( $event->created_at ), time() ) ) . ' geleden'; ?></div>
            </div>
          </div>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
    </div>

  </div><!-- /.owmc-dashboard-grid -->

  <!-- Quick links -->
  <div class="owmc-quick-links">
    <a href="<?php echo admin_url( 'admin.php?page=owmc_leads' ); ?>" class="owmc-btn owmc-btn--secondary">Alle leads bekijken</a>
    <a href="<?php echo admin_url( 'admin.php?page=owmc_contacts' ); ?>" class="owmc-btn owmc-btn--secondary">CRM contacten</a>
    <a href="<?php echo admin_url( 'admin.php?page=owmc_companies' ); ?>" class="owmc-btn owmc-btn--primary">+ Nieuw bedrijf</a>
  </div>

</div>
