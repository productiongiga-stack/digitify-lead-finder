import { redirect } from "next/navigation";

export default async function LegacyLeadReportRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/reports/${id}/print`);
}
