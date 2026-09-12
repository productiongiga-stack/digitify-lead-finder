<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="owmc-page owmc-page--builder">

  <div class="owmc-page-header">
    <div>
      <h1 class="owmc-page-title">Wizard Builder</h1>
    </div>
    <div class="owmc-builder-company-select">
      <label class="owmc-label" style="margin-bottom:0;margin-right:8px">Bedrijf:</label>
      <select class="owmc-select" onchange="location='?page=owmc_builder&company='+this.value">
        <?php foreach ( $companies as $c ) : ?>
          <option value="<?php echo esc_attr( $c->slug ); ?>" <?php selected( $selected ? $selected->slug : '', $c->slug ); ?>>
            <?php echo esc_html( $c->name ); ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
  </div>

  <?php if ( $saved ) : ?>
    <div class="owmc-notice owmc-notice--success">Wizard schema opgeslagen.</div>
  <?php elseif ( $error ) : ?>
    <div class="owmc-notice owmc-notice--error">Fout: <?php echo esc_html( $error ); ?></div>
  <?php endif; ?>

  <!-- 2-column builder layout -->
  <div class="owmc-builder-layout">

    <!-- Left: Visual editor -->
    <div class="owmc-builder-left">

      <!-- Step indicator -->
      <div class="owmc-builder-steps">
        <button class="owmc-builder-step owmc-builder-step--active" data-step="1">1. Diensten</button>
        <button class="owmc-builder-step" data-step="2">2. Details</button>
        <button class="owmc-builder-step" data-step="3">3. Locatie</button>
        <button class="owmc-builder-step" data-step="4">4. Contact</button>
        <button class="owmc-builder-step" data-step="5">⚙ Meta</button>
      </div>

      <!-- Services panel -->
      <div class="owmc-builder-panel owmc-builder-panel--active" id="builder-panel-1">
        <div class="owmc-card">
          <div class="owmc-card-header">
            <h3 class="owmc-card-title">Diensten</h3>
            <button class="owmc-btn owmc-btn--sm owmc-btn--primary" id="builder-add-service">+ Dienst toevoegen</button>
          </div>
          <div class="owmc-card-body">
            <div id="builder-services-list" class="owmc-sortable-list">
              <!-- Populated by builder.js -->
            </div>
          </div>
        </div>

        <!-- Service detail editor (inline) -->
        <div class="owmc-card owmc-builder-service-editor" id="builder-service-editor" style="display:none">
          <div class="owmc-card-header">
            <h3 class="owmc-card-title">Dienst bewerken</h3>
            <button class="owmc-btn owmc-btn--ghost" onclick="owmcBuilderCloseServiceEditor()">✕</button>
          </div>
          <div class="owmc-card-body">
            <div class="owmc-form-grid owmc-form-grid--2">
              <div class="owmc-field">
                <label class="owmc-label">Naam</label>
                <input class="owmc-input" type="text" id="svc-title">
              </div>
              <div class="owmc-field">
                <label class="owmc-label">Omschrijving</label>
                <input class="owmc-input" type="text" id="svc-desc">
              </div>
              <div class="owmc-field">
                <label class="owmc-label">Icoon (emoji)</label>
                <input class="owmc-input" type="text" id="svc-icon" maxlength="4">
              </div>
              <div class="owmc-field">
                <label class="owmc-label">ID (slug)</label>
                <input class="owmc-input" type="text" id="svc-id" readonly>
              </div>
            </div>

            <!-- Pricing config -->
            <div class="owmc-section-divider">Indicatieve prijsstelling</div>
            <div class="owmc-form-grid owmc-form-grid--3">
              <div class="owmc-field">
                <label class="owmc-label">Basisprijs (€)</label>
                <input class="owmc-input" type="number" id="svc-price-base" min="0">
              </div>
              <div class="owmc-field">
                <label class="owmc-label">Per m² (€)</label>
                <input class="owmc-input" type="number" id="svc-price-m2" min="0">
              </div>
              <div class="owmc-field">
                <label class="owmc-label">Per eenheid (€)</label>
                <input class="owmc-input" type="number" id="svc-price-unit" min="0">
              </div>
            </div>

            <!-- Questions -->
            <div class="owmc-section-divider">Vragen
              <button class="owmc-btn owmc-btn--sm owmc-btn--secondary" id="builder-add-question">+ Vraag</button>
            </div>
            <div id="builder-questions-list" class="owmc-sortable-list"></div>

            <div class="owmc-form-actions">
              <button class="owmc-btn owmc-btn--primary" onclick="owmcBuilderSaveService()">Dienst opslaan</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step copy panel -->
      <div class="owmc-builder-panel" id="builder-panel-2">
        <div class="owmc-card">
          <div class="owmc-card-header"><h3 class="owmc-card-title">Stap koppen</h3></div>
          <div class="owmc-card-body">
            <?php for ( $s = 1; $s <= 4; $s++ ) : ?>
            <div class="owmc-section-divider">Stap <?php echo $s; ?></div>
            <div class="owmc-form-grid owmc-form-grid--2">
              <div class="owmc-field">
                <label class="owmc-label">Titel</label>
                <input class="owmc-input" type="text" id="step<?php echo $s; ?>-title" data-step="<?php echo $s; ?>" data-key="title">
              </div>
              <div class="owmc-field">
                <label class="owmc-label">Ondertitel</label>
                <input class="owmc-input" type="text" id="step<?php echo $s; ?>-subtitle" data-step="<?php echo $s; ?>" data-key="subtitle">
              </div>
            </div>
            <?php endfor; ?>
          </div>
        </div>
      </div>

      <!-- Location panel -->
      <div class="owmc-builder-panel" id="builder-panel-3">
        <div class="owmc-card">
          <div class="owmc-card-header"><h3 class="owmc-card-title">Locatie labels</h3></div>
          <div class="owmc-card-body">
            <div class="owmc-form-grid owmc-form-grid--2">
              <div class="owmc-field"><label class="owmc-label">Type pand label</label><input class="owmc-input" type="text" id="loc-label-type"></div>
              <div class="owmc-field"><label class="owmc-label">Eigendom label</label><input class="owmc-input" type="text" id="loc-label-ownership"></div>
              <div class="owmc-field"><label class="owmc-label">Postcode label</label><input class="owmc-input" type="text" id="loc-label-postcode"></div>
              <div class="owmc-field"><label class="owmc-label">Stad label</label><input class="owmc-input" type="text" id="loc-label-city"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact panel -->
      <div class="owmc-builder-panel" id="builder-panel-4">
        <div class="owmc-card">
          <div class="owmc-card-header"><h3 class="owmc-card-title">Contact labels</h3></div>
          <div class="owmc-card-body">
            <div class="owmc-form-grid owmc-form-grid--2">
              <div class="owmc-field"><label class="owmc-label">Naam label</label><input class="owmc-input" type="text" id="con-label-name"></div>
              <div class="owmc-field"><label class="owmc-label">E-mail label</label><input class="owmc-input" type="text" id="con-label-email"></div>
              <div class="owmc-field"><label class="owmc-label">Telefoon label</label><input class="owmc-input" type="text" id="con-label-tel"></div>
              <div class="owmc-field"><label class="owmc-label">Opmerkingen label</label><input class="owmc-input" type="text" id="con-label-notes"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- JSON panel -->
      <div class="owmc-builder-panel" id="builder-panel-5">
        <div class="owmc-card">
          <div class="owmc-card-header">
            <h3 class="owmc-card-title">Ruwe JSON</h3>
            <div>
              <button class="owmc-btn owmc-btn--ghost owmc-btn--sm" id="builder-format-json">Formatteren</button>
              <span id="builder-json-status" class="owmc-json-status"></span>
            </div>
          </div>
          <div class="owmc-card-body">
            <textarea class="owmc-textarea owmc-textarea--code" id="builder-json-editor" rows="30"><?php echo esc_textarea( $schema ); ?></textarea>
          </div>
        </div>
      </div>

    </div><!-- /.owmc-builder-left -->

    <!-- Right: Live preview -->
    <div class="owmc-builder-right">
      <div class="owmc-card owmc-builder-preview-card">
        <div class="owmc-card-header">
          <h3 class="owmc-card-title">Live preview</h3>
        </div>
        <div class="owmc-card-body owmc-builder-preview" id="builder-preview">
          <!-- Rendered by builder.js -->
        </div>
      </div>
    </div>

  </div><!-- /.owmc-builder-layout -->

  <!-- Save form (hidden, submitted by JS) -->
  <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="builder-save-form">
    <?php wp_nonce_field( 'owmc_save_builder' ); ?>
    <input type="hidden" name="action" value="owmc_save_builder">
    <input type="hidden" name="company_slug" value="<?php echo esc_attr( $selected ? $selected->slug : '' ); ?>">
    <input type="hidden" name="wizard_json" id="builder-json-hidden" value="">
  </form>

  <div class="owmc-builder-save-bar">
    <span id="builder-status" class="owmc-builder-status"></span>
    <button class="owmc-btn owmc-btn--primary owmc-btn--lg" id="builder-save-btn">💾 Opslaan</button>
  </div>

</div>

<script>
// Pass schema to builder.js via localized variable
var OWMC_Schema = <?php echo $schema ?: '{}'; ?>;
var OWMC_BuilderNonce = '<?php echo esc_js( $nonce ); ?>';
var OWMC_CompanySlug = '<?php echo esc_js( $selected ? $selected->slug : '' ); ?>';
</script>
