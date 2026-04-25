"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getReviewTextDefault } from "@/lib/review-text";

const reviewPlatforms = [
  { key: "googleUrl", label: "Google" },
  { key: "trustpilotUrl", label: "Trustpilot" },
  { key: "facebookUrl", label: "Facebook" },
] as const;

function replaceTextPlaceholders(text: string, context: Record<string, string | number | undefined>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function ReviewEmbedContent() {
  const params = useSearchParams();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"rating" | "platforms" | "feedback">("rating");
  const [selectionLocked, setSelectionLocked] = useState(false);

  const color = params.get("color") || "#f59e0b";
  const title = params.get("title") || "Hoe was uw ervaring?";
  const description =
    params.get("description") ||
    "Geef eerst intern uw score. Bij 4 of 5 sterren kunt u meteen door naar het reviewplatform van uw keuze.";
  const company = params.get("company") || "Onze service";

  const links = reviewPlatforms
    .map((platform) => ({
      label: platform.label,
      url: params.get(platform.key),
    }))
    .filter((platform) => platform.url);

  const visibleRating = hoveredRating || rating;
  const positiveFlow = rating >= 4;
  const needsFeedback = rating > 0 && rating < 4;
  const stepLabel =
    step === "rating"
      ? "Stap 1 van 2"
      : step === "platforms" || step === "feedback"
        ? "Stap 2 van 2"
        : "Afgerond";

  function getText(key: string, context: Record<string, string | number | undefined> = {}) {
    const template = params.get(key) || getReviewTextDefault(key);
    return replaceTextPlaceholders(template, {
      companyName: company,
      platformLabel: context.platformLabel,
      selectedRating: rating || "",
      ...context,
    }).replace(/\s{2,}/g, " ").trim();
  }

  async function saveInternalFeedback(extra?: { platform?: string }) {
    const response = await fetch("/api/public/reviews/embed-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        feedback,
        company,
        platform: extra?.platform,
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Feedback opslaan mislukt.");
    }
  }

  async function handleFeedbackSubmit() {
    if (!needsFeedback) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await saveInternalFeedback();
      setStatus(getText("reviews.embed_feedback_success"));
      setFeedback("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Feedback opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePlatformClick(url: string, platform: string) {
    setSubmitting(true);
    setStatus(null);
    try {
      await saveInternalFeedback({ platform });
      window.open(url, "_blank", "noopener,noreferrer");
      setStatus(getText("reviews.embed_platform_opened", { platformLabel: platform }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reviewflow opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (!rating || submitting || selectionLocked) return;
    setSelectionLocked(true);
    setStatus(null);
    if (rating >= 4) {
      setStep("platforms");
      return;
    }
    setStep("feedback");
  }

  return (
    <div className="min-h-screen bg-[#fffaf2] p-4 text-slate-900">
      <div className="mx-auto max-w-xl rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white" style={{ backgroundColor: color }}>
            ★
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.24em] text-slate-400">{company}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-center">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
              {stepLabel}
            </span>
          </div>
          <p className="text-center text-sm font-medium text-slate-700">{getText("reviews.embed_prompt")}</p>
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: 5 }, (_, index) => {
              const current = index + 1;
              const active = current <= visibleRating;
              return (
                <button
                  key={current}
                  type="button"
                  onMouseEnter={() => setHoveredRating(current)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => {
                    if (selectionLocked) return;
                    setRating(current);
                    setStep("rating");
                    setStatus(null);
                  }}
                  className={`h-12 w-12 rounded-full border text-2xl transition duration-200 ${
                    active ? "scale-110 shadow-md" : "hover:-translate-y-0.5"
                  }`}
                  style={{
                    color: active ? color : "#cbd5e1",
                    borderColor: active ? color : "#e2e8f0",
                    backgroundColor: active ? `${color}14` : "#ffffff",
                  }}
                  aria-label={`${current} sterren`}
                >
                  ★
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-sm text-slate-500">
            {rating === 0
              ? getText("reviews.embed_hint_initial")
              : positiveFlow
                ? getText("reviews.embed_hint_positive")
                : getText("reviews.embed_hint_negative")}
          </p>
          <p className="mt-2 text-center text-xs text-slate-400">
            1 tot 3 sterren: interne feedback. 4 of 5 sterren: publieke review.
          </p>
        </div>

        {step === "rating" && rating > 0 ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-medium text-slate-900">
                {positiveFlow
                  ? getText("reviews.embed_continue_positive_title")
                  : getText("reviews.embed_continue_negative_title")}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {positiveFlow
                  ? getText("reviews.embed_continue_positive_body")
                  : getText("reviews.embed_continue_negative_body")}
              </p>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!rating || submitting}
                className="mt-5 h-12 rounded-full px-6 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: color }}
              >
                {submitting ? "Bezig..." : getText("reviews.embed_continue_button")}
              </button>
            </div>
          </div>
        ) : null}

        {step === "platforms" ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-medium text-slate-900">{getText("reviews.embed_positive_title")}</p>
              <p className="mt-2 text-sm text-slate-600">{getText("reviews.embed_positive_body")}</p>
            </div>
            {links.length > 0 ? (
              links.map((platform) => (
                <button
                  key={platform.label}
                  type="button"
                  onClick={() => void handlePlatformClick(platform.url || "#", platform.label)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left text-sm font-semibold transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span>{platform.label}</span>
                  <span className="rounded-full px-3 py-1 text-xs text-white" style={{ backgroundColor: color }}>
                    {getText("reviews.embed_platform_cta", { platformLabel: platform.label })}
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                {getText("reviews.embed_missing_links")}
              </div>
            )}
          </div>
        ) : null}

        {step === "feedback" && needsFeedback ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-medium text-slate-900">{getText("reviews.embed_feedback_title")}</p>
              <p className="mt-2 text-sm text-slate-600">{getText("reviews.embed_feedback_body")}</p>
            </div>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={4}
              placeholder={getText("reviews.embed_feedback_placeholder")}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
            <button
              type="button"
              onClick={() => void handleFeedbackSubmit()}
              disabled={submitting}
              className="h-12 w-full rounded-full px-5 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              {submitting ? "Bezig..." : getText("reviews.embed_feedback_submit")}
            </button>
          </div>
        ) : null}

        {status ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {status}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewEmbedFallback() {
  return (
    <div className="min-h-screen bg-[#fffaf2] p-4 text-slate-900">
      <div className="mx-auto max-w-xl rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
        <div className="h-8 w-48 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-6 h-40 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function ReviewEmbedPage() {
  return (
    <Suspense fallback={<ReviewEmbedFallback />}>
      <ReviewEmbedContent />
    </Suspense>
  );
}
