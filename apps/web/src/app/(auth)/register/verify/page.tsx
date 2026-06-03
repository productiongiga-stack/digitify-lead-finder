"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@digitify/ui";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

function VerifyRegistrationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const verify = trpc.registration.verifyEmail.useMutation();
  const started = useRef(false);
  const missingToken = !token.trim();

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    verify.mutate({ token });
  }, [token, verify]);

  return (
    <Card className="border-0 shadow-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#f9ae5a] text-[#14100b]">
          {missingToken || verify.isError ? (
            <XCircle className="h-6 w-6" />
          ) : verify.isSuccess ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin" />
          )}
        </div>
        <CardTitle>{missingToken || verify.isError ? "Verificatie mislukt" : verify.isSuccess ? "E-mail bevestigd" : "E-mail verifiëren"}</CardTitle>
        <CardDescription>
          {missingToken
            ? "Deze verificatielink mist een token."
            : verify.isError
            ? verify.error.message
            : verify.isSuccess
              ? "Je aanvraag staat klaar voor goedkeuring door een admin."
              : "We controleren je verificatielink."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button asChild>
          <Link href="/login">Naar login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VerifyRegistrationPage() {
  return (
    <Suspense fallback={<Card className="border-0 shadow-2xl"><CardHeader className="text-center"><CardTitle>E-mail verifiëren</CardTitle><CardDescription>Even geduld.</CardDescription></CardHeader></Card>}>
      <VerifyRegistrationContent />
    </Suspense>
  );
}
