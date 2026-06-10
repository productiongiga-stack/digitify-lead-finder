"use client";

import Link from "next/link";
import { Button, Card, CardContent, Skeleton } from "@digitify/ui";
import { KeyRound, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { CreativeEmptyState } from "./creative-studio-ui";

type Props = {
  isLoading: boolean;
  hasKey: boolean | undefined;
  title?: string;
  description?: string;
  children: ReactNode;
};

export function MuapiKeyGate({
  isLoading,
  hasKey,
  title = "MuAPI-key vereist",
  description = "Voeg je persoonlijke MuAPI-sleutel toe om te genereren.",
  children,
}: Props) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-36" />
        </CardContent>
      </Card>
    );
  }

  if (!hasKey) {
    return (
      <CreativeEmptyState icon={KeyRound} title={title} description={description}>
        <Button className="mt-4" asChild>
          <Link href="/settings/integrations?tab=muapi">
            <Sparkles className="mr-2 h-4 w-4" />
            MuAPI-key instellen
          </Link>
        </Button>
      </CreativeEmptyState>
    );
  }

  return <>{children}</>;
}
