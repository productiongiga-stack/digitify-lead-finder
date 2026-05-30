"use client";

import { Bot, Sparkles } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@digitify/ui";
import { useUIStore } from "@/stores/ui-store";
import { resolveOpenClawPageAssist } from "./page-assist-config";

type OpenClawPageAssistProps = {
  pathname: string;
  className?: string;
};

export function OpenClawPageAssist({ pathname, className }: OpenClawPageAssistProps) {
  const config = resolveOpenClawPageAssist(pathname);
  const openAssist = useUIStore((state) => state.openOpenClawAssist);

  if (!config) return null;

  return (
    <Card className={className ?? "border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          {config.title}
        </CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          De assistent krijgt live context van deze pagina (instellingen + diagnose).
        </p>
        <Button
          type="button"
          variant="default"
          className="shrink-0"
          onClick={() =>
            openAssist({
              pathname,
              seedMessage: config.starterPrompts[0],
              assistBookings: config.assistBookings,
            })
          }
        >
          <Bot className="mr-2 h-4 w-4" />
          Vraag OpenClaw
        </Button>
      </CardContent>
    </Card>
  );
}
