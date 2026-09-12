/**
 * Digitify Suite — Seed Data
 * Realistic demo data voor alle modules.
 *
 * This replaces the WordPress database tables with in-memory data
 * that gets persisted to localStorage. Data models are unified from:
 *
 * Contacts: merged from digitify_crm_contacts, owmc_contacts, dol_leads
 * Companies: from owmc_companies
 * Leads: from owmc_leads (quote requests)
 * Bookings: from digitify_bookings + digitify_event_types
 * Agenda: from dap_agenda_items + dap_todos
 * Offertes: derived from owmc_leads with pricing data
 * Events/Timeline: from digitify_crm_events + owmc_contact_events
 * Tags: from digitify_crm_tags + owmc_tags
 * Templates: from dol_templates
 * Email logs: merged from digitify_crm_email_logs, owmc_email_logs, dol_messages
 */

const now = new Date();
const ago = (days) => new Date(now - days * 86400000).toISOString();
const future = (days) => new Date(now.getTime() + days * 86400000).toISOString();

export const seedCompanies = [
  {
    id: 1,
    slug: 'digitify',
    name: 'Digitify',
    email: 'info@digitify.be',
    phone: '+32 470 12 34 56',
    logo_url: '',
    primary_color: '#6366f1',
    secondary_color: '#4f46e5',
    btw_rate: 21,
    btw_enabled: true,
    header_meta: 'Offerte aanvraag — selecteer uw werken',
    pipeline_stages: JSON.stringify([
      { key: 'Nieuw', label: 'Nieuw', color: '#6366f1' },
      { key: 'Gecontacteerd', label: 'Gecontacteerd', color: '#3b82f6' },
      { key: 'Offerte verzonden', label: 'Offerte verzonden', color: '#f59e0b' },
      { key: 'Gewonnen', label: 'Gewonnen', color: '#10b981' },
      { key: 'Verloren', label: 'Verloren', color: '#ef4444' },
    ]),
    wizard_json: JSON.stringify({
      services: [
        { id: 'webdesign', title: 'Webdesign', desc: 'Professionele website', icon: '🌐', pricing: { base: 1500, perUnit: 200 } },
        { id: 'seo', title: 'SEO Optimalisatie', desc: 'Zoekmachine optimalisatie', icon: '🔍', pricing: { base: 500 } },
        { id: 'branding', title: 'Branding', desc: 'Logo & huisstijl', icon: '🎨', pricing: { base: 800 } },
      ]
    }),
    created_at: ago(90),
    updated_at: ago(2),
  },
  {
    id: 2,
    slug: 'bouwbedrijf-janssen',
    name: 'Bouwbedrijf Janssen',
    email: 'info@janssen-bouw.be',
    phone: '+32 3 123 45 67',
    logo_url: '',
    primary_color: '#f59e0b',
    secondary_color: '#d97706',
    btw_rate: 21,
    btw_enabled: true,
    header_meta: 'Offerte aanvraag — selecteer uw werken',
    pipeline_stages: JSON.stringify([
      { key: 'Nieuw', label: 'Nieuw', color: '#6366f1' },
      { key: 'Gecontacteerd', label: 'Gecontacteerd', color: '#3b82f6' },
      { key: 'Offerte verzonden', label: 'Offerte verzonden', color: '#f59e0b' },
      { key: 'Gewonnen', label: 'Gewonnen', color: '#10b981' },
      { key: 'Verloren', label: 'Verloren', color: '#ef4444' },
    ]),
    wizard_json: JSON.stringify({
      services: [
        { id: 'afbraak', title: 'Afbraak', desc: 'Afbraak & ontmanteling', icon: '🏗️', pricing: { base: 500, perM2: 25 } },
        { id: 'riolering', title: 'Riolering', desc: 'Aanleg & herstelling', icon: '🚧', pricing: { base: 800 } },
        { id: 'grondwerken', title: 'Grondwerken', desc: 'Nivellering & uitgraving', icon: '⛏️', pricing: { base: 600, perM2: 15 } },
      ]
    }),
    created_at: ago(60),
    updated_at: ago(5),
  },
];

