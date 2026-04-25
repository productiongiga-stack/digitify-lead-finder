"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2, MessageSquareWarning, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@digitify/ui";
import { trpc } from "@/lib/trpc/client";
import { formatDate, safeExternalUrl } from "@/lib/utils";
import { useToast } from "@/components/feedback/toast-provider";

type FeedbackStatus = "OPEN" | "TRIAGED" | "CLOSED";

const statusLabels: Record<FeedbackStatus, string> = {
  OPEN: "Open",
  TRIAGED: "Opgepakt",
  CLOSED: "Gesloten",
};

const statusVariants: Record<FeedbackStatus, "warning" | "info" | "success"> = {
  OPEN: "warning",
  TRIAGED: "info",
  CLOSED: "success",
};

function statusSummary(items: Array<{ status: FeedbackStatus }> | undefined, status: FeedbackStatus) {
  return items?.filter((item) => item.status === status).length ?? 0;
}

export default function FeedbackSettingsPage() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const { data: feedback, isLoading, error, refetch, isFetching } = trpc.registration.listFeedback.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const updateStatus = trpc.registration.updateFeedbackStatus.useMutation({
    onSuccess: () => {
      utils.registration.listFeedback.invalidate();
      showToast({
        title: "Feedback bijgewerkt",
        description: "De status is opgeslagen.",
      });
    },
    onError: (mutationError) => {
      showToast({
        title: "Status wijzigen mislukt",
        description: mutationError.message,
        variant: "error",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Terug naar instellingen">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Bekijk meldingen, ideeën en problemen die gebruikers via de app doorsturen.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Vernieuwen
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Feedback kan niet geladen worden</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {(["OPEN", "TRIAGED", "CLOSED"] as FeedbackStatus[]).map((status) => (
          <Card key={status} className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquareWarning className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{statusSummary(feedback, status)}</p>
                <p className="text-xs text-muted-foreground">{statusLabels[status]}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingezonden feedback</CardTitle>
          <CardDescription className="text-xs">
            Alleen admins zien deze lijst. Nieuwe feedback blijft zichtbaar tot ze wordt gesloten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!feedback?.length ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm font-medium">Nog geen feedback ontvangen</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Zodra iemand de feedbackknop gebruikt, verschijnt het bericht hier.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Gebruiker</TableHead>
                  <TableHead>Pagina</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedback.map((item) => {
                  const pageUrl = safeExternalUrl(item.pageUrl);
                  return (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="max-w-xl">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.subject}</p>
                            <Badge variant={statusVariants[item.status as FeedbackStatus]}>
                              {statusLabels[item.status as FeedbackStatus]}
                            </Badge>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-44 text-sm">{item.userEmail || "-"}</TableCell>
                      <TableCell className="min-w-36 text-sm">
                        {pageUrl ? (
                          <a
                            href={pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Openen
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="min-w-28 text-sm">{formatDate(item.createdAt)}</TableCell>
                      <TableCell className="min-w-40">
                        <Select
                          value={item.status}
                          onValueChange={(status: FeedbackStatus) =>
                            updateStatus.mutate({ id: item.id, status })
                          }
                          disabled={updateStatus.isPending}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="TRIAGED">Opgepakt</SelectItem>
                            <SelectItem value="CLOSED">Gesloten</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
