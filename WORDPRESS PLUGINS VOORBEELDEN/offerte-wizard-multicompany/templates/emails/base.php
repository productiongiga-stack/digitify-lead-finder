<?php if ( ! defined( 'ABSPATH' ) ) exit;
// Variables: $content (string), and all vars passed from EmailService
$siteUrl  = home_url();
$siteName = get_bloginfo( 'name' );
$year     = date( 'Y' );
?>
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo esc_html( $subject ?? 'Bericht' ); ?></title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111318; -webkit-text-size-adjust: 100%; }
    .em-wrapper { max-width: 620px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .em-header { background: #111318; padding: 28px 40px; text-align: center; }
    .em-logo { color: #f7c600; font-size: 22px; font-weight: 700; letter-spacing: -.5px; }
    .em-body { padding: 40px; }
    .em-footer { background: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 13px; }
    .em-footer a { color: #6c757d; text-decoration: underline; }
    h2 { font-size: 22px; font-weight: 700; color: #111318; margin-bottom: 8px; }
    p { color: #374151; line-height: 1.6; margin-bottom: 16px; font-size: 15px; }
    .em-field { margin-bottom: 16px; }
    .em-field-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
    .em-field-value { font-size: 15px; color: #111318; font-weight: 500; }
    .em-divider { height: 1px; background: #e9ecef; margin: 28px 0; }
    .em-btn { display: inline-block; background: #f7c600; color: #111318; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 8px; text-decoration: none; }
    .em-price-box { background: #f8f9fa; border-radius: 10px; padding: 20px 24px; margin: 24px 0; border: 1px solid #e9ecef; }
    .em-price-row { display: flex; justify-content: space-between; font-size: 14px; color: #374151; padding: 4px 0; }
    .em-price-total { font-size: 18px; font-weight: 700; color: #111318; border-top: 2px solid #e9ecef; padding-top: 12px; margin-top: 8px; }
    .em-badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; margin-bottom: 16px; }
    @media(max-width: 620px) {
      .em-wrapper { margin: 0; border-radius: 0; }
      .em-body, .em-header, .em-footer { padding: 24px 20px; }
    }
  </style>
</head>
<body>
<div class="em-wrapper">
  <div class="em-header">
    <div class="em-logo">
      <?php echo esc_html( isset( $company ) ? $company->name : $siteName ); ?>
    </div>
  </div>
  <div class="em-body">
    <?php echo $content ?? ''; ?>
  </div>
  <div class="em-footer">
    <p>© <?php echo $year; ?> <?php echo esc_html( isset( $company ) ? $company->name : $siteName ); ?> · <a href="<?php echo esc_url( $siteUrl ); ?>"><?php echo esc_html( $siteUrl ); ?></a></p>
    <?php if ( ! empty( $track_pixel ) ) : ?>
      <img src="<?php echo esc_url( $track_pixel ); ?>" width="1" height="1" style="display:block;width:1px;height:1px;opacity:0" alt="">
    <?php endif; ?>
  </div>
</div>
</body>
</html>