export const seedContacts = [
  { id: 1, email: 'jan.devries@email.be', name: 'Jan De Vries', tel: '+32 470 11 22 33', status: 'active', pipeline_stage: 'Gewonnen', notes: 'Trouwe klant sinds 2024.', source: 'website', company_id: 1, last_activity_at: ago(1), created_at: ago(45) },
  { id: 2, email: 'sophie.maes@bedrijf.be', name: 'Sophie Maes', tel: '+32 486 44 55 66', status: 'active', pipeline_stage: 'Offerte verzonden', notes: 'Geïnteresseerd in SEO pakket.', source: 'referral', company_id: 1, last_activity_at: ago(2), created_at: ago(30) },
  { id: 3, email: 'thomas.willems@gmail.com', name: 'Thomas Willems', tel: '+32 497 77 88 99', status: 'lead', pipeline_stage: 'Nieuw', notes: '', source: 'offerte-wizard', company_id: 2, last_activity_at: ago(3), created_at: ago(14) },
  { id: 4, email: 'lisa.peeters@company.be', name: 'Lisa Peeters', tel: '+32 475 22 33 44', status: 'active', pipeline_stage: 'Gecontacteerd', notes: 'Follow-up nodig over webshop.', source: 'booking', company_id: 1, last_activity_at: ago(4), created_at: ago(60) },
  { id: 5, email: 'marc.janssen@bouw.be', name: 'Marc Janssen', tel: '+32 496 55 66 77', status: 'active', pipeline_stage: 'Gewonnen', notes: 'Grote klant, meerdere projecten.', source: 'manual', company_id: 2, last_activity_at: ago(0), created_at: ago(90) },
  { id: 6, email: 'emma.claes@startup.be', name: 'Emma Claes', tel: '+32 484 88 99 00', status: 'lead', pipeline_stage: 'Nieuw', notes: 'Ingevuld via offerte wizard.', source: 'offerte-wizard', company_id: 1, last_activity_at: ago(1), created_at: ago(5) },
  { id: 7, email: 'kevin.hermans@test.be', name: 'Kevin Hermans', tel: '+32 477 11 33 55', status: 'inactive', pipeline_stage: 'Verloren', notes: 'Koos voor concurrent.', source: 'outreach', company_id: 1, last_activity_at: ago(20), created_at: ago(40) },
  { id: 8, email: 'anna.wouters@shop.be', name: 'Anna Wouters', tel: '+32 468 22 44 66', status: 'active', pipeline_stage: 'Offerte verzonden', notes: 'Wacht op goedkeuring directie.', source: 'manual', company_id: 2, last_activity_at: ago(3), created_at: ago(25) },
];

export const seedLeads = [
  { id: 1, company_id: 1, contact_id: 6, name: 'Emma Claes', email: 'emma.claes@startup.be', tel: '+32 484 88 99 00', diensten: 'webdesign,seo', status: 'new', pipeline_stage: 'Nieuw', total_price: 2200, currency: 'EUR', notes: '', page_url: 'https://digitify.be/offerte', created_at: ago(5), updated_at: ago(5) },
  { id: 2, company_id: 1, contact_id: 2, name: 'Sophie Maes', email: 'sophie.maes@bedrijf.be', tel: '+32 486 44 55 66', diensten: 'seo', status: 'quoted', pipeline_stage: 'Offerte verzonden', total_price: 500, currency: 'EUR', notes: 'SEO audit gewenst.', created_at: ago(10), updated_at: ago(2) },
  { id: 3, company_id: 2, contact_id: 3, name: 'Thomas Willems', email: 'thomas.willems@gmail.com', tel: '+32 497 77 88 99', diensten: 'afbraak,grondwerken', status: 'new', pipeline_stage: 'Nieuw', total_price: 4500, currency: 'EUR', notes: 'Renovatie woning.', created_at: ago(3), updated_at: ago(3) },
  { id: 4, company_id: 1, contact_id: 1, name: 'Jan De Vries', email: 'jan.devries@email.be', tel: '+32 470 11 22 33', diensten: 'webdesign,branding', status: 'won', pipeline_stage: 'Gewonnen', total_price: 2300, currency: 'EUR', notes: 'Project opgeleverd.', created_at: ago(30), updated_at: ago(10) },
  { id: 5, company_id: 2, contact_id: 8, name: 'Anna Wouters', email: 'anna.wouters@shop.be', tel: '+32 468 22 44 66', diensten: 'riolering', status: 'quoted', pipeline_stage: 'Offerte verzonden', total_price: 800, currency: 'EUR', notes: 'Wacht op goedkeuring.', created_at: ago(8), updated_at: ago(3) },
];

