<?php if ( ! defined( 'ABSPATH' ) ) exit;
// Available vars: $name, $email, $tel, $diensten, $page_url, $price_data, $company, $lead_id
$priceData = $price_data ?? [];
?>
<h2>Nieuwe offerte aanvraag</h2>
<p>Er is een nieuwe offerte aanvraag ingediend via de wizard.</p>

<div class="em-divider"></div>

<div class="em-field">
  <div class="em-field-label">Naam</div>
  <div class="em-field-value"><?php echo esc_html( $name ?? '—' ); ?></div>
</div>
<div class="em-field">
  <div class="em-field-label">E-mailadres</div>
  <div class="em-field-value"><a href="mailto:<?php echo esc_attr( $email ?? '' ); ?>"><?php echo esc_html( $email ?? '—' ); ?></a></div>
</div>
<div class="em-field">
  <div class="em-field-label">Telefoon</div>
  <div class="em-field-value"><?php echo esc_html( $tel ?? '—' ); ?></div>
</div>
<div class="em-field">
  <div class="em-field-label">Gevraagde diensten</div>
  <div class="em-field-value"><?php echo esc_html( $diensten ?? '—' ); ?></div>
</div>
<?php if ( $page_url ?? '' ) : ?>
<div class="em-field">
  <div class="em-field-label">Aanvraag pagina</div>
  <div class="em-field-value"><a href="<?php echo esc_url( $page_url ); ?>"><?php echo esc_html( $page_url ); ?></a></div>
</div>
<?php endif; ?>

<?php if ( ! empty( $priceData['total'] ) && $priceData['total'] > 0 ) : ?>
<div class="em-divider"></div>
<div class="em-badge">📊 Indicatieve prijs (geldig 30 dagen)</div>
<div class="em-price-box">
  <?php foreach ( $priceData['lines'] ?? [] as $line ) : ?>
    <div class="em-price-row">
      <span><?php echo esc_html( $line['service'] ); ?></span>
      <span>€<?php echo number_format( (float) $line['price'], 2, ',', '.' ); ?></span>
    </div>
  <?php endforeach; ?>
  <?php if ( isset( $priceData['btw'] ) && $priceData['btw'] > 0 ) : ?>
  <div class="em-price-row">
    <span>BTW (<?php echo (int) $priceData['btw_rate']; ?>%)</span>
    <span>€<?php echo number_format( (float) $priceData['btw'], 2, ',', '.' ); ?></span>
  </div>
  <?php endif; ?>
  <div class="em-price-row em-price-total">
    <span>Totaal</span>
    <span>€<?php echo number_format( (float) $priceData['total'], 2, ',', '.' ); ?></span>
  </div>
</div>
<?php endif; ?>

<div class="em-divider"></div>

<?php if ( ! empty( $lead_id ) ) : ?>
<p style="text-align:center">
  <a href="<?php echo esc_url( admin_url( 'admin.php?page=owmc_leads' ) ); ?>" class="em-btn">
    Lead bekijken in dashboard →
  </a>
</p>
<?php endif; ?>

<p style="color:#9ca3af;font-size:13px;margin-top:24px">
  Verstuurd op <?php echo esc_html( current_time( 'j F Y H:i' ) ); ?>.
</p>
