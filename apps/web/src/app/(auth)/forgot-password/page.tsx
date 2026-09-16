"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@digitify/ui";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLogo } from "@/components/auth/auth-logo";
import { trpc } from "@/lib/trpc/client";
import { formatTrpcErrorMessage } from "@/lib/trpc/format-error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const requestReset = trpc.passwordReset.request.useMutation();

  if (requestReset.isSuccess) {
    return (
      <Card className="border-border/60 shadow-2xl shadow-slate-950/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle>Controleer je inbox</CardTitle>
          <CardDescription>
            Als er een account met dit e-mailadres bestaat, ontvang je instructies om je wachtwoord te wijzigen.
          </CardDescription>
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
        <CardTitle className="text-2xl font-bold">Wachtwoord resetten</CardTitle>
        <CardDescription>Vul je e-mailadres in. We sturen je een eenmalige resetlink.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            requestReset.mutate({ email });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="reset-email">E-mail</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="naam@voorbeeld.be"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>
          {requestReset.isError && (
            <p className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {formatTrpcErrorMessage(requestReset.error.message)}
            </p>
          )}
          <Button type="submit" className="w-full rounded-full shadow-sm" disabled={requestReset.isPending}>
            {requestReset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resetlink versturen
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Terug naar login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
