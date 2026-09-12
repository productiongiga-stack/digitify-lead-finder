import { HydrateClient, getServerHelpers } from "@/lib/trpc/server";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardPageInner } from "./dashboard-page-inner";

export default async function DashboardPage() {
  // The layout also protects this route, but the page can start rendering in
  // parallel. Guard before prefetching the expensive overview query.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const helpers = await getServerHelpers();
  await helpers.dashboard.getOverview.prefetch();

  return (
    <HydrateClient>
      <DashboardPageInner />
    </HydrateClient>
  );
}
