<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="owmc-page">

  <div class="owmc-page-header">
    <div>
      <h1 class="owmc-page-title">Instellingen</h1>
      <p class="owmc-page-subtitle">Globale configuratie voor de Offerte Wizard</p>
    </div>
  </div>

  <?php if ( $notice ) : ?>
    <div class="owmc-notice owmc-notice--<?php echo esc_attr( $notice['type'] ); ?>">
      <?php echo esc_html( $notice['msg'] ); ?>
    </div>
  <?php endif; ?>

  <div class="owmc-settings-layout">

    <form method="post">
      <?php wp_nonce_field( 'owmc_save_settings' ); ?>
      <input type="hidden" name="owmc_save_settings" value="1">

      <!-- Notifications -->
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h2 class="owmc-card-title">📧 Notificaties</h2>
        </div>
        <div class="owmc-card-body">
          <div class="owmc-field owmc-field--wide">
            <label class="owmc-label">Notificatie e-mailadres</label>
            <input class="owmc-input" type="email" name="notify_email"
                   value="<?php echo esc_attr( $opt['notify_email'] ?? '' ); ?>"
                   placeholder="info@uwbedrijf.be">
            <span class="owmc-help">Nieuwe leads worden naar dit adres gestuurd.</span>
          </div>
        </div>
      </div>

      <!-- Security -->
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h2 class="owmc-card-title">🔑 API Token</h2>
        </div>
        <div class="owmc-card-body">
          <div class="owmc-field owmc-field--wide">
            <label class="owmc-label">Publieke token (anti-spam)</label>
            <div class="owmc-token-display">
              <code class="owmc-pre" id="owmc-token"><?php echo esc_html( $opt['public_token'] ?? '' ); ?></code>
              <button type="button" class="owmc-btn owmc-btn--ghost" onclick="navigator.clipboard.writeText(document.getElementById('owmc-token').textContent)">📋 Kopieer</button>
            </div>
            <span class="owmc-help">Deze token wordt meegezonden in elk wizard-verzoek. Roteer bij misbruik.</span>
          </div>
          <div class="owmc-field owmc-field--checkbox">
            <label class="owmc-label owmc-label--checkbox">
              <input type="checkbox" name="rotate_token" value="1">
              Token roteren bij opslaan
            </label>
          </div>
        </div>
      </div>

      <!-- Developer -->
      <div class="owmc-card">
        <div class="owmc-card-header">
          <h2 class="owmc-card-title">🛠 Developer</h2>
        </div>
        <div class="owmc-card-body">
          <div class="owmc-field owmc-field--checkbox">
            <label class="owmc-label owmc-label--checkbox">
              <input type="checkbox" name="debug_mode" value="1" <?php checked( $opt['debug_mode'] ?? 0, 1 ); ?>>
              Debug mode inschakelen (logt fouten naar PHP error log)
            </label>
          </div>

          <!-- DB version info -->
          <div class="owmc-info-block">
            <strong>Plugin versie:</strong> <?php echo esc_html( OWMC_VERSION ); ?><br>
            <strong>DB versie:</strong> <?php echo esc_html( get_option( 'owmc_db_version', '—' ) ); ?><br>
            <strong>REST endpoint:</strong> <code><?php echo esc_html( rest_url( 'offerte-wizard/v1/lead' ) ); ?></code>
          </div>
        </div>
      </div>

      <div class="owmc-form-actions">
        <button type="submit" class="owmc-btn owmc-btn--primary">Instellingen opslaan</button>
      </div>
    </form>

  </div>
</div>
