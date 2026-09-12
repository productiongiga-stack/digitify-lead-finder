import { db } from "@/lib/db";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { hasPermission, type PermissionKey, Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

// ============================================================================
// Base Service
//
// Provides workspace-scoped data access with permission checks.
// All domain services extend this to inherit tenancy + RBAC enforcement.
// ============================================================================

export interface ServiceContext {
  workspaceId: string;
  userId: string;
  role: Role;
  permissions: number | null; // Explicit permission overrides
}

export abstract class BaseService {
  protected db = db;
  protected ctx: ServiceContext;

  constructor(ctx: ServiceContext) {
    this.ctx = ctx;
  }

  /**
   * Assert the current user has a specific permission.
   * Throws ForbiddenError if not.
   */
  protected assertPermission(permission: number): void {
    if (!hasPermission(this.ctx.role, this.ctx.permissions, permission)) {
      throw new ForbiddenError();
    }
  }

  /**
   * Workspace-scoped where clause. Use in every query to enforce tenancy.
   */
  protected get where() {
    return { workspaceId: this.ctx.workspaceId };
  }
}
