import type { FormEvent } from "react";
import { isValidEmail } from "@/lib/quote-configurator-utils";

type SubmitStatus = { type: "success" | "error"; message: string } | null;

export function QuoteDetailsStep({
  title,
  hint,
  ctaLabel,
  firstName,
  lastName,
  email,
  phone,
  company,
  address,
  vatNumber,
  remarks,
  status,
  submitting,
  isInternalMode,
  isLivePreview,
  canSubmit,
  accentColor,
  darkColor,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onPhoneChange,
  onCompanyChange,
  onAddressChange,
  onVatNumberChange,
  onRemarksChange,
  onBack,
  onSubmit,
}: {
  title: string;
  hint: string;
  ctaLabel: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  vatNumber: string;
  remarks: string;
  status: SubmitStatus;
  submitting: boolean;
  isInternalMode: boolean;
  isLivePreview: boolean;
  canSubmit: boolean;
  accentColor: string;
  darkColor: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onVatNumberChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4 sm:space-y-5" onSubmit={onSubmit}>
      <div>
        <h2
          className="text-[22px] font-black leading-tight tracking-tight sm:text-[27px] lg:text-[32px]"
          style={{ color: darkColor }}
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-[#6e747e]">{hint}</p>
      </div>

      <div className="rounded-[12px] border border-[#ece1c6] bg-[#f8f4e8] px-3 py-2 text-sm text-[#7c6a42]">
        Bijna klaar! Vul uw gegevens in om de gepersonaliseerde offerte te ontvangen.
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Voornaam *</label>
          <input
            value={firstName}
            onChange={(event) => onFirstNameChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10"
            required={!isInternalMode}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">
            Achternaam {isInternalMode ? "" : "*"}
          </label>
          <input
            value={lastName}
            onChange={(event) => onLastNameChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10"
            required={!isInternalMode}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">E-mailadres *</label>
          <input
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10"
            type="email"
            required
          />
          {email && !isValidEmail(email) ? <p className="mt-1 text-xs text-red-600">Ongeldig e-mailadres.</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Telefoonnummer</label>
          <input
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Bedrijfsnaam</label>
          <input
            value={company}
            onChange={(event) => onCompanyChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">Adres</label>
          <input
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">BTW-nummer</label>
          <input
            value={vatNumber}
            onChange={(event) => onVatNumberChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-[#d8dbe2] px-3 text-sm sm:h-10"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#646b76]">
            Bijkomende opmerkingen
          </label>
          <textarea
            value={remarks}
            onChange={(event) => onRemarksChange(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[#d8dbe2] px-3 py-2 text-sm"
          />
        </div>
      </div>

      {status ? (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            status.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border px-3 py-2 text-xs text-[#616671] sm:px-4 sm:text-sm"
        >
          Terug
        </button>
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-[#15171c] disabled:opacity-50 sm:px-4 sm:text-sm"
          style={{ backgroundColor: accentColor }}
        >
          {isLivePreview ? "Preview (niet versturen)" : submitting ? "Bezig..." : ctaLabel}
        </button>
      </div>
    </form>
  );
}
