=== Digitify Outreach Leads ===
Contributors: digitify
Requires at least: 6.0
Tested up to: 6.5
Stable tag: 2.0.0
License: GPLv2 or later

Lead-only outreach module with templates, tracking and CRM Core sync (email as unique key).

CSV import headers:
email,name,phone,tags,status

CRM Core integration:
- do_action('digitify_crm/upsert_contact', $email, $data)
- do_action('digitify_crm/log_event', $email, $event, $meta)

Optional function integration:
- digitify_crm_upsert_contact($email,$data)
- digitify_crm_log_event($email,$event,$meta)
