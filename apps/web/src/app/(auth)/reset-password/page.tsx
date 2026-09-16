"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@digitify/ui";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLogo } from "@/components/auth/auth-logo";
import { trpc } from "@/lib/trpc/client";
import { formatTrpcErrorMessage } from "@/lib/trpc/format-error";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const resetPassword = trpc.passwordReset.confirm.useMutation({
    onSuccess: (result) => setMessage(result.message),
  });

  if (message && resetPassword.data?.success) {
    return (
      <Card className="border-border/60 shadow-2xl shadow-slate-950/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle>Wachtwoord gewijzigd</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
            Naar login
          </Link>
        </CardContent>
      </Card>
    );
  }

  const mismatch = confirmation.length > 0 && password !== confirmation;

  return (
    <Card className="border-border/60 shadow-2xl shadow-slate-950/10">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4">
          <AuthLogo size="lg" />
        </div>
        <CardTitle className="text-2xl font-bold">Nieuw wachtwoord</CardTitle>
        <CardDescription>Kies een sterk wachtwoord van minstens 10 tekens.</CardDescription>
      </CardHeader>
      <CardContent>
        {!token && <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">Deze resetlink ontbreekt.</p>}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!token || mismatch) return;
            resetPassword.mutate({ token, newPassword: password });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="new-password">Nieuw wachtwoord</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Herhaal wachtwoord</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
          </div>
          {mismatch && <p className="text-sm text-destructive">De wachtwoorden komen niet overeen.</p>}
          {resetPassword.isError && (
            <p className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {formatTrpcErrorMessage(resetPassword.error.message)}
            </p>
          )}
          {resetPassword.data && !resetPassword.data.success && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{resetPassword.data.message}</p>
          )}
          <Button type="submit" className="w-full rounded-full shadow-sm" disabled={!token || mismatch || resetPassword.isPending}>
            {resetPassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Wachtwoord opslaan
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
