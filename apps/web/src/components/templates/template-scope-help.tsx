import { Card, CardContent } from "@digitify/ui";
import { Filter, Globe2, Info, Target } from "lucide-react";
import { cn } from "@/lib/utils";

type TemplateScopeHelpProps = {
  variant?: "studio" | "compose";
  className?: string;
};

function StudioHelpContent({ embedded }: { embedded?: boolean }) {
  if (embedded) {
    return (
      <p>
        <span className="font-medium text-foreground">Alle campagnes</span> maakt een template zichtbaar bij elke
        campagne in Outbound compose. Optioneel koppel je één specifieke campagne voor overzicht in de bibliotheek.
      </p>
    );
  }

  return (
    <div className="template-scope-help-body">
      <div className="template-scope-help-intro">
        <span className="template-scope-help-icon">
          <Info className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-foreground">Hoe templates zichtbaar worden</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Bepaal in Template Studio welke campagnes een template mogen gebruiken in Outbound compose.
          </p>
        </div>
      </div>

      <div className="template-scope-help-options">
        <div className="template-scope-help-option template-scope-help-option-global">
          <span className="template-scope-help-option-icon">
            <Globe2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Alle campagnes</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Template verschijnt bij elke campagne in Outbound compose.
            </p>
          </div>
        </div>

        <div className="template-scope-help-option template-scope-help-option-campaign">
          <span className="template-scope-help-option-icon">
            <Target className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Specifieke campagne</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Optioneel — vooral handig om templates te ordenen in de bibliotheek.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposeHelpContent({ embedded }: { embedded?: boolean }) {
  if (embedded) {
    return (
      <p>
        <span className="font-medium text-foreground">Campagne-filter:</span> toont templates zonder campagne,
        templates met label <span className="font-medium text-foreground">Alle campagnes</span>, en templates van de
        gekozen campagne — dezelfde logica als in Template Studio.
      </p>
    );
  }

  return (
    <div className="template-scope-help-body">
      <div className="template-scope-help-intro">
        <span className="template-scope-help-icon">
          <Filter className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-foreground">Campagne-filter in compose</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            De template-lijst volgt dezelfde regels als in Template Studio.
          </p>
        </div>
      </div>

      <ul className="template-scope-help-list">
        <li>Templates zonder campagne</li>
        <li>Templates met label <span className="font-medium text-foreground">Alle campagnes</span></li>
        <li>Templates gekoppeld aan de gekozen campagne</li>
      </ul>
    </div>
  );
}

export function TemplateScopeHelp({ variant = "studio", className }: TemplateScopeHelpProps) {
  const embedded = Boolean(className);

  if (embedded) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        {variant === "compose" ? <ComposeHelpContent embedded /> : <StudioHelpContent embedded />}
      </div>
    );
  }

  return (
    <Card className={cn("template-scope-help overflow-hidden border-border/60 shadow-sm", className)}>
      <CardContent className="p-0">
        {variant === "compose" ? <ComposeHelpContent /> : <StudioHelpContent />}
      </CardContent>
    </Card>
  );
}
