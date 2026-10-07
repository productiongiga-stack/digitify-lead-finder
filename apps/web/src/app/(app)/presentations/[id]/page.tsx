import { PresentationEditor } from "@/components/presentations/presentation-editor";

export default async function PresentationRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PresentationEditor id={id} />;
}
