import { isImageIcon, formatCurrency } from "@/lib/quote-configurator-utils";

type StudioViewport = "desktop" | "tablet" | "mobile";
type EmbedMode = "simple" | "advanced";
type PublishState = "draft" | "published";

type StudioActionPayload = Record<string, unknown>;

export type QuoteCartSummaryItem = {
  cartKey: string;
  source: "product" | "option" | "slider";
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  packageLabel: string;
  isConfirmed?: boolean;
};

export function ConfiguratorIcon({ value, label }: { value: string; label: string }) {
  if (isImageIcon(value)) {
    return <img src={value} alt={label} className="h-full w-full rounded-lg object-cover" />;
  }

  return <span aria-hidden="true">{value}</span>;
}

export function QuoteEmbedHeader({
  companyName,
  companyTagline,
  logoUrl,
  currentStep,
  accentColor,
  darkColor,
}: {
  companyName: string;
  companyTagline: string;
  logoUrl: string;
  currentStep: number;
  accentColor: string;
  darkColor: string;
}) {
  return (
    <header
      className="px-3 py-2 text-white sm:px-5"
      style={{ background: `linear-gradient(135deg, ${darkColor} 0%, #1f2228 100%)` }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-8 w-auto rounded" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: accentColor }}
            >
              ▶
            </div>
          )}
          <div>
            <p className="text-base font-semibold leading-none">{companyName}</p>
            <p className="mt-1 text-xs text-white/60">{companyTagline}</p>
          </div>
        </div>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: accentColor, color: darkColor }}
        >
          {currentStep}
        </div>
      </div>
    </header>
  );
}

export function QuoteStudioBar({
  currentStep,
  selectedCategory,
  selectedProductId,
  embedMode,
  viewport,
  syncBuilderWithPreview,
  canUndo,
  canRedo,
  hasUnpublishedChanges,
  publishState,
  accentColor,
  darkColor,
  sendPreviewAction,
}: {
  currentStep: number;
  selectedCategory: string;
  selectedProductId: string;
  embedMode: EmbedMode;
  viewport?: StudioViewport;
  syncBuilderWithPreview?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  hasUnpublishedChanges?: boolean;
  publishState?: PublishState;
  accentColor: string;
  darkColor: string;
  sendPreviewAction: (payload: StudioActionPayload) => void;
}) {
  const modeButtonStyle = (mode: EmbedMode) => ({
    borderColor: embedMode === mode ? accentColor : "#d6d1c2",
    backgroundColor: embedMode === mode ? `${accentColor}2a` : "#fff",
  });

  const viewportButtonStyle = (target: StudioViewport) => ({
    borderColor: viewport === target ? accentColor : "#d6d1c2",
    backgroundColor: viewport === target ? `${accentColor}2a` : "#fff",
  });

  return (
    <div className="border-b border-[#e4dcc8] bg-[#f6f0df] px-3 py-2 text-[11px] text-[#5d5648] sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Studio</span>
        <span>Stap {currentStep}</span>
        <span>•</span>
        <span>{selectedCategory || "Geen categorie"}</span>
        <span>•</span>
        <span>{selectedProductId || "Geen product"}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => sendPreviewAction({ action: "set-mode", mode: "simple" })}
          className="rounded-md border px-2 py-1 text-[11px]"
          style={modeButtonStyle("simple")}
        >
          Simple
        </button>
        <button
          type="button"
          onClick={() => sendPreviewAction({ action: "set-mode", mode: "advanced" })}
          className="rounded-md border px-2 py-1 text-[11px]"
          style={modeButtonStyle("advanced")}
        >
          Advanced
        </button>
        {(["desktop", "tablet", "mobile"] as const).map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => sendPreviewAction({ action: "set-viewport", viewport: target })}
            className="rounded-md border px-2 py-1 text-[11px]"
            style={viewportButtonStyle(target)}
          >
            {target[0].toUpperCase()}
            {target.slice(1)}
          </button>
        ))}
        <label className="ml-1 inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-[11px]">
          <input
            type="checkbox"
            checked={Boolean(syncBuilderWithPreview)}
            onChange={(event) =>
              sendPreviewAction({
                action: "set-sync",
                value: event.target.checked,
              })
            }
          />
          Sync
        </label>
        <button
          type="button"
          onClick={() => sendPreviewAction({ action: "undo" })}
          disabled={!canUndo}
          className="rounded-md border bg-white px-2 py-1 text-[11px] disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => sendPreviewAction({ action: "redo" })}
          disabled={!canRedo}
          className="rounded-md border bg-white px-2 py-1 text-[11px] disabled:opacity-40"
        >
          Redo
        </button>
        <button
          type="button"
          onClick={() => sendPreviewAction({ action: "save-all" })}
          className="rounded-md px-2 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: accentColor, color: darkColor }}
        >
          {hasUnpublishedChanges ? "Publiceer" : "Gepubliceerd"}
        </button>
        <button
          type="button"
          onClick={() => sendPreviewAction({ action: "restore-published" })}
          className="rounded-md border bg-white px-2 py-1 text-[11px] disabled:opacity-40"
          disabled={!hasUnpublishedChanges}
        >
          Reset Draft
        </button>
        <span className="text-[11px] text-[#6a6152]">
          Status: {publishState === "draft" ? "Draft" : "Live"}
        </span>
      </div>
    </div>
  );
}

