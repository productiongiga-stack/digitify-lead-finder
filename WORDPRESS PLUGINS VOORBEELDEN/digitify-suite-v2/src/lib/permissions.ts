import type { Role } from "@prisma/client";

// ============================================================================
// Bitfield-based RBAC
//
// Each permission is a bit flag. Roles map to default permission sets.
// Individual WorkspaceMember records can override with explicit permissions.
// ============================================================================

export const Permission = {
  // Contacts
  CONTACTS_VIEW:   1 << 0,
  CONTACTS_CREATE: 1 << 1,
  CONTACTS_EDIT:   1 << 2,
  CONTACTS_DELETE: 1 << 3,

  // Deals
  DEALS_VIEW:      1 << 4,
  DEALS_CREATE:    1 << 5,
  DEALS_EDIT:      1 << 6,
  DEALS_DELETE:    1 << 7,

  // Quotes
  QUOTES_VIEW:     1 << 8,
  QUOTES_CREATE:   1 << 9,
  QUOTES_EDIT:     1 << 10,
  QUOTES_SEND:     1 << 11,

  // Invoices
  INVOICES_VIEW:   1 << 12,
  INVOICES_CREATE: 1 << 13,
  INVOICES_SEND:   1 << 14,

  // Scheduling
  SCHEDULING_VIEW:   1 << 15,
  SCHEDULING_MANAGE: 1 << 16,

  // Tasks
  TASKS_VIEW:      1 << 17,
  TASKS_MANAGE:    1 << 18,

  // Templates & Forms
  TEMPLATES_MANAGE: 1 << 19,
  FORMS_MANAGE:     1 << 20,

  // Automations
  AUTOMATIONS_MANAGE: 1 << 21,

  // Team & Settings
  TEAM_MANAGE:     1 << 22,
  SETTINGS_MANAGE: 1 << 23,
  BILLING_MANAGE:  1 << 24,

  // Integrations
  INTEGRATIONS_MANAGE: 1 << 25,

  // Analytics
  ANALYTICS_VIEW: 1 << 26,

  // Admin
  WORKSPACE_DELETE: 1 << 27,

  // Configurator / Builder
  CONFIGURATOR_VIEW:   1 << 28,
  CONFIGURATOR_CREATE: 1 << 29,
  CONFIGURATOR_EDIT:   1 << 30,
} as const;

export type PermissionKey = keyof typeof Permission;

// Pre-computed role permission masks
const ALL_PERMISSIONS = Object.values(Permission).reduce((a, b) => a | b, 0);

const MEMBER_PERMISSIONS =
  Permission.CONTACTS_VIEW |
  Permission.CONTACTS_CREATE |
  Permission.CONTACTS_EDIT |
  Permission.DEALS_VIEW |
  Permission.DEALS_CREATE |
  Permission.DEALS_EDIT |
  Permission.QUOTES_VIEW |
  Permission.QUOTES_CREATE |
  Permission.QUOTES_EDIT |
  Permission.QUOTES_SEND |
  Permission.INVOICES_VIEW |
  Permission.SCHEDULING_VIEW |
  Permission.SCHEDULING_MANAGE |
  Permission.TASKS_VIEW |
  Permission.TASKS_MANAGE |
  Permission.ANALYTICS_VIEW |
  Permission.CONFIGURATOR_VIEW |
  Permission.CONFIGURATOR_CREATE |
  Permission.CONFIGURATOR_EDIT;

const VIEWER_PERMISSIONS =
  Permission.CONTACTS_VIEW |
  Permission.DEALS_VIEW |
  Permission.QUOTES_VIEW |
  Permission.INVOICES_VIEW |
  Permission.SCHEDULING_VIEW |
  Permission.TASKS_VIEW |
  Permission.ANALYTICS_VIEW |
  Permission.CONFIGURATOR_VIEW;

export const ROLE_PERMISSIONS: Record<Role, number> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS & ~Permission.WORKSPACE_DELETE & ~Permission.BILLING_MANAGE,
  MEMBER: MEMBER_PERMISSIONS,
  VIEWER: VIEWER_PERMISSIONS,
};

/**
 * Check if a member has a specific permission.
 * Uses explicit permission override if set, otherwise falls back to role defaults.
 */
export function hasPermission(
  role: Role,
  explicitPermissions: number | null,
  permission: number
): boolean {
  const mask = explicitPermissions ?? ROLE_PERMISSIONS[role];
  return (mask & permission) === permission;
}

/**
 * Check multiple permissions (all must be present).
 */
export function hasAllPermissions(
  role: Role,
  explicitPermissions: number | null,
  ...permissions: number[]
): boolean {
  return permissions.every((p) => hasPermission(role, explicitPermissions, p));
}

/**
 * Check if any of the given permissions is present.
 */
export function hasAnyPermission(
  role: Role,
  explicitPermissions: number | null,
  ...permissions: number[]
): boolean {
  return permissions.some((p) => hasPermission(role, explicitPermissions, p));
}
