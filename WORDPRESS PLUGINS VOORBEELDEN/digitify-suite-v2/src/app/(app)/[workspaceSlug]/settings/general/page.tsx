import { requireWorkspace } from "@/lib/auth-guard";

/**
 * General workspace settings — Stripe/Linear quality settings page.
 * Clean sections with clear labels and descriptions.
 */
export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspace(workspaceSlug);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Workspace name */}
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-sm font-semibold">Workspace naam</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            De naam die overal in de app wordt getoond.
          </p>
        </div>
        <div className="p-6">
          <input
            type="text"
            defaultValue={workspace.name}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex justify-end border-t border-border bg-muted/30 px-6 py-3">
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Opslaan
          </button>
        </div>
      </section>

      {/* Workspace slug */}
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-6">
          <h2 className="text-sm font-semibold">Workspace URL</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            De URL-slug voor je workspace. Wordt gebruikt in alle links.
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-0">
            <span className="rounded-l-lg border border-r-0 border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              app.digitify.be/
            </span>
            <input
              type="text"
              defaultValue={workspace.slug}
              className="flex-1 rounded-r-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex justify-end border-t border-border bg-muted/30 px-6 py-3">
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Opslaan
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-destructive/30 bg-card">
        <div className="border-b border-destructive/30 p-6">
          <h2 className="text-sm font-semibold text-destructive">
            Gevarenzone
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verwijder deze workspace permanent. Dit kan niet ongedaan worden gemaakt.
          </p>
        </div>
        <div className="flex justify-end bg-destructive/5 px-6 py-3">
          <button className="rounded-lg border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
            Workspace verwijderen
          </button>
        </div>
      </section>
    </div>
  );
}
