/**
 * Digitify Suite — Database Layer
 * Central data access point. Initializes all repositories and seeds data.
 *
 * Replaces: WordPress $wpdb global, wp_options, and all plugin-specific
 * database tables across 6 plugins.
 *
 * Future: Replace Repository internals with REST API calls.
 * Each repository method has @API comments indicating the endpoint.
 */

import { Repository } from './repository.js';
import {
  seedCompanies, seedContacts, seedLeads, seedBookings, seedEventTypes,
  seedAgendaItems, seedTodos, seedOffertes, seedTimeline, seedTags,
  seedTagRelations, seedTemplates, seedEmailLogs, seedAvailability, seedSettings,
} from './seed.js';

// ── Repository instances ─────────────────────────────────

export const companies     = new Repository('companies');
export const contacts      = new Repository('contacts');
export const leads         = new Repository('leads');
export const bookings      = new Repository('bookings');
export const eventTypes    = new Repository('event_types');
export const agendaItems   = new Repository('agenda_items');
export const todos         = new Repository('todos');
export const offertes      = new Repository('offertes');
export const timeline      = new Repository('timeline');
export const tags          = new Repository('tags');
export const tagRelations  = new Repository('tag_relations');
export const templates     = new Repository('templates');
export const emailLogs     = new Repository('email_logs');
export const availability  = new Repository('availability');
export const settings      = new Repository('settings');

// ── Initialization ───────────────────────────────────────

export function initDatabase() {
  companies.seedIfEmpty(seedCompanies);
  contacts.seedIfEmpty(seedContacts);
  leads.seedIfEmpty(seedLeads);
  bookings.seedIfEmpty(seedBookings);
  eventTypes.seedIfEmpty(seedEventTypes);
  agendaItems.seedIfEmpty(seedAgendaItems);
  todos.seedIfEmpty(seedTodos);
  offertes.seedIfEmpty(seedOffertes);
  timeline.seedIfEmpty(seedTimeline);
  tags.seedIfEmpty(seedTags);
  tagRelations.seedIfEmpty(seedTagRelations);
  templates.seedIfEmpty(seedTemplates);
  emailLogs.seedIfEmpty(seedEmailLogs);
  availability.seedIfEmpty(seedAvailability);
  settings.seedIfEmpty(seedSettings);
}

// ── Convenience queries (cross-entity) ───────────────────

/** Get tags for a contact (many-to-many via tagRelations) */
export function getContactTags(contactId) {
  const rels = tagRelations.findBy('contact_id', contactId);
  const tagIds = rels.map(r => r.tag_id);
  return tags.getAll().filter(t => tagIds.includes(t.id));
}

/** Get timeline for a contact */
export function getContactTimeline(contactId) {
  return timeline.findBy('contact_id', contactId)
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
}

/** Get leads for a contact */
export function getContactLeads(contactId) {
  return leads.findBy('contact_id', contactId);
}

/** Get offertes for a contact */
export function getContactOffertes(contactId) {
  return offertes.findBy('contact_id', contactId);
}

/** Get bookings for a contact email */
export function getContactBookings(email) {
  return bookings.findBy('attendee_email', email);
}

/** Get active company */
export function getActiveCompany(companyId) {
  return companies.getById(companyId);
}

/** Get pipeline stages for a company */
export function getCompanyPipeline(companyId) {
  const company = companies.getById(companyId);
  if (!company || !company.pipeline_stages) {
    return [
      { key: 'Nieuw', label: 'Nieuw', color: '#6366f1' },
      { key: 'Gecontacteerd', label: 'Gecontacteerd', color: '#3b82f6' },
      { key: 'Offerte verzonden', label: 'Offerte verzonden', color: '#f59e0b' },
      { key: 'Gewonnen', label: 'Gewonnen', color: '#10b981' },
      { key: 'Verloren', label: 'Verloren', color: '#ef4444' },
    ];
  }
  try { return JSON.parse(company.pipeline_stages); } catch { return []; }
}

/** Dashboard KPIs */
export function getDashboardKPIs(companyId) {
  const allContacts = companyId
    ? contacts.findBy('company_id', companyId)
    : contacts.getAll();
  const allLeads = companyId
    ? leads.findBy('company_id', companyId)
    : leads.getAll();
  const allOffertes = companyId
    ? offertes.findBy('company_id', companyId)
    : offertes.getAll();
  const allBookings = bookings.getAll();

  const totalRevenue = allOffertes
    .filter(o => o.status === 'accepted')
    .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

  const pendingOffertes = allOffertes.filter(o => ['draft', 'sent'].includes(o.status));
  const pendingValue = pendingOffertes.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

  return {
    totalContacts: allContacts.length,
    activeLeads: allLeads.filter(l => ['new', 'quoted'].includes(l.status)).length,
    totalOffertes: allOffertes.length,
    pendingOffertes: pendingOffertes.length,
    pendingValue,
    totalRevenue,
    upcomingBookings: allBookings.filter(b => new Date(b.start_time) > new Date() && b.status !== 'cancelled').length,
    wonDeals: allOffertes.filter(o => o.status === 'accepted').length,
    lostDeals: allOffertes.filter(o => o.status === 'rejected').length,
  };
}
