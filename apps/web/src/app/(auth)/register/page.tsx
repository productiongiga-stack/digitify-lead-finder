"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea } from "@digitify/ui";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLogo } from "@/components/auth/auth-logo";
import { formatTrpcErrorMessage } from "@/lib/trpc/format-error";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestAccess = trpc.registration.requestAccess.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <Card className="border-border/60 shadow-2xl shadow-slate-950/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle>Check je inbox</CardTitle>
          <CardDescription>We hebben een verificatielink gestuurd. Na bevestiging kan een admin je aanvraag goedkeuren.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
            Terug naar login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-2xl shadow-slate-950/10">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4">
          <AuthLogo size="lg" />
        </div>
        <CardTitle className="text-2xl font-bold">Toegang aanvragen</CardTitle>
        <CardDescription>Verifieer je e-mail en wacht op goedkeuring van een admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            requestAccess.mutate({ name, email, company, password, message });
          }}
        >
          <div className="space-y-2">
            <Label>Naam</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Bedrijf</Label>
            <Input value={company} onChange={(event) => setCompany(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Wachtwoord</Label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label>Waarom wil je toegang?</Label>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} />
          </div>
          {requestAccess.isError && (
            <p className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {formatTrpcErrorMessage(requestAccess.error.message)}
            </p>
          )}
          <Button className="w-full rounded-full shadow-sm" disabled={requestAccess.isPending}>
            {requestAccess.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aanvraag versturen
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Al toegang?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
