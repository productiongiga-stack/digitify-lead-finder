<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap owmc-admin">
  <div class="owmc-header">
    <div>
      <h1 class="owmc-h1">Wizard Builder</h1>
      <p class="owmc-sub">Volledig visueel: diensten, vragen, opties, step copy, locatie & contact. Per bedrijf apart.</p>
    </div>
    <div class="owmc-chipRow">
      <span class="owmc-chip">Actief bedrijf: <strong><?php echo esc_html($selected->name ?? $selected_slug); ?></strong> <span class="owmc-mutedSmall">(<?php echo esc_html($selected_slug); ?>)</span></span>
      <span class="owmc-chip">Shortcode: <code>[offerte_wizard company="<?php echo esc_html($selected_slug); ?>"]</code></span>
    </div>
  </div>

  <?php if (!empty($saved)) : ?>
    <div class="notice notice-success is-dismissible"><p>Wizard instellingen opgeslagen.</p></div>
  <?php endif; ?>

  <?php if (!empty($error)) : ?>
    <div class="notice notice-error is-dismissible"><p><strong>Fout:</strong> <?php echo esc_html($error); ?></p></div>
  <?php endif; ?>

  <script>
    window.OWMC_DEFAULT_SCHEMA = <?php echo wp_json_encode(Offerte_Wizard_MultiCompany::default_wizard_schema(), JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); ?>;
  </script>

  <div class="owmc-split">
    <!-- LEFT: Company + Services -->
    <div class="owmc-panel">
      <div class="owmc-panelHead">
        <div>
          <h2>Bedrijf & Diensten</h2>
          <p>Selecteer bedrijf. Sleep diensten om te sorteren.</p>
        </div>
      </div>
      <div class="owmc-panelBody">
        <form method="get" style="margin-bottom: 12px;">
          <input type="hidden" name="page" value="owmc_builder" />
          <select name="company" class="owmc-selectWide" onchange="this.form.submit()">
            <?php foreach ($companies as $c) : ?>
              <option value="<?php echo esc_attr($c->slug); ?>" <?php selected($selected_slug, $c->slug); ?>>
                <?php echo esc_html($c->name . ' (' . $c->slug . ')'); ?>
              </option>
            <?php endforeach; ?>
          </select>
        </form>

        <div class="owmc-toolbar" style="margin-bottom:10px;">
          <button type="button" class="button button-secondary" id="owmc-add-service">+ Dienst</button>
          <button type="button" class="button" id="owmc-reset-default">Reset default</button>
        </div>

        <div class="owmc-listBox" id="owmc-services-list"></div>

        <div class="owmc-sep"></div>

        <div class="owmc-mutedSmall">
          Tips: houd service <code>id</code> stabiel. Vragen worden opgeslagen per dienst-id.
        </div>
      </div>
    </div>

    <!-- RIGHT: Editors + Save -->
    <div class="owmc-panel">
      <div class="owmc-panelHead">
        <div>
          <h2>Wizard instellingen</h2>
          <p>Je bewerkt nu: <strong><?php echo esc_html($selected->name ?? $selected_slug); ?></strong>. Pas copy, locatie/contact en vragen aan. Klik daarna op Opslaan.</p>
        </div>
        <div class="owmc-pill"><span id="owmc-json-status">—</span></div>
      </div>

      <div class="owmc-panelBody">
        <div class="owmc-qaHeader">
          <h3>Stapteksten</h3>
          <div class="owmc-toolbar">
            <button type="button" class="button button-secondary" id="owmc-apply-meta">Toepassen</button>
          </div>
        </div>

        <div class="owmc-formGrid">
          <div class="owmc-fieldRow" style="grid-column:1/-1;">
            <label>Step labels (exact 4, gescheiden door | )</label>
            <input class="owmc-inputWide" id="owmc-step-labels" value="" placeholder="Diensten | Details | Locatie | Contact" />
          </div>

          <div class="owmc-fieldRow">
            <label>Stap 1 titel</label><input class="owmc-inputWide" id="owmc-step1-title" />
          </div>
          <div class="owmc-fieldRow">
            <label>Stap 1 subtitel</label><input class="owmc-inputWide" id="owmc-step1-sub" />
          </div>

          <div class="owmc-fieldRow">
            <label>Stap 2 titel</label><input class="owmc-inputWide" id="owmc-step2-title" />
          </div>
          <div class="owmc-fieldRow">
            <label>Stap 2 subtitel</label><input class="owmc-inputWide" id="owmc-step2-sub" />
          </div>

          <div class="owmc-fieldRow">
            <label>Stap 3 titel</label><input class="owmc-inputWide" id="owmc-step3-title" />
          </div>
          <div class="owmc-fieldRow">
            <label>Stap 3 subtitel</label><input class="owmc-inputWide" id="owmc-step3-sub" />
          </div>

          <div class="owmc-fieldRow">
            <label>Stap 4 titel</label><input class="owmc-inputWide" id="owmc-step4-title" />
          </div>
          <div class="owmc-fieldRow">
            <label>Stap 4 subtitel</label><input class="owmc-inputWide" id="owmc-step4-sub" />
          </div>
        </div>

        <div class="owmc-sep"></div>

        <div class="owmc-qaHeader">
          <h3>Locatie & Contact</h3>
          <div class="owmc-toolbar">
            <button type="button" class="button button-secondary" id="owmc-apply-loc">Toepassen</button>
          </div>
        </div>

        <div class="owmc-formGrid">
          <div class="owmc-fieldRow">
            <label>Type pand opties (1 per lijn)</label>
            <textarea class="owmc-textareaWide" id="loc-propertyTypes"></textarea>
          </div>
          <div class="owmc-fieldRow">
            <label>Eigendom opties (1 per lijn)</label>
            <textarea class="owmc-textareaWide" id="loc-ownership"></textarea>
          </div>

          <div class="owmc-fieldRow"><label>Label: Type pand</label><input class="owmc-inputWide" id="loc-label-type" /></div>
          <div class="owmc-fieldRow"><label>Label: Eigendom</label><input class="owmc-inputWide" id="loc-label-ownership" /></div>
          <div class="owmc-fieldRow"><label>Label: Postcode</label><input class="owmc-inputWide" id="loc-label-postcode" /></div>
          <div class="owmc-fieldRow"><label>Label: Stad/Gemeente</label><input class="owmc-inputWide" id="loc-label-city" /></div>

          <div class="owmc-fieldRow"><label>Contact label: Naam</label><input class="owmc-inputWide" id="c-label-name" /></div>
          <div class="owmc-fieldRow"><label>Contact label: E-mail</label><input class="owmc-inputWide" id="c-label-email" /></div>
          <div class="owmc-fieldRow"><label>Contact label: Telefoon</label><input class="owmc-inputWide" id="c-label-tel" /></div>
          <div class="owmc-fieldRow"><label>Contact label: Opmerkingen</label><input class="owmc-inputWide" id="c-label-notes" /></div>
        </div>

        <div class="owmc-sep"></div>

        <div id="owmc-service-editor"></div>

        <div class="owmc-sep"></div>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
          <?php wp_nonce_field('owmc_save_builder'); ?>
          <input type="hidden" name="action" value="owmc_save_builder" />
          <input type="hidden" name="company_slug" id="owmc-company-slug" value="<?php echo esc_attr($selected_slug); ?>" />

          <div class="owmc-toolbar">
            <button class="button button-primary">Opslaan</button>
            <button type="button" class="button" id="owmc-format-json">JSON formatteren</button>
          </div>

          <div class="owmc-jsonDrawer">
            <details>
              <summary>Geavanceerd: JSON schema (read-only tenzij je het manueel wijzigt)</summary>
              <div class="inner">
                <textarea name="wizard_json" id="owmc-json" rows="18"><?php echo esc_textarea($schema); ?></textarea>
                <div class="owmc-mutedSmall" style="margin-top:8px;">
                  Tip: laat dit vooral door de builder beheren. JSON wordt automatisch bijgewerkt.
                </div>
              </div>
            </details>
          </div>
        </form>

        <div class="owmc-sep"></div>

        <div class="owmc-qaHeader" style="margin-top:4px;">
          <h3>Embed voorbeeld</h3>
        </div>

        <div class="owmc-mutedSmall" style="margin-bottom:10px;">
          Plak onderstaande shortcode in een <strong>Shortcode</strong> widget (Elementor) of in een pagina/bericht. Gebruik per bedrijf de juiste <code>company</code> slug.
        </div>

        <pre class="owmc-pre" style="margin:0 0 10px;"><code>[offerte_wizard company="<?php echo esc_html($selected_slug); ?>"]</code></pre>

        <div class="owmc-mutedSmall" style="margin-bottom:10px;">PHP template (optioneel):</div>
        <pre class="owmc-pre" style="margin:0;"><code>&lt;?php echo do_shortcode('[offerte_wizard company=&quot;<?php echo esc_html($selected_slug); ?>&quot;]'); ?&gt;</code></pre>

      </div>
    </div>
  </div>
</div>
