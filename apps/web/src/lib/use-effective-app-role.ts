"use client";

import { useSession } from "next-auth/react";
import { effectiveAppRole, type AppRole } from "@/lib/permissions";

type SessionRoleUser = {
  role?: string | null;
  workspaceRole?: string | null;
};

export function useEffectiveAppRole(): AppRole {
  const { data: session } = useSession();
  return effectiveAppRole(session?.user as SessionRoleUser | undefined);
}
