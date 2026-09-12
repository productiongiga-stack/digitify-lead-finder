<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap owmc-admin" style="max-width: 980px;">
  <div class="owmc-header"><div><h1 class="owmc-h1">Instellingen</h1><p class="owmc-sub">Algemene instellingen (notificaties & token).</p></div></div>

  <?php if (!empty($saved)) : ?>
    <div class="notice notice-success is-dismissible"><p>Instellingen opgeslagen.</p></div>
  <?php endif; ?>

  <form method="post">
    <?php wp_nonce_field('owmc_save_settings'); ?>

    <table class="form-table">
      <tr>
        <th scope="row">Notificatie e-mail</th>
        <td>
          <input type="email" name="notify_email" class="regular-text" value="<?php echo esc_attr($opt['notify_email'] ?? ''); ?>" />
          <p class="description">Ontvang een korte melding bij elke nieuwe aanvraag.</p>
        </td>
      </tr>
      <tr>
        <th scope="row">Public token</th>
        <td>
          <code style="user-select: all;"><?php echo esc_html($opt['public_token'] ?? ''); ?></code>
          <p class="description">Wordt meegegeven als <code>X-LEAD-TOKEN</code>. Dit is geen geheime key (staat client-side) maar helpt tegen willekeurige spam posts.</p>
          <label style="display:block;margin-top:8px;">
            <input type="checkbox" name="rotate_token" value="1" />
            Token vernieuwen
          </label>
        </td>
      </tr>
    </table>

    <p>
      <button class="button button-primary" name="owmc_save_settings" value="1">Opslaan</button>
    </p>

    <hr />

    <h2>Gebruik</h2>
    <ul>
      <li>Maak bedrijven aan via <strong>Offerte Wizard → Bedrijven</strong>.</li>
      <li>Embed per bedrijf via: <code>[offerte_wizard company="mert-fundations"]</code></li>
      <li>Leads vind je in <strong>Offerte Wizard → Leads</strong> (incl. CSV export).</li>
    </ul>
  </form>
</div>
