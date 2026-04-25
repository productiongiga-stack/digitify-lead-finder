"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@digitify/ui";
import { Zap } from "lucide-react";

export default function RegisterPage() {
  return (
    <Card className="border-0 shadow-2xl">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Zap className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold">Registratie</CardTitle>
        <CardDescription>
          Neem contact op met de beheerder om een account aan te vragen
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          Terug naar inloggen
        </Link>
      </CardContent>
    </Card>
  );
}