export const seedBookings = [
  { id: 1, event_type_id: 1, event_type_title: 'Kennismakingsgesprek', attendee_name: 'Emma Claes', attendee_email: 'emma.claes@startup.be', attendee_phone: '+32 484 88 99 00', attendee_notes: 'Graag meer info over webdesign.', start_time: future(2), end_time: future(2), status: 'confirmed', duration: 30, google_event_id: null, meet_link: 'https://meet.google.com/abc-defg-hij', uid: 'bk_abc123', created_at: ago(1) },
  { id: 2, event_type_id: 2, event_type_title: 'Offertebespreking', attendee_name: 'Sophie Maes', attendee_email: 'sophie.maes@bedrijf.be', attendee_phone: '+32 486 44 55 66', attendee_notes: 'Offerte SEO pakket bespreken.', start_time: future(5), end_time: future(5), status: 'pending', duration: 45, google_event_id: null, meet_link: null, uid: 'bk_def456', created_at: ago(2) },
  { id: 3, event_type_id: 1, event_type_title: 'Kennismakingsgesprek', attendee_name: 'Thomas Willems', attendee_email: 'thomas.willems@gmail.com', attendee_phone: '+32 497 77 88 99', attendee_notes: '', start_time: ago(3), end_time: ago(3), status: 'completed', duration: 30, google_event_id: null, meet_link: null, uid: 'bk_ghi789', created_at: ago(7) },
];

export const seedEventTypes = [
  { id: 1, title: 'Kennismakingsgesprek', slug: 'kennismaking', duration: 30, description: 'Gratis kennismakingsgesprek van 30 minuten.', color: '#6366f1', location: 'Google Meet', buffer_before: 5, buffer_after: 10, active: true },
  { id: 2, title: 'Offertebespreking', slug: 'offertebespreking', duration: 45, description: 'Bespreking van een offerte of voorstel.', color: '#10b981', location: 'Kantoor', buffer_before: 0, buffer_after: 15, active: true },
  { id: 3, title: 'Projectbespreking', slug: 'projectbespreking', duration: 60, description: 'Uitgebreide projectbespreking.', color: '#f59e0b', location: 'Op locatie', buffer_before: 15, buffer_after: 15, active: true },
];

export const seedAgendaItems = [
  { id: 1, title: 'Kennismakingsgesprek Emma Claes', description: 'Eerste gesprek over website project.', start_at: future(2), end_at: new Date(new Date(future(2)).getTime() + 30 * 60000).toISOString(), type_key: 'meeting', color: '#6366f1', status: 'open', contact_email: 'emma.claes@startup.be', source_app: 'booking', source_id: '1', created_at: ago(1) },
  { id: 2, title: 'Follow-up Lisa Peeters', description: 'Webshop voorstel bespreken.', start_at: future(1), end_at: new Date(new Date(future(1)).getTime() + 45 * 60000).toISOString(), type_key: 'followup', color: '#f59e0b', status: 'open', contact_email: 'lisa.peeters@company.be', source_app: 'manual', created_at: ago(3) },
  { id: 3, title: 'Intern overleg planning Q2', description: '', start_at: future(3), end_at: new Date(new Date(future(3)).getTime() + 60 * 60000).toISOString(), type_key: 'internal', color: '#7c3aed', status: 'open', contact_email: '', source_app: 'manual', created_at: ago(5) },
  { id: 4, title: 'Offerte bespreken Sophie Maes', description: 'SEO audit offerte doorlopen.', start_at: future(5), end_at: new Date(new Date(future(5)).getTime() + 45 * 60000).toISOString(), type_key: 'quote', color: '#f97316', status: 'open', contact_email: 'sophie.maes@bedrijf.be', source_app: 'booking', source_id: '2', created_at: ago(2) },
  { id: 5, title: 'Project oplevering Jan De Vries', description: 'Website + branding opleveren.', start_at: ago(5), end_at: new Date(new Date(ago(5)).getTime() + 60 * 60000).toISOString(), type_key: 'confirmed', color: '#16a34a', status: 'done', contact_email: 'jan.devries@email.be', source_app: 'manual', created_at: ago(10) },
];

