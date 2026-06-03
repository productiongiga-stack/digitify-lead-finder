"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { safeExternalUrl } from "@/lib/utils";

type ReviewPayload = {
  id: string;
  clientName: string;
  companyName: string;
  companySlogan?: string;
  primaryColor: string;
  logoUrl: string;
  platform: string;
  platformLabel: string;
  reviewUrl: string;
  leadCompanyName: string;
  status: string;
  rating: number | null;
  feedback: string | null;
  texts: Record<string, string>;
};

type ReviewStep = "rating" | "review-link" | "feedback" | "redirecting" | "done";

export default function PublicReviewPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<ReviewStep>("rating");
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState("");

  useEffect(() => {
    fetch(`/api/public/reviews/${id}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Reviewpagina laden mislukt.");
        }
        setData(payload);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const heading = useMemo(() => {
    if (!data) return "Deel uw ervaring";
    return data.texts["reviews.public_heading"] || `Hoe was uw ervaring met ${data.companyName}?`;
  }, [data]);
  const visibleRating = hoveredRating ?? selectedRating ?? 0;
  const alreadyCompleted = data?.status === "REVIEWED" || data?.status === "FEEDBACK" || step === "done";
  const stepLabel =
    step === "rating"
      ? "Stap 1 van 2"
      : step === "review-link" || step === "feedback"
        ? "Stap 2 van 2"
        : "Afgerond";

  useEffect(() => {
    if (!data) return;
    if (data.status === "REVIEWED") {
      setSelectedRating(data.rating);
      setSelectionLocked(true);
      setStep("done");
      setThankYouMessage(data.texts["reviews.public_completed_message"] || "Bedankt. Deze reviewaanvraag is al afgerond.");
      return;
    }
    if (data.status === "FEEDBACK") {
      setSelectedRating(data.rating);
      setSelectionLocked(true);
      setStep("done");
      setThankYouMessage(data.texts["reviews.public_completed_message"] || "Bedankt. Deze reviewaanvraag is al afgerond.");
    }
  }, [data]);

  async function handleSubmit() {
    if (alreadyCompleted) {
      setError("Deze review is al verwerkt.");
      return;
    }
    if (!selectedRating) {
      setError("Kies eerst een score tussen 1 en 5.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/public/reviews/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: selectedRating,
          feedback,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Verwerken van uw feedback mislukt.");
      }

      if (payload.redirectUrl) {
        const redirectTarget = safeExternalUrl(String(payload.redirectUrl));
        if (!redirectTarget) {
          setThankYouMessage(
            data?.texts["reviews.public_positive_done"] || "Bedankt voor uw beoordeling. Deze aanvraag is afgerond.",
          );
          setStep("done");
          return;
        }
        setThankYouMessage(data?.texts["reviews.public_redirect_message"] || `Bedankt. U wordt nu doorgestuurd naar ${data?.platformLabel}.`);
        setStep("redirecting");
        window.setTimeout(() => {
          window.location.href = redirectTarget;
        }, 1200);
        return;
      }

      setThankYouMessage(
        selectedRating && selectedRating >= 4
          ? data?.texts["reviews.public_positive_done"] || "Bedankt voor uw beoordeling. Deze aanvraag is afgerond."
          : data?.texts["reviews.public_feedback_success"] || "Bedankt voor uw feedback. We nemen dit intern op en komen indien nodig bij u terug."
      );
      setStep("done");
      setFeedback("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Er ging iets mis.";
      if (message.toLowerCase().includes("al afgerond") || message.toLowerCase().includes("al ingestuurd")) {
        setSelectionLocked(true);
        setStep("done");
        setThankYouMessage(data?.texts["reviews.public_completed_message"] || "Bedankt. Deze reviewaanvraag is al afgerond.");
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (!selectedRating || alreadyCompleted || selectionLocked) {
      if (!selectedRating) setError("Kies eerst een score tussen 1 en 5.");
      return;
    }

    setSelectionLocked(true);
    setError("");

    if (selectedRating >= 4) {
      setStep("review-link");
      return;
    }

    setStep("feedback");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f3ec] px-6 text-slate-900">
        <div className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          <p className="text-sm text-slate-500">Reviewpagina laden...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f3ec] px-6 text-slate-900">
        <div className="w-full max-w-xl rounded-[32px] border border-red-200 bg-white p-10 text-center shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
          <h1 className="text-xl font-semibold">Reviewpagina niet beschikbaar</h1>
          <p className="mt-3 text-sm text-slate-500">{error || "Dit reviewverzoek bestaat niet meer."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_38%),linear-gradient(180deg,_#f7f4ee_0%,_#fffdf8_100%)] px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_30px_120px_rgba(15,23,42,0.12)] sm:p-8">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt={data.companyName} className="h-12 w-12 rounded-2xl object-contain" />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
              style={{ backgroundColor: data.primaryColor }}
            >
              {data.companyName.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {data.texts["reviews.public_badge"] || "Klantfeedback"}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
            {data.companySlogan ? (
              <p className="mt-2 text-sm text-slate-500">{data.companySlogan}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-[#fcfaf5] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-center">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
              {stepLabel}
            </span>
          </div>
          <p className="text-center text-sm leading-7 text-slate-600">
            {data.texts["reviews.public_intro"] || `Hallo ${data.clientName}, bedankt voor de samenwerking met ${data.companyName}.`}
          </p>

          {alreadyCompleted ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {thankYouMessage || "Deze review is al verwerkt. Bedankt voor uw feedback."}
            </div>
          ) : null}

          {step === "rating" && !alreadyCompleted ? (
            <>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onMouseEnter={() => setHoveredRating(rating)}
                    onMouseLeave={() => setHoveredRating(null)}
                    onClick={() => {
                      if (alreadyCompleted || selectionLocked) return;
                      setSelectedRating(rating);
                      if (rating >= 4) setFeedback("");
                    }}
                    disabled={alreadyCompleted || selectionLocked}
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-xl font-semibold transition hover:-translate-y-0.5 ${
                      rating <= visibleRating
                        ? "border-transparent text-white shadow-lg"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
                    }`}
                    style={rating <= visibleRating ? { backgroundColor: data.primaryColor } : undefined}
                    aria-label={`${rating} sterren`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">
                1 tot 3 sterren: interne feedback. 4 of 5 sterren: publieke review.
              </p>

              {selectedRating !== null ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-center">
                  <p className="text-sm font-medium text-slate-900">
                    {selectedRating >= 4
                      ? data.texts["reviews.public_continue_positive_title"] || "U koos een positieve score."
                      : data.texts["reviews.public_continue_negative_title"] || "U koos een lagere score."}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedRating >= 4
                      ? data.texts["reviews.public_continue_positive_body"] || "Klik op doorgaan om naar de laatste stap te gaan en daarna uw publieke review te plaatsen."
                      : data.texts["reviews.public_continue_negative_body"] || "Klik op doorgaan om naar het interne feedbackformulier te gaan."}
                  </p>
                  <button
                    type="button"
                    disabled={!selectedRating || submitting}
                    onClick={handleContinue}
                    className="mt-5 h-12 rounded-full px-6 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: data.primaryColor }}
                  >
                    {submitting ? "Bezig..." : data.texts["reviews.public_continue_button"] || "Doorgaan"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {step === "review-link" && !alreadyCompleted ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-medium text-slate-900">
                {data.texts["reviews.public_positive_title"] || "Bedankt voor uw positieve score."}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {data.texts["reviews.public_positive_body"] || "Klik hieronder om uw beoordeling definitief te verzenden en door te gaan naar de publieke reviewpagina."}
              </p>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="mt-5 h-12 rounded-full px-6 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: data.primaryColor }}
              >
                {submitting ? "Bezig..." : data.texts["reviews.public_positive_cta"] || `Plaats review op ${data.platformLabel}`}
              </button>
            </div>
          ) : null}

          {step === "feedback" && !alreadyCompleted ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-medium text-slate-900">
                {data.texts["reviews.public_feedback_title"] || "Bedankt voor uw eerlijkheid."}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {data.texts["reviews.public_feedback_body"] || "Geef kort mee wat beter kon. Deze feedback blijft intern en wordt niet publiek geplaatst."}
              </p>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                disabled={alreadyCompleted || submitting}
                rows={5}
                className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder={data.texts["reviews.public_feedback_placeholder"] || "Wat kunnen we verbeteren?"}
              />
              <button
                type="button"
                disabled={alreadyCompleted || submitting || feedback.trim().length < 5}
                onClick={() => void handleSubmit()}
                className="mt-5 h-12 w-full rounded-full px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: data.primaryColor }}
              >
                {submitting ? "Bezig..." : data.texts["reviews.public_feedback_submit"] || "Feedback verzenden"}
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          {step === "done" && thankYouMessage ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {thankYouMessage}
            </div>
          ) : null}

          {step === "redirecting" && thankYouMessage ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {thankYouMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
