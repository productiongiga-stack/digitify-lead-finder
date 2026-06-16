import { HydrateClient, getServerHelpers } from "@/lib/trpc/server";
import { DashboardPageInner } from "./dashboard-page-inner";

export default async function DashboardPage() {
  const helpers = await getServerHelpers();
  await helpers.dashboard.getOverview.prefetch();

  return (
    <HydrateClient>
      <DashboardPageInner />
    </HydrateClient>
  );
}