export const seedTodos = [
  { id: 1, title: 'Offerte SEO opmaken voor Sophie', estimated_minutes: 120, notes: 'Inclusief keyword analyse en technische audit.', due_at: future(3), priority: 'normal', status: 'open', color: '#6366f1', contact_email: 'sophie.maes@bedrijf.be', created_at: ago(4) },
  { id: 2, title: 'Website mockup Emma Claes', estimated_minutes: 240, notes: 'Responsive design, 5 paginas.', due_at: future(7), priority: 'normal', status: 'open', color: '#3b82f6', contact_email: 'emma.claes@startup.be', created_at: ago(2) },
  { id: 3, title: 'Factuur Jan De Vries verzenden', estimated_minutes: 15, notes: '', due_at: future(1), priority: 'urgent', status: 'open', color: '#dc2626', contact_email: 'jan.devries@email.be', created_at: ago(1) },
];

export const seedOffertes = [
  { id: 1, company_id: 1, contact_id: 1, contact_name: 'Jan De Vries', contact_email: 'jan.devries@email.be', ref: 'OFF-2025-001', status: 'accepted', lines: [{ service: 'Webdesign', price: 1500 }, { service: 'Branding', price: 800 }], subtotal: 2300, btw_rate: 21, btw: 483, total: 2783, currency: 'EUR', valid_days: 30, date: ago(30), exp_date: ago(0), notes: 'Opgeleverd en goedgekeurd.', created_at: ago(30), updated_at: ago(10) },
  { id: 2, company_id: 1, contact_id: 2, contact_name: 'Sophie Maes', contact_email: 'sophie.maes@bedrijf.be', ref: 'OFF-2025-002', status: 'sent', lines: [{ service: 'SEO Optimalisatie', price: 500 }], subtotal: 500, btw_rate: 21, btw: 105, total: 605, currency: 'EUR', valid_days: 30, date: ago(10), exp_date: future(20), notes: 'SEO audit + 3 maanden begeleiding.', created_at: ago(10), updated_at: ago(2) },
  { id: 3, company_id: 1, contact_id: 6, contact_name: 'Emma Claes', contact_email: 'emma.claes@startup.be', ref: 'OFF-2025-003', status: 'draft', lines: [{ service: 'Webdesign', price: 1500 }, { service: 'SEO Optimalisatie', price: 500 }], subtotal: 2000, btw_rate: 21, btw: 420, total: 2420, currency: 'EUR', valid_days: 30, date: ago(2), exp_date: future(28), notes: '', created_at: ago(2), updated_at: ago(1) },
  { id: 4, company_id: 2, contact_id: 3, contact_name: 'Thomas Willems', contact_email: 'thomas.willems@gmail.com', ref: 'OFF-2025-004', status: 'draft', lines: [{ service: 'Afbraak', price: 3500 }, { service: 'Grondwerken', price: 1000 }], subtotal: 4500, btw_rate: 21, btw: 945, total: 5445, currency: 'EUR', valid_days: 30, date: ago(3), exp_date: future(27), notes: 'Woning renovatie.', created_at: ago(3), updated_at: ago(3) },
  { id: 5, company_id: 2, contact_id: 8, contact_name: 'Anna Wouters', contact_email: 'anna.wouters@shop.be', ref: 'OFF-2025-005', status: 'sent', lines: [{ service: 'Riolering', price: 800 }], subtotal: 800, btw_rate: 21, btw: 168, total: 968, currency: 'EUR', valid_days: 30, date: ago(8), exp_date: future(22), notes: 'Wacht op goedkeuring directie.', created_at: ago(8), updated_at: ago(3) },
];

export const seedTimeline = [
  { id: 1, contact_id: 1, event_type: 'quote_accepted', summary: 'Offerte OFF-2025-001 goedgekeurd', source_app: 'offerte', meta: '{}', occurred_at: ago(10), created_at: ago(10) },
  { id: 2, contact_id: 1, event_type: 'quote_sent', summary: 'Offerte OFF-2025-001 verzonden', source_app: 'offerte', meta: '{}', occurred_at: ago(30), created_at: ago(30) },
  { id: 3, contact_id: 2, event_type: 'quote_sent', summary: 'Offerte OFF-2025-002 verzonden', source_app: 'offerte', meta: '{}', occurred_at: ago(10), created_at: ago(10) },
  { id: 4, contact_id: 2, event_type: 'email_sent', summary: 'Follow-up e-mail verzonden', source_app: 'outreach', meta: '{}', occurred_at: ago(5), created_at: ago(5) },
  { id: 5, contact_id: 6, event_type: 'contact_created', summary: 'Nieuw contact via offerte wizard', source_app: 'offerte-wizard', meta: '{}', occurred_at: ago(5), created_at: ago(5) },
  { id: 6, contact_id: 6, event_type: 'booking_created', summary: 'Kennismakingsgesprek geboekt', source_app: 'booking', meta: '{}', occurred_at: ago(1), created_at: ago(1) },
  { id: 7, contact_id: 4, event_type: 'email_sent', summary: 'Outreach e-mail verzonden', source_app: 'outreach', meta: '{}', occurred_at: ago(4), created_at: ago(4) },
  { id: 8, contact_id: 5, event_type: 'quote_accepted', summary: 'Project goedgekeurd', source_app: 'manual', meta: '{}', occurred_at: ago(0), created_at: ago(0) },
];

