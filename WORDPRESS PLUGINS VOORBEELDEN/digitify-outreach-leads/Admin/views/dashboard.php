<?php if (!defined('ABSPATH')) exit; ?>
<div class="dol-wrap">
  <div class="dol-header">
    <div>
      <h1>Outreach Leads</h1>
      <p class="dol-muted">Lead-only outreach. Email = unieke sleutel. Alles logt naar CRM Core.</p>
    </div>
    <div class="dol-actions">
      <a class="button button-primary" href="<?php echo esc_url(admin_url('admin.php?page=dol_leads')); ?>">Ga naar Leads</a>
    </div>
  </div>

  <div class="dol-grid dol-grid-5">
    <div class="dol-card">
      <div class="dol-card-kpi"><?php echo (int)$stats['leads_total']; ?></div>
      <div class="dol-card-label">Totaal leads</div>
    </div>
    <div class="dol-card">
      <div class="dol-card-kpi"><?php echo (int)$stats['leads_contacted']; ?></div>
      <div class="dol-card-label">Status: gecontacteerd</div>
    </div>
    <div class="dol-card">
      <div class="dol-card-kpi"><?php echo (int)$stats['emails_sent_30d']; ?></div>
      <div class="dol-card-label">Emails verzonden (30d)</div>
    </div>
    <div class="dol-card">
      <div class="dol-card-kpi"><?php echo (int)$stats['opens_30d']; ?></div>
      <div class="dol-card-label">Opens (30d)</div>
    </div>
    <div class="dol-card">
      <div class="dol-card-kpi"><?php echo (int)$stats['clicks_30d']; ?></div>
      <div class="dol-card-label">Clicks (30d)</div>
    </div>
  </div>

  <div class="dol-card dol-mt">
    <h2>Snelle start</h2>
    <ol class="dol-steps">
      <li>Importeer je leads (CSV) in <b>Leads</b>.</li>
      <li>Kies een template in <b>Templates</b>.</li>
      <li>Open een lead → verstuur een mail → alles wordt gelogd (ook in CRM Core).</li>
    </ol>
  </div>
</div>
