import { db } from "@/lib/db";

// ============================================================================
// Activity Logger
//
// Central utility for recording business events. Every significant action
// flows through here. Activities power:
// - Contact/deal timelines
// - Dashboard activity feed
// - Automation triggers (event bus)
// - Audit trail
// ============================================================================

export interface LogActivityInput {
  workspaceId: string;
  type: string;        // e.g. "contact.created", "deal.stage_changed"
  summary: string;     // Human-readable: "Created contact Emma Claes"
  userId?: string;     // Actor (null for system events)
  entityType?: string; // "contact", "deal", "quote", etc.
  entityId?: string;   // ID of the entity
  contactId?: string;  // Optional: link to contact for timeline
  metadata?: Record<string, any>;
}

/**
 * Record a business activity. Non-blocking — fire and forget in most cases.
 * Returns the created activity for testing/chaining.
 */
export async function logActivity(input: LogActivityInput) {
  const activity = await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: input.type,
      summary: input.summary,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      contactId: input.contactId,
      metadata: input.metadata as any ?? undefined,
    },
  });

  // Future: dispatch to event bus for automation triggers
  // await eventBus.emit(input.type, { activityId: activity.id, ...input });

  return activity;
}

/**
 * Convenience: log + audit in one call for write operations.
 */
export async function logActivityAndAudit(
  input: LogActivityInput & {
    action: "create" | "update" | "delete";
    changes?: Record<string, { old: any; new: any }>;
    ipAddress?: string;
  }
) {
  const [activity] = await Promise.all([
    logActivity(input),
    db.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        action: input.action,
        entity: input.entityType ?? "unknown",
        entityId: input.entityId,
        changes: input.changes as any ?? undefined,
        userId: input.userId,
        ipAddress: input.ipAddress,
      },
    }),
  ]);

  return activity;
}