export const seedTags = [
  { id: 1, name: 'VIP', color: '#f59e0b', created_at: ago(90) },
  { id: 2, name: 'Prospect', color: '#6366f1', created_at: ago(90) },
  { id: 3, name: 'Follow-up', color: '#3b82f6', created_at: ago(90) },
  { id: 4, name: 'Webdesign', color: '#10b981', created_at: ago(60) },
  { id: 5, name: 'SEO', color: '#8b5cf6', created_at: ago(60) },
  { id: 6, name: 'Bouw', color: '#f97316', created_at: ago(60) },
];

export const seedTagRelations = [
  { contact_id: 1, tag_id: 1 },
  { contact_id: 1, tag_id: 4 },
  { contact_id: 2, tag_id: 2 },
  { contact_id: 2, tag_id: 5 },
  { contact_id: 3, tag_id: 6 },
  { contact_id: 5, tag_id: 1 },
  { contact_id: 5, tag_id: 6 },
  { contact_id: 6, tag_id: 2 },
];

export const seedTemplates = [
  { id: 1, name: 'Standaard Outreach', subject: 'Even een korte vraag, {{name}}', html: '<p>Hoi {{name}},</p><p>Ik had een korte vraag. Heb je 2 minuten om te antwoorden?</p><p>{{message}}</p><p>Groeten,<br>{{from_name}}</p>', created_at: ago(60), updated_at: ago(10) },
  { id: 2, name: 'Follow-up', subject: 'Nog even opvolgen, {{name}}', html: '<p>Hoi {{name}},</p><p>Ik wilde even opvolgen over ons vorige gesprek.</p><p>{{message}}</p><p>Groeten,<br>{{from_name}}</p>', created_at: ago(30), updated_at: ago(5) },
];

export const seedEmailLogs = [
  { id: 1, contact_id: 4, lead_email: 'lisa.peeters@company.be', subject: 'Even een korte vraag, Lisa', template_id: 1, status: 'sent', open_count: 2, click_count: 1, sent_at: ago(4), opened_at: ago(3), created_at: ago(4) },
  { id: 2, contact_id: 2, lead_email: 'sophie.maes@bedrijf.be', subject: 'Follow-up offerte SEO', template_id: 2, status: 'sent', open_count: 1, click_count: 0, sent_at: ago(5), opened_at: ago(4), created_at: ago(5) },
  { id: 3, contact_id: 7, lead_email: 'kevin.hermans@test.be', subject: 'Even een korte vraag, Kevin', template_id: 1, status: 'sent', open_count: 0, click_count: 0, sent_at: ago(20), opened_at: null, created_at: ago(20) },
];

export const seedAvailability = [
  { id: 1, day_of_week: 1, start_time: '09:00', end_time: '17:00', active: true },
  { id: 2, day_of_week: 2, start_time: '09:00', end_time: '17:00', active: true },
  { id: 3, day_of_week: 3, start_time: '09:00', end_time: '17:00', active: true },
  { id: 4, day_of_week: 4, start_time: '09:00', end_time: '17:00', active: true },
  { id: 5, day_of_week: 5, start_time: '09:00', end_time: '17:00', active: true },
];

export const seedSettings = [
  {
    id: 1,
    key: 'general',
    value: JSON.stringify({
      brand_name: 'Digitify',
      brand_primary: '#6366f1',
      brand_logo_url: '',
      from_name: 'Digitify',
      from_email: 'info@digitify.be',
      notification_email: 'info@digitify.be',
      date_format: 'dd/MM/yyyy',
      timezone: 'Europe/Brussels',
    }),
  },
];
