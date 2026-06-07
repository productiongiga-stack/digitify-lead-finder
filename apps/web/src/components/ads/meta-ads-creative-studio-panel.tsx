"use client";

import Link from "next/link";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@digitify/ui";
import { ExternalLink, Megaphone, Sparkles, Video } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

export function MetaAdsCreativeStudioPanel() {
  const history = trpc.media.listHistory.useQuery({ type: "MARKETING_AD", page: 1, pageSize: 3 });

  return (
    <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/50 to-white dark:from-violet-950/20 dark:to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-violet-600" />
          AI advertentievideo&apos;s
        </CardTitle>
        <CardDescription>
          Genereer video-creatives in Creative Studio en gebruik de Blob-URL in je Meta-advertentie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild>
          <Link href="/creative-studio?tab=ads">
            <Megaphone className="mr-2 h-4 w-4" />
            Open Marketing Studio
          </Link>
        </Button>

        {history.data?.items.length ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recente advertenties</p>
            {history.data.items.map((item) => {
              const previewUrl = item.blobUrl || item.outputUrl;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-background/80 p-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                    {previewUrl ? <Video className="h-5 w-5 text-muted-foreground" /> : <Sparkles className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{item.prompt}</p>
                    <Badge variant="outline" className="mt-1">
                      {item.status}
                    </Badge>
                  </div>
                  {previewUrl ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={previewUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Open
                      </a>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nog geen marketing-advertenties gegenereerd.</p>
        )}
      </CardContent>
    </Card>
  );
}
