import { Card, CardContent } from "@digitify/ui";
import { ArrowRight, CheckCircle, Mail, Route, Send } from "lucide-react";

type OutboundWorkflowHelpProps = {
  variant?: "compact" | "full";
  className?: string;
};

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: "Concept",
    description: "Opstellen en bewaren. Nog niet naar de ontvanger.",
    icon: Mail,
    tone: "slate" as const,
  },
  {
    step: 2,
    title: "Goedkeuren",
    description: "Admin keurt inhoud goed. Dit verstuurt de mail nog niet.",
    icon: CheckCircle,
    tone: "amber" as const,
  },
  {
    step: 3,
    title: "Verzenden",
    description: (
      <>
        Pas bij <span className="font-medium text-foreground">Verzenden</span> gaat de e-mail via SMTP de deur uit.
      </>
    ),
    icon: Send,
    tone: "emerald" as const,
  },
];

export function OutboundWorkflowHelp({ variant = "full", className }: OutboundWorkflowHelpProps) {
  if (variant === "compact") {
    return (
      <p className={className ?? "text-xs text-muted-foreground"}>
        Goedkeuren zet de mail op <span className="font-medium text-foreground">Klaar om te verzenden</span> — pas daarna
        wordt hij echt verstuurd via <span className="font-medium text-foreground">Verzenden</span>.
      </p>
    );
  }

  return (
    <Card className="outbound-workflow overflow-hidden border-border/60 shadow-sm">
      <CardContent className="p-0">
        <div className="outbound-workflow-header">
          <div className="outbound-workflow-header-glow" aria-hidden="true" />

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <span className="outbound-workflow-header-icon">
                <Route className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Outbound workflow
                </p>
                <p className="mt-0.5 text-sm font-semibold tracking-tight text-foreground">
                  Van concept tot verzending
                </p>
              </div>
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              Goedkeuren zet de mail klaar — pas bij verzenden gaat hij echt de deur uit.
            </p>
          </div>
        </div>

        <div className="outbound-workflow-steps p-4 sm:p-5">
          {WORKFLOW_STEPS.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="contents">
                <div className={`outbound-workflow-step outbound-workflow-step-${item.tone}`}>
                  <div className="flex items-start gap-3">
                    <div className="outbound-workflow-step-icon">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="outbound-workflow-step-badge">{item.step}</span>
                        <p className="text-sm font-semibold">{item.title}</p>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </div>
                {index < WORKFLOW_STEPS.length - 1 ? (
                  <div className="outbound-workflow-connector" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
