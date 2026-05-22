import { Card, CardContent } from "@digitify/ui";

type TemplateScopeHelpProps = {
  variant?: "studio" | "compose";
  className?: string;
};

export function TemplateScopeHelp({ variant = "studio", className }: TemplateScopeHelpProps) {
  return (
    <Card
      className={
        className ??
        "border-dashed border-blue-200/70 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20"
      }
    >
      <CardContent className="p-3 text-xs text-muted-foreground">
        {variant === "compose" ? (
          <p>
            <span className="font-medium text-foreground">Campagne-filter:</span> toont templates zonder campagne,
            templates met label <span className="font-medium text-foreground">Alle campagnes</span>, en templates van de
            gekozen campagne — dezelfde logica als in Template Studio.
          </p>
        ) : (
          <p>
            <span className="font-medium text-foreground">Alle campagnes</span> maakt een template zichtbaar bij elke
            campagne in Outbound compose. Optioneel koppel je één specifieke campagne voor overzicht in de bibliotheek.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