export function QuoteStepProgress({
  currentStep,
  stepLabels,
  accentColor,
  darkColor,
}: {
  currentStep: number;
  stepLabels: {
    service: string;
    product: string;
    specs: string;
    details: string;
  };
  accentColor: string;
  darkColor: string;
}) {
  return (
    <div className="border-b border-black/10 bg-[#fbfaf7] px-3 py-2 sm:px-6">
      <div className="grid grid-cols-4 items-center gap-3">
        {[
          { n: 1, label: stepLabels.service },
          { n: 2, label: stepLabels.product },
          { n: 3, label: stepLabels.specs },
          { n: 4, label: stepLabels.details },
        ].map((step, index, array) => {
          const active = currentStep >= step.n;
          const current = currentStep === step.n;

          return (
            <div key={step.n} className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                style={{
                  borderColor: current ? accentColor : "#d5d7dd",
                  backgroundColor: current ? accentColor : active ? darkColor : "#fff",
                  color: current ? darkColor : active ? "#fff" : "#9498a3",
                }}
              >
                {step.n}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold tracking-wide text-[#7a7f88]">{step.label}</div>
                {index < array.length - 1 ? (
                  <div
                    className="mt-1 h-[2px] w-full rounded"
                    style={{ backgroundColor: currentStep > step.n ? accentColor : "#e3e5ea" }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function QuoteSummaryAside({
  cartItems,
  isPreviewRoute,
  confirmedCount,
  isEditingQuote,
  selectedCategory,
  selectedProductName,
  subtotal,
  discount,
  vatRate,
  vatAmount,
  total,
  disclaimer,
  accentColor,
  darkColor,
  onRemoveFromCart,
  onAdjustQuantity,
}: {
  cartItems: QuoteCartSummaryItem[];
  isPreviewRoute: boolean;
  confirmedCount: number;
  isEditingQuote: boolean;
  selectedCategory: string;
  selectedProductName: string;
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  disclaimer: string;
  accentColor: string;
  darkColor: string;
  onRemoveFromCart: (cartKey: string) => void;
  onAdjustQuantity: (cartKey: string, delta: number) => void;
}) {
  return (
    <aside className="min-h-0 overflow-y-auto bg-[#f4f1e8] px-3 py-3 sm:px-4">
      <div className="rounded-[14px] border border-black/10 bg-white shadow-sm">
        <div
          className="rounded-t-[14px] px-3 py-2 text-xs font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${darkColor} 0%, #1f2228 100%)` }}
        >
          Offerte-items ({cartItems.length}) {isPreviewRoute ? "" : `· ${confirmedCount} bevestigd`}
        </div>
        <div className="max-h-[34vh] space-y-1 overflow-auto p-1.5">
          {cartItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-xs text-[#767c87]">
              Nog geen items geselecteerd.
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.cartKey} className="rounded-lg border bg-white px-2 py-1.5">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{item.name}</p>
                    <p className="truncate text-[11px] text-[#7b818c]">
                      {item.packageLabel} · {item.quantity}x
                      {item.source === "product" && !isPreviewRoute && !item.isConfirmed
                        ? " · niet bevestigd"
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(item.cartKey)}
                      className="text-[11px] text-[#8a909b] hover:text-[#272a30]"
                    >
                      ✕
                    </button>
                    <p className="mt-0.5 text-xs font-semibold" style={{ color: "#c9811b" }}>
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-[#7b818c]">
                    {item.quantity > 1 ? `${formatCurrency(item.unitPrice)} / stuk` : formatCurrency(item.unitPrice)}
                  </span>
                  {item.source === "product" || isEditingQuote ? (
                    <div className="flex items-center overflow-hidden rounded-md border">
                      <button type="button" onClick={() => onAdjustQuantity(item.cartKey, -1)} className="h-5 w-6 text-xs">
                        -
                      </button>
                      <span className="min-w-6 border-x px-1 text-center text-[11px]">{item.quantity}</span>
                      <button type="button" onClick={() => onAdjustQuantity(item.cartKey, 1)} className="h-5 w-6 text-xs">
                        +
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs font-semibold">
          <span>Totaal incl. BTW</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="mt-3 rounded-[14px] border border-black/10 bg-white p-3 text-sm">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[#7d838d]">
          <span>Categorie</span>
          <span className="font-semibold text-[#3c4149] normal-case">{selectedCategory || "-"}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-wide text-[#7d838d]">
          <span>Product</span>
          <span className="font-semibold text-[#3c4149] normal-case">{selectedProductName || "-"}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-wide text-[#7d838d]">
          <span>Aantal in cart</span>
          <span className="font-semibold text-[#3c4149]">{cartItems.length}</span>
        </div>
        {!isPreviewRoute ? (
          <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-wide text-[#7d838d]">
            <span>Bevestigd</span>
            <span className="font-semibold text-[#3c4149]">{confirmedCount}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-[14px] border border-black/10 bg-white text-sm">
        <div className="space-y-2 px-3 py-3">
          <div className="flex items-center justify-between">
            <span>Subtotaal excl. BTW</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between text-[#b15f1b]">
              <span>Korting</span>
              <span className="font-semibold">-{formatCurrency(discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span>BTW {vatRate}%</span>
            <span className="font-semibold">{formatCurrency(vatAmount)}</span>
          </div>
        </div>
        <div
          className="px-3 py-3 text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${darkColor} 0%, #1f2228 100%)` }}
        >
          Totaal incl. BTW <span className="float-right" style={{ color: accentColor }}>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="mt-3 rounded-[14px] border border-[#e8dcc4] bg-[#f7f0df] px-3 py-3 text-xs text-[#6f6655]">
        <p className="font-semibold text-[#3f3b33]">Indicatieve prijs - Definitieve offerte op aanvraag</p>
        <p className="mt-1">{disclaimer}</p>
      </div>
    </aside>
  );
}
