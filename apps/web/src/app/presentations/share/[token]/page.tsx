import { PresentationShareReader } from "@/components/presentations/presentation-share-reader";

export default async function SharedPresentationRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PresentationShareReader token={token} />;
}
