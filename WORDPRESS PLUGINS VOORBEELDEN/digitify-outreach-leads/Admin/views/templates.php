<?php if (!defined('ABSPATH')) exit; ?>
<div class="dol-wrap" id="dol-templates">
  <div class="dol-header">
    <div>
      <h1>Templates</h1>
      <p class="dol-muted">Beheer premium HTML templates. Variabelen: {{brand_name}}, {{from_name}}, {{name}}, {{email}}, {{message}}, {{cta_url}}</p>
    </div>
    <div class="dol-actions">
      <button class="button button-primary" id="dolNewTemplate">Nieuw template</button>
    </div>
  </div>

  <div class="dol-card">
    <table class="dol-table">
      <thead><tr><th>Naam</th><th>Subject</th><th></th></tr></thead>
      <tbody>
        <?php foreach ($templates as $t): ?>
          <tr>
            <td><b><?php echo esc_html($t['name']); ?></b></td>
            <td><?php echo esc_html($t['subject']); ?></td>
            <td style="text-align:right;">
              <button class="button dolEditTemplate"
                data-id="<?php echo (int)$t['id']; ?>"
                data-name="<?php echo esc_attr($t['name']); ?>"
                data-subject="<?php echo esc_attr($t['subject']); ?>"
                data-html="<?php echo esc_attr($t['html']); ?>"
              >Bewerken</button>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <div class="dol-modal" id="dolTemplateModal" aria-hidden="true">
    <div class="dol-modal-backdrop"></div>
    <div class="dol-modal-card dol-modal-card-wide">
      <div class="dol-modal-head">
        <div>
          <h2 id="dolTemplateTitle">Template</h2>
          <div class="dol-muted">Tip: gebruik je eigen huisstijl (logo, kleuren) in Instellingen.</div>
        </div>
        <button class="dol-icon-btn" data-dol-close>&times;</button>
      </div>
      <div class="dol-modal-body">
        <input type="hidden" id="dolTplId" value="0">
        <div class="dol-form-grid">
          <div class="dol-colspan">
            <label>Naam</label>
            <input class="dol-input" id="dolTplName" placeholder="Naam">
          </div>
          <div class="dol-colspan">
            <label>Subject</label>
            <input class="dol-input" id="dolTplSubject" placeholder="Onderwerp…">
          </div>
          <div class="dol-colspan">
            <label>HTML</label>
            <textarea class="dol-input" id="dolTplHtml" rows="16" placeholder="HTML…"></textarea>
          </div>
        </div>
      </div>
      <div class="dol-modal-foot">
        <button class="button" data-dol-close>Sluiten</button>
        <button class="button button-primary" id="dolSaveTemplate">Opslaan</button>
      </div>
    </div>
  </div>
</div>
