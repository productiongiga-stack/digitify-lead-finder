<?php if (!defined('ABSPATH')) exit; ?>
<div class="dol-wrap" id="dol-logs">
  <div class="dol-header">
    <div>
      <h1>Logs</h1>
      <p class="dol-muted">Alles wat gebeurt wordt gelogd per e-mail (open/click/sent/status/tags) en doorgestuurd naar CRM Core.</p>
    </div>
  </div>

  <div class="dol-card">
    <div class="dol-toolbar">
      <input class="dol-input" id="dolLogSearch" placeholder="Zoek op e-mail…">
      <select class="dol-input" id="dolLogType">
        <option value="">Alle types</option>
        <option value="email_sent">email_sent</option>
        <option value="email_opened">email_opened</option>
        <option value="email_clicked">email_clicked</option>
        <option value="lead_updated">lead_updated</option>
        <option value="tag_updated">tag_updated</option>
      </select>
    </div>

    <div class="dol-table-wrap">
      <table class="dol-table" id="dolLogsTable">
        <thead>
          <tr><th>Tijd</th><th>E-mail</th><th>Type</th><th>Info</th></tr>
        </thead>
        <tbody>
          <tr><td colspan="4" class="dol-muted">Laden…</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
