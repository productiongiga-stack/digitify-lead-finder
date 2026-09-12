import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

/**
 * Authenticate an API route request and extract workspace context.
 *
 * Reads the workspace from the `x-workspace-id` header or cookie.
 * Returns the full context needed for service layer calls.
 */
export async function requireWorkspaceFromHeader(request: NextRequest) {
  // Get authenticated user from JWT
  const token = await getToken({ req: request });
  if (!token?.sub) {
    throw Object.assign(new Error("Niet ingelogd"), { statusCode: 401 });
  }

  // Get workspace ID from header
  const workspaceId =
    request.headers.get("x-workspace-id") ??
    request.cookies.get("workspace-id")?.value;

  if (!workspaceId) {
    throw Object.assign(new Error("Workspace ID ontbreekt"), {
      statusCode: 400,
    });
  }

  // Verify membership
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: token.sub,
      },
    },
  });

  if (!membership) {
    throw Object.assign(new Error("Geen toegang tot deze workspace"), {
      statusCode: 403,
    });
  }

  return {
    workspaceId,
    userId: token.sub,
    role: membership.role as Role,
    permissions: membership.permissions,
  };
}
