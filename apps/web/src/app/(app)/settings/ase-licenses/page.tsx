"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, KeyRound, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Input,
  Label,
  Textarea,
} from "@digitify/ui";

type IssuedBanner = {
  key: string;
  email: string;
  emailSent: boolean;
  emailError: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aanvraag",
  issued: "Uitgegeven",
  active: "Actief",
  revoked: "Ingetrokken",
  expired: "Verlopen",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "pending") return "default";
  if (status === "active") return "secondary";
  if (status === "revoked" || status === "expired") return "destructive";
  return "outline";
}

export default function AseLicensesSettingsPage() {
  const utils = trpc.useUtils();
  const list = trpc.aseLicense.list.useQuery();
  const [issued, setIssued] = useState<IssuedBanner | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending">("all");

  function onIssuedSuccess(data: {
    key: string;
    email: string;
    emailSent: boolean;
    emailError: string | null;
  }) {
    setIssued({
      key: data.key,
      email: data.email,
      emailSent: data.emailSent,
      emailError: data.emailError,
    });
    setCopied(false);
    utils.aseLicense.list.invalidate();
  }

  const createForEmail = trpc.aseLicense.createForEmail.useMutation({
    onSuccess: (data) => {
      onIssuedSuccess(data);
      setEmail("");
      setName("");
      setSiteUrl("");
      setMessage("");
    },
  });
  const issue = trpc.aseLicense.issue.useMutation({
    onSuccess: onIssuedSuccess,
  });
  const revoke = trpc.aseLicense.revoke.useMutation({
    onSuccess: () => utils.aseLicense.list.invalidate(),
  });

  const items = list.data?.items || [];
  const pendingCount = list.data?.pendingCount || 0;
  const visible = useMemo(
    () => (filter === "pending" ? items.filter((r) => r.status === "pending") : items),
    [filter, items],
  );

  async function copyKey() {
    if (!issued?.key) return;
    try {
      await navigator.clipboard.writeText(issued.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    createForEmail.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
      siteUrl: siteUrl.trim() || undefined,
      message: message.trim() || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings">
              <ArrowLeft className="mr-1 h-4 w-4" /> Terug
            </Link>
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Builder licenses</h1>
            <p className="text-sm text-muted-foreground">
              Keys uitgeven voor e-mails of aanvragen van{" "}
              <a className="underline" href="/ase-license" target="_blank" rel="noreferrer">
                /ase-license
              </a>
              . Keys worden gemaild en één keer hier getoond.
            </p>
          </div>
        </div>
        {pendingCount > 0 ? (
          <Badge className="shrink-0">{pendingCount} openstaande aanvraag{pendingCount === 1 ? "" : "en"}</Badge>
        ) : null}
      </div>

      {issued ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Nieuwe key (eenmalig zichtbaar)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-background px-2 py-1 text-sm font-semibold tracking-wide">
                {issued.key}
              </code>
              <Button size="sm" variant="secondary" onClick={copyKey}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                {copied ? "Gekopieerd" : "Kopieer"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>
                Verberg
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Voor: <strong>{issued.email}</strong>
              {issued.emailSent
                ? " · Mail verzonden"
                : ` · Mail niet verzonden${issued.emailError ? `: ${issued.emailError}` : ""} — kopieer de key handmatig`}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Key aanmaken voor e-mail</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ase-email">E-mail *</Label>
              <Input
                id="ase-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="klant@voorbeeld.be"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ase-name">Naam</Label>
              <Input
                id="ase-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optioneel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ase-site">Website URL</Label>
              <Input
                id="ase-site"
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://voorbeeld.be"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ase-message">Notitie</Label>
              <Textarea
                id="ase-message"
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optioneel"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={createForEmail.isPending || !email.trim()}>
                {createForEmail.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Key aanmaken en mailen
              </Button>
              {createForEmail.isError ? (
                <p className="mt-2 text-sm text-destructive">
                  {createForEmail.error.message || "Aanmaken mislukt"}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Aanvragen & keys</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === "all" ? "secondary" : "ghost"}
              onClick={() => setFilter("all")}
            >
              Alles
            </Button>
            <Button
              size="sm"
              variant={filter === "pending" ? "secondary" : "ghost"}
              onClick={() => setFilter("pending")}
            >
              Aanvragen{pendingCount ? ` (${pendingCount})` : ""}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {visible.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{row.email}</strong>
                  <Badge variant={statusVariant(row.status)}>
                    {STATUS_LABEL[row.status] || row.status}
                  </Badge>
                  {row.keyPrefix !== "PENDING" ? (
                    <span className="text-xs text-muted-foreground">{row.keyPrefix}…</span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {row.name || "—"} · {row.siteUrl || row.domain || "geen site"} ·{" "}
                  {new Date(row.createdAt).toLocaleString("nl-BE")}
                </p>
                {row.message ? <p className="text-xs text-muted-foreground">{row.message}</p> : null}
                {row.domain && row.status === "active" ? (
                  <p className="text-xs text-muted-foreground">Gebonden aan {row.domain}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {row.status === "pending" || row.status === "issued" ? (
                  <Button
                    size="sm"
                    disabled={issue.isPending}
                    onClick={() => issue.mutate({ id: row.id })}
                  >
                    {issue.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : row.status === "pending" ? (
                      "Goedkeuren & mailen"
                    ) : (
                      "Nieuwe key mailen"
                    )}
                  </Button>
                ) : null}
                {row.status !== "revoked" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (confirm(`License voor ${row.email} intrekken?`)) {
                        revoke.mutate({ id: row.id });
                      }
                    }}
                  >
                    Intrekken
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!list.isLoading && !visible.length ? (
            <p className="text-sm text-muted-foreground">
              {filter === "pending" ? "Geen openstaande aanvragen." : "Nog geen licenses."}
            </p>
          ) : null}
          {issue.isError ? (
            <p className="text-sm text-destructive">{issue.error.message || "Uitgeven mislukt"}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
