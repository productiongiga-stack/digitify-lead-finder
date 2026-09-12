<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap owmc-admin">
  <div class="owmc-header">
    <div>
      <h1 class="owmc-h1">Bedrijfsgegevens</h1>
      <p class="owmc-sub">Beheer bedrijven (branding + contactinfo) en embed de wizard per bedrijf.</p>
    </div>
    <div class="owmc-chipRow">
      <span class="owmc-chip">Embed: <code>[offerte_wizard company="slug"]</code></span>
      <span class="owmc-chip">Tip: gebruik het <strong>bedrijf slug</strong> in Elementor Shortcode widget</span>
    </div>
  </div>

  <div class="owmc-grid2">
    <!-- LEFT: Form -->
    <div class="owmc-card">
      <div class="owmc-cardHead">
        <h2><?php echo $company ? 'Bedrijfsgegevens bewerken' : 'Nieuw bedrijf'; ?></h2>
        <p>Logo, kleuren, headertekst en bedankpagina instellen.</p>
      </div>

      <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <?php wp_nonce_field('owmc_save_company'); ?>
        <input type="hidden" name="action" value="owmc_save_company" />
        <input type="hidden" name="id" value="<?php echo esc_attr($company->id ?? 0); ?>" />

        <table class="form-table" style="margin-top:0;">
          <tr>
            <th scope="row"><label for="slug">Slug</label></th>
            <td>
              <input name="slug" id="slug" class="regular-text" value="<?php echo esc_attr($company->slug ?? ''); ?>" placeholder="mert-fundations" />
              <p class="description">Uniek. Wordt gebruikt in embed shortcode.</p>
            </td>
          </tr>
          <tr>
            <th scope="row"><label for="name">Naam</label></th>
            <td><input name="name" id="name" class="regular-text" value="<?php echo esc_attr($company->name ?? ''); ?>" required /></td>
          </tr>
          <tr>
            <th scope="row"><label for="logo_url">Logo URL</label></th>
            <td>
              <input name="logo_url" id="logo_url" class="regular-text" value="<?php echo esc_url($company->logo_url ?? ''); ?>" placeholder="https://..." />
              <p class="description">Tip: upload in Media en plak de URL.</p>
            </td>
          </tr>
          <tr>
            <th scope="row"><label for="phone">Telefoon</label></th>
            <td><input name="phone" id="phone" class="regular-text" value="<?php echo esc_attr($company->phone ?? ''); ?>" /></td>
          </tr>
          <tr>
            <th scope="row"><label for="email">E-mail</label></th>
            <td><input name="email" id="email" class="regular-text" value="<?php echo esc_attr($company->email ?? ''); ?>" /></td>
          </tr>
          <tr>
            <th scope="row"><label for="header_meta">Header meta</label></th>
            <td><input name="header_meta" id="header_meta" class="regular-text" value="<?php echo esc_attr($company->header_meta ?? 'Offerte aanvraag — selecteer uw werken'); ?>" /></td>
          </tr>

          <tr><th colspan="2"><h3 style="margin:14px 0 4px;">Design</h3></th></tr>

          <tr>
            <th scope="row"><label for="primary_color">Primary</label></th>
            <td><input name="primary_color" id="primary_color" class="regular-text" value="<?php echo esc_attr($company->primary_color ?? '#f7c600'); ?>" /></td>
          </tr>
          <tr>
            <th scope="row"><label for="bg_color">Background</label></th>
            <td><input name="bg_color" id="bg_color" class="regular-text" value="<?php echo esc_attr($company->bg_color ?? '#f6f7f9'); ?>" /></td>
          </tr>
          <tr>
            <th scope="row"><label for="card_color">Card</label></th>
            <td><input name="card_color" id="card_color" class="regular-text" value="<?php echo esc_attr($company->card_color ?? '#ffffff'); ?>" /></td>
          </tr>
          <tr>
            <th scope="row"><label for="text_color">Text</label></th>
            <td><input name="text_color" id="text_color" class="regular-text" value="<?php echo esc_attr($company->text_color ?? '#111318'); ?>" /></td>
          </tr>
          <tr>
            <th scope="row"><label for="muted_color">Muted</label></th>
            <td><input name="muted_color" id="muted_color" class="regular-text" value="<?php echo esc_attr($company->muted_color ?? '#5b6472'); ?>" /></td>
          </tr>
          <tr>
            <th scope="row"><label for="border_color">Border</label></th>
            <td><input name="border_color" id="border_color" class="regular-text" value="<?php echo esc_attr($company->border_color ?? 'rgba(17,19,24,.10)'); ?>" /></td>
          </tr>

          <tr><th colspan="2"><h3 style="margin:14px 0 4px;">Bedankpagina</h3></th></tr>

          <tr>
            <th scope="row"><label for="thankyou_title">Titel</label></th>
            <td><input name="thankyou_title" id="thankyou_title" class="regular-text" value="<?php echo esc_attr($company->thankyou_title ?? 'Bedankt!'); ?>" /></td>
          </tr>
          <tr>
            <th scope="row"><label for="thankyou_text">Tekst</label></th>
            <td>
              <textarea name="thankyou_text" id="thankyou_text" class="large-text" rows="3"><?php echo esc_textarea($company->thankyou_text ?? 'Uw aanvraag is goed ontvangen. We nemen zo snel mogelijk contact op voor verdere instructies en planning.'); ?></textarea>
            </td>
          </tr>
        </table>

        <?php submit_button($company ? 'Opslaan' : 'Bedrijf aanmaken'); ?>
      </form>
    </div>

    <!-- RIGHT: List -->
    <div class="owmc-card">
      <div class="owmc-cardHead">
        <h2>Overzicht</h2>
        <p>Snelle embed per bedrijf + bewerken/verwijderen.</p>
      </div>

      <table class="widefat striped" style="border-radius:12px; overflow:hidden;">
        <thead>
          <tr>
            <th>ID</th>
            <th>Naam</th>
            <th>Slug</th>
            <th>Shortcode</th>
            <th>Acties</th>
          </tr>
        </thead>
        <tbody>
          <?php if (!$rows) : ?>
            <tr><td colspan="5">Nog geen bedrijven.</td></tr>
          <?php else : foreach ($rows as $r) : ?>
            <tr>
              <td><?php echo (int)$r->id; ?></td>
              <td><?php echo esc_html($r->name); ?></td>
              <td><code><?php echo esc_html($r->slug); ?></code></td>
              <td><code>[offerte_wizard company="<?php echo esc_attr($r->slug); ?>"]</code></td>
              <td>
                <a class="button" href="<?php echo esc_url(admin_url('admin.php?page=owmc&edit='.(int)$r->id)); ?>">Bewerken</a>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                  <?php wp_nonce_field('owmc_delete_company'); ?>
                  <input type="hidden" name="action" value="owmc_delete_company" />
                  <input type="hidden" name="id" value="<?php echo (int)$r->id; ?>" />
                  <button class="button button-link-delete" type="submit" onclick="return confirm('Bedrijf verwijderen? Leads worden ook verwijderd.');">Verwijderen</button>
                </form>
              </td>
            </tr>
          <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>
