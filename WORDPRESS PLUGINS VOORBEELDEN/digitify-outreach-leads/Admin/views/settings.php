<?php if (!defined('ABSPATH')) exit; ?>
<div class="dol-wrap" id="dol-settings">
  <div class="dol-header">
    <div>
      <h1>Instellingen</h1>
      <p class="dol-muted">Branding + afzender. SMTP/IMAP kan via bestaande plugins; wij focussen op tracking & logging.</p>
    </div>
  </div>

  <div class="dol-card">
    <form method="post" action="options.php">
      <?php
        settings_fields('dol_settings_group');
        do_settings_sections('dol_settings_group');
      ?>
      <div class="dol-form-grid">
        <div class="dol-colspan">
          <label>Brand name</label>
          <input class="dol-input" name="dol_settings[brand_name]" value="<?php echo esc_attr($settings['brand_name'] ?? ''); ?>">
        </div>
        <div>
          <label>Primary kleur</label>
          <input class="dol-input" name="dol_settings[brand_primary]" value="<?php echo esc_attr($settings['brand_primary'] ?? '#ff6a00'); ?>">
          <div class="dol-muted">Hex, bv. #ff6a00</div>
        </div>
        <div>
          <label>Logo URL</label>
          <input class="dol-input" name="dol_settings[brand_logo_url]" value="<?php echo esc_attr($settings['brand_logo_url'] ?? ''); ?>">
        </div>
        <div>
          <label>From naam</label>
          <input class="dol-input" name="dol_settings[from_name]" value="<?php echo esc_attr($settings['from_name'] ?? ''); ?>">
        </div>
        <div>
          <label>From e-mail</label>
          <input class="dol-input" name="dol_settings[from_email]" value="<?php echo esc_attr($settings['from_email'] ?? ''); ?>">
        </div>
      </div>
      <?php submit_button('Opslaan'); ?>
    </form>
  </div>

  <div class="dol-card dol-mt">
    <h2>CRM Core integratie</h2>
    <p class="dol-muted">Deze plugin stuurt events via actions:</p>
    <code>do_action('digitify_crm/upsert_contact', $email, $data)</code><br>
    <code>do_action('digitify_crm/log_event', $email, $event, $meta)</code>
    <p class="dol-muted dol-mt">Als CRM Core functions/classes aanwezig zijn, gebruiken we die automatisch.</p>
  </div>
</div>
