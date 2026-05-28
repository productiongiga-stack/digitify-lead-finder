"use client";

import { useMemo } from "react";
import { PASSWORD_REQUIREMENTS } from "@digitify/api/src/lib/password-policy";
import { cn } from "@/lib/utils";
import { Check, Circle, ShieldCheck, X } from "lucide-react";

type PasswordRulesPanelProps = {
  password?: string;
  className?: string;
};

type RuleItem = {
  id: string;
  label: string;
  satisfied: boolean;
  active: boolean;
};

export function PasswordRulesPanel({ password = "", className }: PasswordRulesPanelProps) {
  const rules = useMemo<RuleItem[]>(() => {
    const value = password;
    const hasInput = value.length > 0;

    return [
      {
        id: "length",
        label: `Minimaal ${PASSWORD_REQUIREMENTS.minLength} tekens`,
        satisfied: value.length >= PASSWORD_REQUIREMENTS.minLength,
        active: hasInput,
      },
      {
        id: "lower",
        label: "Minimaal één kleine letter (a–z)",
        satisfied: /[a-z]/.test(value),
        active: hasInput,
      },
      {
        id: "upper",
        label: "Minimaal één hoofdletter (A–Z)",
        satisfied: /[A-Z]/.test(value),
        active: hasInput,
      },
      {
        id: "digit",
        label: "Minimaal één cijfer (0–9)",
        satisfied: /[0-9]/.test(value),
        active: hasInput,
      },
    ];
  }, [password]);

  const satisfiedCount = rules.filter((rule) => rule.satisfied).length;

  return (
    <div className={cn("password-rules-panel", className)}>
      <div className="password-rules-panel-header">
        <span className="password-rules-panel-icon" aria-hidden>
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Wachtwoordregels</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {password.length > 0
              ? `${satisfiedCount} van ${rules.length} vereisten gehaald`
              : "Je nieuwe wachtwoord moet voldoen aan:"}
          </p>
        </div>
      </div>

      <ul className="password-rules-panel-list">
        {rules.map((rule) => (
          <li key={rule.id} className="password-rules-panel-item">
            <span
              className={cn(
                "password-rules-panel-marker",
                !rule.active && "password-rules-panel-marker-idle",
                rule.active && rule.satisfied && "password-rules-panel-marker-ok",
                rule.active && !rule.satisfied && "password-rules-panel-marker-fail",
              )}
              aria-hidden
            >
              {!rule.active ? (
                <Circle className="h-3.5 w-3.5" />
              ) : rule.satisfied ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              )}
            </span>
            <span
              className={cn(
                "text-sm leading-snug",
                rule.active && rule.satisfied && "text-foreground",
                rule.active && !rule.satisfied && "text-foreground",
                !rule.active && "text-muted-foreground",
              )}
            >
              {rule.label}
            </span>
          </li>
        ))}
      </ul>

      <p className="password-rules-panel-footnote">
        Veelgebruikte wachtwoorden zoals{" "}
        <code className="password-rules-panel-code">admin123</code> worden geweigerd.
      </p>
    </div>
  );
}
