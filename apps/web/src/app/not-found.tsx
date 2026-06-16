import Link from "next/link";
import { Button } from "@digitify/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Pagina niet gevonden</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Deze pagina bestaat niet of je hebt geen toegang.
      </p>
      <Button asChild>
        <Link href="/dashboard">Naar dashboard</Link>
      </Button>
    </div>
  );
}
