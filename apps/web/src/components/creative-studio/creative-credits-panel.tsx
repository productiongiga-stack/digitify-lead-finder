"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Input, Label } from "@digitify/ui";
import { trpc } from "@/lib/trpc/client";
export function CreativeCreditsPanel() {
  const wallet = trpc.media.getCreativeCredits.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const checkout = trpc.media.createCreativeCheckout.useMutation({
    onSuccess: ({ url }) => {
      if (url) window.location.assign(url);
    },
  });
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Mijn credits</h2>
      <Link className="text-sm underline" href="/creative-studio?tab=pricing">
        Prijzen beheren (Digitify)
      </Link>
      <p>
        {wallet.data?.available ?? 0} beschikbaar · {wallet.data?.reserved ?? 0}{" "}
        gereserveerd
      </p>
      <p className="text-sm text-amber-700">
        ! Testbetalingen: er wordt geen echt geld geïnd.
      </p>
      {!wallet.data?.checkoutReady && (
        <p className="text-sm">
          Digitify moet Stripe-testbetalingen nog instellen.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {wallet.data?.bundles.map((bundle) => (
          <div className="space-y-3 rounded-xl border p-4" key={bundle.id}>
            <h3>{bundle.name}</h3>
            <p>
              {bundle.credits} credits · €{(bundle.priceCents / 100).toFixed(2)}
            </p>
            <Button
              disabled={
                !wallet.data?.checkoutReady ||
                !wallet.data.enabled ||
                checkout.isPending
              }
              onClick={() =>
                checkout.mutate({
                  bundleId: bundle.id,
                  requestKey: crypto.randomUUID(),
                })
              }
            >
              Koop testbundel
            </Button>
          </div>
        ))}
      </div>
      {checkout.error && (
        <p role="alert" className="text-destructive">
          {checkout.error.message}
        </p>
      )}
      <details>
        <summary className="cursor-pointer">Transacties</summary>
        <ul className="mt-3 space-y-2">
          {wallet.data?.ledger.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 text-sm">
              <span>
                {new Date(row.createdAt).toLocaleString("nl-BE")} ·{" "}
                {(
                  {
                    PURCHASE: "Aankoop",
                    RESERVE: "Reservering",
                    CHARGE: "Verbruik",
                    RELEASE: "Teruggave",
                  } as Record<string, string>
                )[row.kind] || row.kind}
              </span>
              <span>{row.amount} credits</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
export function CreativePricingAdmin() {
  const pricing = trpc.media.getCreativePricing.useQuery(undefined, {
    retry: false,
  });
  const models = trpc.media.listModels.useQuery();
  const utils = trpc.useUtils();
  const price = trpc.media.saveCreativePrice.useMutation({
    onSuccess: () => utils.media.getCreativePricing.invalidate(),
  });
  const bundle = trpc.media.saveCreativeBundle.useMutation({
    onSuccess: () => utils.media.getCreativePricing.invalidate(),
  });
  const [model, setModel] = useState("");
  const [credits, setCredits] = useState("1");
  const [resolution, setResolution] = useState("");
  const [quality, setQuality] = useState("");
  const [duration, setDuration] = useState("");
  const [ratio, setRatio] = useState("");
  const [name, setName] = useState("");
  const [bundleCredits, setBundleCredits] = useState("");
  const [eur, setEur] = useState("");
  if (!pricing.data) return <p>{pricing.error?.message || "Beheer laden…"}</p>;
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Creditprijzen beheren</h2>
      <p className="text-sm">
        Elke model- en instellingencombinatie krijgt een vaste prijs. Verkoop
        blijft in testmodus.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          price.mutate({
            model,
            settings: {
              resolution: resolution || undefined,
              quality: quality || undefined,
              duration: duration ? Number(duration) : undefined,
              aspectRatio: ratio || undefined,
            },
            credits: Number(credits),
            enabled: true,
          });
        }}
      >
        <Label>
          Model
          <select
            required
            className="mt-1 w-full rounded border bg-background p-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">Kies model</option>
            {models.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Label>
        {[
          ["Resolutie", resolution, setResolution],
          ["Kwaliteit", quality, setQuality],
          ["Duur in seconden", duration, setDuration],
          ["Beeldverhouding", ratio, setRatio],
          ["Credits", credits, setCredits],
        ].map(([label, value, set]) => (
          <Label key={String(label)}>
            {String(label)}
            <Input
              value={String(value)}
              onChange={(e) => (set as (value: string) => void)(e.target.value)}
            />
          </Label>
        ))}
        <Button disabled={price.isPending}>Prijs opslaan</Button>
      </form>
      <div className="space-y-2">
        {pricing.data.prices.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>
              {row.model} · {JSON.stringify(row.settings)} · {row.credits}{" "}
              credits
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                price.mutate({
                  model: row.model,
                  settings: row.settings as {
                    resolution?: string;
                    quality?: string;
                    duration?: number;
                    aspectRatio?: string;
                  },
                  credits: row.credits,
                  enabled: !row.enabled,
                })
              }
            >
              {row.enabled ? "Uitschakelen" : "Activeren"}
            </Button>
          </div>
        ))}
      </div>
      <h3 className="font-semibold">Bundels</h3>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          bundle.mutate({
            name,
            credits: Number(bundleCredits),
            priceCents: Math.round(Number(eur) * 100),
            enabled: true,
          });
        }}
      >
        <Label>
          Naam
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Label>
        <Label>
          Credits
          <Input
            required
            type="number"
            min="1"
            value={bundleCredits}
            onChange={(e) => setBundleCredits(e.target.value)}
          />
        </Label>
        <Label>
          Prijs in euro
          <Input
            required
            type="number"
            min="0.50"
            step="0.01"
            value={eur}
            onChange={(e) => setEur(e.target.value)}
          />
        </Label>
        <Button disabled={bundle.isPending}>Bundel toevoegen</Button>
      </form>
      {pricing.data.bundles.map((row) => (
        <div key={row.id} className="flex items-center justify-between">
          <span>
            {row.name} · {row.credits} credits · €
            {(row.priceCents / 100).toFixed(2)}
          </span>
          <Button
            variant="outline"
            onClick={() =>
              bundle.mutate({
                id: row.id,
                name: row.name,
                credits: row.credits,
                priceCents: row.priceCents,
                enabled: !row.enabled,
              })
            }
          >
            {row.enabled ? "Uitschakelen" : "Activeren"}
          </Button>
        </div>
      ))}
      {(price.error || bundle.error) && (
        <p role="alert">{price.error?.message || bundle.error?.message}</p>
      )}
    </div>
  );
}
