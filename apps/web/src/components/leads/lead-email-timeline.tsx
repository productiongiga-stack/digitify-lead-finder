"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@digitify/ui";
import { Timeline } from "@digitify/ui";
import { ArrowDownLeft, ArrowUpRight, Mail } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export function LeadEmailTimeline({ leadId }: { leadId: string }) {
  const { data, isLoading } = trpc.lead.getEmailTimeline.useQuery(
    { leadId },
    { refetchOnWindowFocus: false },
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            E-mailgeschiedenis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            E-mailgeschiedenis
          </span>
          {items.length > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {items.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline
          emptyLabel="Nog geen e-mails gekoppeld aan deze lead."
          items={items.map((item) => {
            const inbound = item.direction === "inbound";
            return {
              id: item.id,
              icon: inbound ? (
                <ArrowDownLeft className="h-2.5 w-2.5 text-sky-600" />
              ) : (
                <ArrowUpRight className="h-2.5 w-2.5 text-emerald-600" />
              ),
              iconClassName: inbound ? "border-sky-200 bg-sky-50" : "border-emerald-200 bg-emerald-50",
              title: (
                <span className="flex flex-wrap items-center gap-2">
                  <span>{item.subject}</span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {inbound ? "Ontvangen" : "Verzonden"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {item.channel}
                  </Badge>
                </span>
              ),
              description: (
                <span className="block space-y-1">
                  <span>
                    {inbound ? "Van" : "Naar"} {item.counterparty} · {item.status}
                  </span>
                  {item.bodyPreview ? (
                    <span className="line-clamp-2 text-[11px] leading-relaxed">{item.bodyPreview}</span>
                  ) : null}
                  {item.draftId ? (
                    <Button asChild variant="link" className="h-auto p-0 text-[11px]">
                      <Link href={`/contacts/drafts/${item.draftId}`}>Concept bekijken</Link>
                    </Button>
                  ) : null}
                </span>
              ),
              timestamp: formatRelativeTime(item.at),
            };
          })}
        />
      </CardContent>
    </Card>
  );
}
