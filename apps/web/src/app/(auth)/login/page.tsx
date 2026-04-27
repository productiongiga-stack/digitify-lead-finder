"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@digitify/ui";
import { Input } from "@digitify/ui";
import { Label } from "@digitify/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@digitify/ui";
import { Loader2 } from "lucide-react";
import { AuthLogo } from "@/components/auth/auth-logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Ongeldige inloggegevens");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <Card className="border-0 shadow-2xl">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4">
          <AuthLogo size="lg" />
        </div>
        <CardTitle className="text-2xl font-bold">Welkom terug</CardTitle>
        <CardDescription>Log in op je Digitify account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="naam@voorbeeld.be"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full bg-[#f9ae5a] text-[#14100b] hover:bg-[#eca04e]" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Inloggen
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Neem contact op met je beheerder als je geen toegang hebt.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
