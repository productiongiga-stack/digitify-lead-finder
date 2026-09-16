import type { PrismaClient } from "@prisma/client";

export type DatabaseRoleStatus = {
  userName: string;
  isSuperuser: boolean;
  bypassRls: boolean;
};

export async function getCurrentDatabaseRole(
  db: Pick<PrismaClient, "$queryRaw">,
): Promise<DatabaseRoleStatus> {
  const rows = await db.$queryRaw<DatabaseRoleStatus[]>`
    SELECT current_user AS "userName",
           rolsuper AS "isSuperuser",
           rolbypassrls AS "bypassRls"
    FROM pg_roles
    WHERE rolname = current_user
  `;
  const role = rows[0];
  if (!role) throw new Error("database role could not be resolved");
  return role;
}

export async function assertSafeDatabaseRole(
  db: Pick<PrismaClient, "$queryRaw">,
): Promise<DatabaseRoleStatus> {
  const role = await getCurrentDatabaseRole(db);
  if (role.isSuperuser || role.bypassRls) {
    throw new Error("database role must not have SUPERUSER or BYPASSRLS");
  }
  return role;
}
