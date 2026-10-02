"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@digitify/ui/src/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@digitify/ui/src/components/card";
import { Input } from "@digitify/ui/src/components/input";
import { Label } from "@digitify/ui/src/components/label";
import { Loader2 } from "lucide-react";
import { AuthLogo } from "@/components/auth/auth-logo";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondStep, setSecondStep] = useState(false);
  const [code, setCode] = useState("");
  const [method, setMethod] = useState("totp");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!secondStep) {
        const response = await fetch("/api/auth/login-start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), password }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message);
        setPassword("");
        if (payload.requiresTwoFactor) { setSecondStep(true); return; }
      }
      const result = await signIn("credentials", { code, method, redirect: false });
      if (!result || result.error) throw new Error(secondStep ? "Code ongeldig, gebruikt of controle verlopen. Gebruik een nieuwe code of begin opnieuw." : "Inloggen mislukt. Begin opnieuw.");
      router.push("/dashboard"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Inloggen niet beschikbaar."); }
    finally { setLoading(false); setCode(""); }
  }

  return (
    <Card className="border-border/60 shadow-2xl shadow-slate-950/10">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4">
          <AuthLogo size="lg" />
        </div>
        <CardTitle className="text-2xl font-bold">Welkom terug</CardTitle>
        <CardDescription>Log in op je Digitify account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!secondStep && <><div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="naam@voorbeeld.be"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Wachtwoord</Label>
              <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                Wachtwoord vergeten?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div></>}
          {secondStep && <div className="space-y-3">
            <Label htmlFor="factor-code">{method === "totp" ? "Authenticatorcode" : "Eenmalige herstelcode"}</Label>
            <p className="text-sm text-muted-foreground">Je wachtwoord is gecontroleerd. Bevestig nu je eigen authenticator.</p>
            <Input id="factor-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" inputMode={method === "totp" ? "numeric" : "text"} maxLength={method === "totp" ? 6 : 80} required autoFocus />
            <Button type="button" variant="outline" onClick={() => { setMethod(method === "totp" ? "recovery" : "totp"); setCode(""); }}>{method === "totp" ? "Gebruik een herstelcode" : "Gebruik authenticator"}</Button>
            <Button type="button" variant="ghost" onClick={() => { setSecondStep(false); setCode(""); setError(""); }}>Begin opnieuw</Button>
          </div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full rounded-full shadow-sm" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {secondStep ? "Controleer code en log in" : "Inloggen"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Authenticator kwijt en geen herstelcodes? Vraag gecontroleerd platformherstel.
            <Link href="/two-factor-recovery" className="block underline">Herstel met ontvangen herstelvergunning</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
