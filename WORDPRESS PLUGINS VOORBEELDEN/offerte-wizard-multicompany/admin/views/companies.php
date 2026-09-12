<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="owmc-page">

  <div class="owmc-page-header">
    <div>
      <h1 class="owmc-page-title">Bedrijven</h1>
      <p class="owmc-page-subtitle">Beheer uw multi-company configuraties</p>
    </div>
    <button class="owmc-btn owmc-btn--primary" onclick="owmcToggleForm(true)">+ Nieuw bedrijf</button>
  </div>

  <?php if ( $notice ) : ?>
    <div class="owmc-notice owmc-notice--<?php echo esc_attr( $notice['type'] ); ?>">
      <?php echo esc_html( $notice['msg'] ); ?>
    </div>
  <?php endif; ?>

  <!-- Company form (shown when editing or adding) -->
  <div class="owmc-card owmc-form-card" id="owmc-company-form" style="<?php echo ( $company || isset( $_GET['add'] ) ) ? '' : 'display:none'; ?>">
    <div class="owmc-card-header">
      <h2 class="owmc-card-title"><?php echo $company ? 'Bedrijf bewerken' : 'Nieuw bedrijf'; ?></h2>
      <button class="owmc-btn owmc-btn--ghost" onclick="owmcToggleForm(false)">✕</button>
    </div>
    <div class="owmc-card-body">
      <form method="post" action="">
        <?php wp_nonce_field( 'owmc_save_company' ); ?>
        <input type="hidden" name="owmc_save_company" value="1">
        <input type="hidden" name="id" value="<?php echo (int) ( $company->id ?? 0 ); ?>">

        <div class="owmc-form-grid owmc-form-grid--3">
          <div class="owmc-field">
            <label class="owmc-label">Naam *</label>
            <input class="owmc-input" type="text" name="name" value="<?php echo esc_attr( $company->name ?? '' ); ?>" required>
          </div>
          <div class="owmc-field">
            <label class="owmc-label">Slug *</label>
            <input class="owmc-input" type="text" name="slug" value="<?php echo esc_attr( $company->slug ?? '' ); ?>" placeholder="bijv. mijn-bedrijf">
          </div>
          <div class="owmc-field">
            <label class="owmc-label">Logo URL</label>
            <input class="owmc-input" type="url" name="logo_url" value="<?php echo esc_url( $company->logo_url ?? '' ); ?>">
          </div>
          <div class="owmc-field">
            <label class="owmc-label">Telefoon</label>
            <input class="owmc-input" type="text" name="phone" value="<?php echo esc_attr( $company->phone ?? '' ); ?>">
          </div>
          <div class="owmc-field">
            <label class="owmc-label">E-mail</label>
            <input class="owmc-input" type="email" name="email" value="<?php echo esc_attr( $company->email ?? '' ); ?>">
          </div>
          <div class="owmc-field">
            <label class="owmc-label">Header tekst</label>
            <input class="owmc-input" type="text" name="header_meta" value="<?php echo esc_attr( $company->header_meta ?? '' ); ?>">
          </div>
        </div>

        <!-- Brand colors -->
        <div class="owmc-section-divider">Huisstijl kleuren</div>
        <div class="owmc-form-grid owmc-form-grid--4">
          <?php
          $colorFields = [
            'primary_color'   => 'Primaire kleur',
            'secondary_color' => 'Secundaire kleur',
            'bg_color'        => 'Achtergrond',
            'card_color'      => 'Kaart achtergrond',
            'text_color'      => 'Tekstkleur',
            'muted_color'     => 'Muted tekst',
          ];
          foreach ( $colorFields as $field => $label ) :
            $val = esc_attr( $company->$field ?? '' );
          ?>
          <div class="owmc-field owmc-field--color">
            <label class="owmc-label"><?php echo $label; ?></label>
            <div class="owmc-color-wrap">
              <input type="color" class="owmc-color-picker" value="<?php echo $val; ?>" oninput="document.getElementById('<?php echo $field; ?>').value=this.value">
              <input class="owmc-input owmc-input--color-text" type="text" id="<?php echo $field; ?>" name="<?php echo $field; ?>" value="<?php echo $val; ?>">
            </div>
          </div>
          <?php endforeach; ?>
        </div>

        <!-- BTW settings -->
        <div class="owmc-section-divider">BTW instellingen</div>
        <div class="owmc-form-grid owmc-form-grid--3">
          <div class="owmc-field">
            <label class="owmc-label">BTW tarief (%)</label>
            <input class="owmc-input" type="number" name="btw_rate" value="<?php echo (int) ( $company->btw_rate ?? 21 ); ?>" min="0" max="100">
          </div>
          <div class="owmc-field owmc-field--checkbox">
            <label class="owmc-label owmc-label--checkbox">
              <input type="checkbox" name="btw_enabled" value="1" <?php checked( $company->btw_enabled ?? 1, 1 ); ?>>
              BTW standaard ingeschakeld
            </label>
          </div>
        </div>

        <!-- Thank you page -->
        <div class="owmc-section-divider">Bedankt pagina</div>
        <div class="owmc-form-grid owmc-form-grid--2">
          <div class="owmc-field">
            <label class="owmc-label">Titel</label>
            <input class="owmc-input" type="text" name="thankyou_title" value="<?php echo esc_attr( $company->thankyou_title ?? 'Bedankt!' ); ?>">
          </div>
          <div class="owmc-field">
            <label class="owmc-label">Tekst</label>
            <textarea class="owmc-textarea" name="thankyou_text" rows="3"><?php echo esc_textarea( $company->thankyou_text ?? '' ); ?></textarea>
          </div>
        </div>

        <div class="owmc-form-actions">
          <button type="submit" class="owmc-btn owmc-btn--primary">Opslaan</button>
          <button type="button" class="owmc-btn owmc-btn--ghost" onclick="owmcToggleForm(false)">Annuleren</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Companies table -->
  <div class="owmc-card">
    <div class="owmc-card-body owmc-table-wrap">
      <?php if ( empty( $rows ) ) : ?>
        <p class="owmc-empty">Nog geen bedrijven aangemaakt.</p>
      <?php else : ?>
      <table class="owmc-table">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Slug</th>
            <th>Shortcode</th>
            <th>E-mail</th>
            <th>Aangemaakt</th>
            <th class="owmc-col-actions">Acties</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ( $rows as $row ) : ?>
          <tr>
            <td>
              <div class="owmc-company-name">
                <?php if ( $row->logo_url ) : ?>
                  <img src="<?php echo esc_url( $row->logo_url ); ?>" class="owmc-company-logo" alt="">
                <?php else : ?>
                  <div class="owmc-company-logo-placeholder"><?php echo esc_html( mb_substr( $row->name, 0, 1 ) ); ?></div>
                <?php endif; ?>
                <?php echo esc_html( $row->name ); ?>
              </div>
            </td>
            <td><code class="owmc-code"><?php echo esc_html( $row->slug ); ?></code></td>
            <td><code class="owmc-code owmc-shortcode">[offerte_wizard company="<?php echo esc_attr( $row->slug ); ?>"]</code></td>
            <td><?php echo esc_html( $row->email ?? '—' ); ?></td>
            <td><?php echo esc_html( substr( $row->created_at ?? '', 0, 10 ) ); ?></td>
            <td class="owmc-col-actions">
              <a href="?page=owmc_companies&edit=<?php echo (int) $row->id; ?>" class="owmc-action-btn">✏️ Bewerken</a>
              <a href="?page=owmc_builder&company=<?php echo esc_attr( $row->slug ); ?>" class="owmc-action-btn">🔧 Builder</a>
              <form method="post" style="display:inline" onsubmit="return confirm('Bedrijf en alle leads verwijderen?')">
                <?php wp_nonce_field( 'owmc_delete_company' ); ?>
                <input type="hidden" name="owmc_delete_company" value="1">
                <input type="hidden" name="id" value="<?php echo (int) $row->id; ?>">
                <button type="submit" class="owmc-action-btn owmc-action-btn--danger">🗑 Verwijderen</button>
              </form>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      <?php endif; ?>
    </div>
  </div>

</div>

<script>
function owmcToggleForm(show) {
  document.getElementById('owmc-company-form').style.display = show ? '' : 'none';
}
</script>
