<?php if (!defined('ABSPATH')) exit; ?>
<div class="wrap owmc-admin">
  <div class="owmc-header"><div><h1 class="owmc-h1">Leads</h1><p class="owmc-sub">Overzicht van aanvragen, met filter, zoek en CSV export.</p></div></div>

  <form method="get" style="margin: 12px 0;">
    <input type="hidden" name="page" value="owmc_leads" />
    <select name="company_id">
      <option value="0">Alle bedrijven</option>
      <?php foreach ($companies as $c) : ?>
        <option value="<?php echo (int)$c->id; ?>" <?php selected($company_id, (int)$c->id); ?>>
          <?php echo esc_html($c->name . ' (' . $c->slug . ')'); ?>
        </option>
      <?php endforeach; ?>
    </select>
    <input type="text" name="q" value="<?php echo esc_attr($q); ?>" placeholder="Zoek: email, naam, tel..." />
    <button class="button">Filter</button>
  </form>

  <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin: 8px 0 18px;">
    <?php wp_nonce_field('owmc_export_leads_csv'); ?>
    <input type="hidden" name="action" value="owmc_export_leads_csv" />
    <input type="hidden" name="company_id" value="<?php echo (int)$company_id; ?>" />
    <button class="button button-secondary">Export CSV</button>
  </form>

  <table class="widefat striped">
    <thead>
      <tr>
        <th>Datum</th>
        <th>Bedrijf</th>
        <th>Naam</th>
        <th>E-mail</th>
        <th>Tel</th>
        <th>Diensten</th>
        <th>Pagina</th>
      </tr>
    </thead>
    <tbody>
      <?php if (!$items) : ?>
        <tr><td colspan="7">Geen leads gevonden.</td></tr>
      <?php else : foreach ($items as $it) : ?>
        <tr>
          <td><?php echo esc_html($it->created_at); ?></td>
          <td><?php echo esc_html($it->company_name); ?><br><small><code><?php echo esc_html($it->company_slug); ?></code></small></td>
          <td><?php echo esc_html($it->name); ?></td>
          <td><?php echo esc_html($it->email); ?></td>
          <td><?php echo esc_html($it->tel); ?></td>
          <td><?php echo esc_html($it->diensten); ?></td>
          <td>
            <?php if ($it->page_url) : ?>
              <a href="<?php echo esc_url($it->page_url); ?>" target="_blank" rel="noopener">Open</a>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; endif; ?>
    </tbody>
  </table>

  <?php if ($pages > 1) : ?>
    <div style="margin-top: 14px;">
      <?php
        $base = admin_url('admin.php?page=owmc_leads&company_id='.(int)$company_id.'&q='.urlencode($q).'&paged=');
        for ($p = 1; $p <= $pages; $p++) {
          $url = $base . $p;
          $cls = $p === $page ? 'button button-primary' : 'button';
          echo '<a class="'.esc_attr($cls).'" href="'.esc_url($url).'" style="margin-right:6px;">'.(int)$p.'</a>';
        }
      ?>
    </div>
  <?php endif; ?>
</div>
