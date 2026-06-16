import { HydrateClient, getServerHelpers } from "@/lib/trpc/server";
import { QuotesPageInner } from "./quotes-page-inner";

export default async function QuotesPage() {
  const helpers = await getServerHelpers();
  await helpers.quote.list.prefetch({
    page: 1,
    perPage: 20,
  });
  await helpers.quote.getStats.prefetch();

  return (
    <HydrateClient>
      <QuotesPageInner />
    </HydrateClient>
  );
}
