import { Card, CardContent } from "@digitify/ui";
import { CheckCircle, Mail, Send } from "lucide-react";

type OutboundWorkflowHelpProps = {
  variant?: "compact" | "full";
  className?: string;
};

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
    <Card className="border-blue-200/80 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">1. Concept</p>
            <p className="text-xs text-muted-foreground">Opstellen en bewaren. Nog niet naar de ontvanger.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium">2. Goedkeuren</p>
            <p className="text-xs text-muted-foreground">
              Admin keurt inhoud goed. Dit verstuurt de mail nog niet.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
            <Send className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">3. Verzenden</p>
            <p className="text-xs text-muted-foreground">
              Pas bij <span className="font-medium">Verzenden</span> gaat de e-mail via SMTP de deur uit.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
