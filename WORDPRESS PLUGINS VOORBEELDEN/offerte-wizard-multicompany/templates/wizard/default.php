<?php if ( ! defined( 'ABSPATH' ) ) exit;
// $company is available from ShortcodeHandler scope
?>
<div class="owmc-wrap">
  <div class="owmc-layout">

    <!-- Main wizard column -->
    <div class="owmc-wizard-column">
      <div class="owmc-card" role="application" aria-label="Offerte wizard">

        <!-- Brand header -->
        <div class="owmc-brand-header">
          <div class="owmc-brand-identity">
            <?php if ( ! empty( $company->logo_url ) ) : ?>
              <img class="owmc-logo" src="<?php echo esc_url( $company->logo_url ); ?>" alt="<?php echo esc_attr( $company->name ); ?> logo">
            <?php else : ?>
              <div class="owmc-logo-fallback" aria-hidden="true">
                <?php echo esc_html( mb_strtoupper( mb_substr( $company->name, 0, 1 ) ) ); ?>
              </div>
            <?php endif; ?>
            <div class="owmc-brand-text">
              <div class="owmc-brand-name"><?php echo esc_html( $company->name ); ?></div>
              <div class="owmc-brand-meta"><?php echo esc_html( $company->header_meta ?? '' ); ?></div>
            </div>
          </div>
          <div class="owmc-brand-contact">
            <?php if ( ! empty( $company->phone ) ) : ?>
              <a class="owmc-contact-link" href="tel:<?php echo esc_attr( preg_replace( '/\s/', '', $company->phone ) ); ?>">
                📞 <?php echo esc_html( $company->phone ); ?>
              </a>
            <?php endif; ?>
            <?php if ( ! empty( $company->email ) ) : ?>
              <a class="owmc-contact-link" href="mailto:<?php echo esc_attr( $company->email ); ?>">
                ✉ <?php echo esc_html( $company->email ); ?>
              </a>
            <?php endif; ?>
          </div>
        </div>

        <!-- Step progress indicator -->
        <div class="owmc-progress-bar" id="owmc-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div>
        <div class="owmc-stepper" id="owmc-stepper" role="tablist"></div>

        <!-- Dynamic view container -->
        <div class="owmc-view" id="owmc-view" role="main"></div>

        <div class="owmc-wizard-footer">
          © <span id="owmc-year"></span> — <?php echo esc_html( $company->name ); ?>
        </div>
      </div>
    </div><!-- /.owmc-wizard-column -->

    <!-- Sticky cart column -->
    <div class="owmc-cart-column" id="owmc-cart-column">
      <div class="owmc-cart-card" id="owmc-cart">
        <div class="owmc-cart-header">
          <span class="owmc-cart-title">Uw selectie</span>
          <span class="owmc-cart-badge" id="owmc-cart-count">0</span>
        </div>
        <div class="owmc-cart-items" id="owmc-cart-items">
          <div class="owmc-cart-empty">Selecteer diensten om een indicatieve prijs te zien.</div>
        </div>
        <div class="owmc-cart-pricing" id="owmc-cart-pricing" style="display:none">
          <div class="owmc-cart-divider"></div>
          <div class="owmc-price-row">
            <span>Subtotaal</span>
            <span id="owmc-price-subtotal">€0</span>
          </div>
          <div class="owmc-price-row" id="owmc-btw-row">
            <span>BTW (<span id="owmc-btw-rate">21</span>%)</span>
            <span id="owmc-price-btw">€0</span>
          </div>
          <div class="owmc-price-row owmc-price-total">
            <span>Totaal</span>
            <span id="owmc-price-total">€0</span>
          </div>
          <!-- BTW toggle -->
          <div class="owmc-btw-toggle">
            <label class="owmc-toggle-label">
              <input type="checkbox" id="owmc-btw-toggle" checked>
              <span>BTW inbegrepen</span>
            </label>
          </div>
          <!-- Info box -->
          <div class="owmc-info-box">
            <div class="owmc-info-box-row">
              <span>📊</span>
              <div>
                <strong>Indicatieve prijs</strong>
                <div class="owmc-info-box-sub">Definitief bedrag na plaatsbezoek</div>
              </div>
            </div>
            <div class="owmc-info-box-row">
              <span>📅</span>
              <div>
                <strong>Geldig 30 dagen</strong>
                <div class="owmc-info-box-sub">Prijzen zijn vrijblijvend</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div><!-- /.owmc-cart-column -->

  </div><!-- /.owmc-layout -->
</div><!-- /.owmc-wrap -->

<div class="owmc-toast" id="owmc-toast" role="alert" aria-live="polite"></div>
