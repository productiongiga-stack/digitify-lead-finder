import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SettingsPathGuard } from "./settings-path-guard";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = user.workspaceRole ?? user.role;

  return <SettingsPathGuard role={role}>{children}</SettingsPathGuard>;
}
