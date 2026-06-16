import { HydrateClient, getServerHelpers } from "@/lib/trpc/server";
import { LeadsPageInner } from "./leads-page-inner";

export default async function LeadsPage() {
  const helpers = await getServerHelpers();
  await helpers.lead.listSummary.prefetch({
    filters: {},
    sortBy: "createdAt",
    sortDir: "desc",
    page: 1,
    pageSize: 25,
  });
  await helpers.tag.list.prefetch();

  return (
    <HydrateClient>
      <LeadsPageInner />
    </HydrateClient>
  );
}
