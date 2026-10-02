"use client";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@digitify/ui";
import Link from "next/link";

type Status = { enabled: boolean; recoveryCodesRemaining: number };
export function TwoFactorSettings({ recovery = false }: { recovery?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState(""), [code, setCode] = useState(""), [method, setMethod] = useState("totp");
  const [email, setEmail] = useState(""), [grant, setGrant] = useState("");
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null), [qr, setQr] = useState("");
  const [codes, setCodes] = useState<string[]>([]), [proof, setProof] = useState(""), [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (recovery) return;
    let active = true;
    fetch("/api/two-factor/status", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error("Status niet beschikbaar."); return r.json(); }).then((value) => { if (active) setStatus(value); }).catch(() => { if (active) setError("Beveiligingsstatus niet beschikbaar. Probeer later opnieuw."); });
    return () => { active = false; };
  }, [recovery]);
  useEffect(() => {
    let active = true;
    if (setup) import("qrcode").then((module) => module.default.toDataURL(setup.uri, { width: 240, margin: 2 })).then((url) => { if (active) setQr(url); }).catch(() => { if (active) setError("QR-code niet beschikbaar. Gebruik de handmatige sleutel."); });
    return () => { active = false; };
  }, [setup]);
  async function action(actionName: string) {
    setBusy(true); setError("");
    try {
      const path = recovery ? "/api/two-factor/recovery/" : "/api/two-factor/";
      const body = recovery ? { email, password, grant, code, proof, saved } : { password, code, method, proof, saved };
      const response = await fetch(path + actionName, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      if (actionName === "setup" || actionName === "begin") { setSetup(result); setPassword(""); setCode(""); setGrant(""); }
      if (actionName === "verify" || actionName === "regenerate") { setCodes(result.codes); setProof(result.proof ?? ""); setSaved(false); setSetup(null); setQr(""); setPassword(""); setCode(""); }
      if (actionName === "disable" || actionName === "confirm") await signOut({ callbackUrl: "/login" });
    } catch (err) { setError(err instanceof Error ? err.message : "Beveiligingscontrole mislukt."); }
    finally { setBusy(false); }
  }
  return <Card className="lg:col-span-2"><CardHeader><CardTitle>Authenticator · tweestapsverificatie</CardTitle></CardHeader><CardContent className="space-y-5">
    <p className="text-sm text-muted-foreground">Beveilig je persoonlijke account met Google Authenticator, Microsoft Authenticator of een andere TOTP-app. Beschikbaar voor iedere rol. Bewaar herstelcodes offline; elke code werkt één keer.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!setup && !codes.length && <div className="max-w-xl space-y-4">
      {!recovery && <p className={status?.enabled ? "text-green-700" : "text-amber-700"}>{status ? status.enabled ? `Actief · ${status.recoveryCodesRemaining} herstelcodes beschikbaar` : "Nog niet ingesteld — je account mist extra beveiliging." : "Beveiligingsstatus wordt gecontroleerd…"}</p>}
      {recovery && <><p className="text-sm">Alleen met een afzonderlijk verkregen herstelvergunning na identiteitcontrole. Dit geeft geen toegang tot de app; je moet eerst een nieuwe authenticator bevestigen. De vergunning is eenmalig en 24 uur geldig.</p><Label htmlFor="recovery-email">E-mail</Label><Input id="recovery-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /><Label htmlFor="recovery-grant">Herstelvergunning</Label><Input id="recovery-grant" type="password" value={grant} onChange={(e) => setGrant(e.target.value)} autoComplete="off" /></>}
      <Label htmlFor="factor-password">Huidig wachtwoord</Label><Input id="factor-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {status?.enabled && <><Label htmlFor="existing-factor">{method === "totp" ? "Huidige authenticatorcode" : "Eenmalige herstelcode"}</Label><Input id="existing-factor" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /><Button type="button" variant="ghost" onClick={() => { setMethod(method === "totp" ? "recovery" : "totp"); setCode(""); }}>{method === "totp" ? "Gebruik herstelcode" : "Gebruik authenticator"}</Button></>}
      <div className="flex flex-wrap gap-3"><Button disabled={busy || (!status && !recovery) || !password || (recovery && (!email || !grant)) || (!!status?.enabled && !code)} onClick={() => action(recovery ? "begin" : "setup")}>{recovery ? "Start gecontroleerd herstel" : status?.enabled ? "Authenticator vervangen" : "Authenticator instellen"}</Button>
      {status?.enabled && <><Button variant="outline" disabled={busy || !password || !code} onClick={() => action("regenerate")}>Herstelcodes vernieuwen</Button><Button variant="destructive" disabled={busy || !password || !code} onClick={() => { if (window.confirm("Tweestapsverificatie uitschakelen? Je account verliest de extra beveiliging en alle sessies worden ingetrokken.")) void action("disable"); }}>2FA uitschakelen</Button></>}</div>
    </div>}
    {setup && <div className="max-w-xl space-y-4"><p>Stap 1 · Scan deze QR-code in je authenticator-app. De sleutel blijft alleen op je eigen scherm.</p>{qr && <img src={qr} width={240} height={240} alt="QR-code om je eigen authenticator in te stellen" />}
      <details><summary className="cursor-pointer">Handmatige sleutel</summary><p className="mt-2 break-all rounded bg-muted p-3 font-mono">{setup.secret}</p><p className="text-xs">TOTP · 6 cijfers · SHA-1 · iedere 30 seconden</p></details>
      <Label htmlFor="new-factor-code">Stap 2 · Code uit de nieuwe authenticator</Label><Input id="new-factor-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} /><Button disabled={busy || !/^\d{6}$/.test(code)} onClick={() => action("verify")}>Controleer authenticator</Button><p className="text-xs text-muted-foreground">Binnen 20 minuten afronden. Een bestaande authenticator blijft actief tot de laatste bevestiging.</p></div>}
    {!!codes.length && <div className="max-w-2xl space-y-4"><p className="font-semibold">Stap 3 · Bewaar deze tien herstelcodes. Je ziet ze slechts één keer.</p><div className="grid gap-2 rounded-xl border bg-muted p-4 font-mono text-xs sm:grid-cols-2">{codes.map((value) => <p key={value} className="break-all">{value}</p>)}</div>
      <Label className="flex items-center gap-3"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />Ik heb mijn herstelcodes veilig opgeslagen.</Label>
      <Button disabled={busy || !saved} onClick={() => proof ? action("confirm") : signOut({ callbackUrl: "/login" })}>{proof ? "Activeer authenticator en log opnieuw in" : "Afronden en opnieuw inloggen"}</Button>
    </div>}
    <p className="text-xs text-muted-foreground">Beveiligingswijzigingen trekken alle bestaande sessies in. Geen herstelcodes meer? Alleen gecontroleerd herstel door de platformoperator; workspacebeheerders kunnen je 2FA niet resetten.</p>
    {recovery && <Link className="text-sm underline" href="/login">Terug naar inloggen</Link>}
  </CardContent></Card>;
}
