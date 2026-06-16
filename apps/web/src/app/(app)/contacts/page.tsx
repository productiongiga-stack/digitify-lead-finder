import { HydrateClient, getServerHelpers } from "@/lib/trpc/server";
import { ContactsPageInner } from "./contacts-page-inner";

export default async function ContactsPage() {
  const helpers = await getServerHelpers();
  await helpers.contact.getOverview.prefetch({
    page: 1,
    pageSize: 50,
  });

  return (
    <HydrateClient>
      <ContactsPageInner />
    </HydrateClient>
  );
}
