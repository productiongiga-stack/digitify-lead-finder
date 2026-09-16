"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input, Label, Switch } from "@digitify/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@digitify/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@digitify/ui";
import { ArrowLeft, UserPlus, Loader2, Trash2, AlertTriangle, CheckCircle2, XCircle, CalendarDays, Layers, Users2, Pencil, Eye, Search, RefreshCw, ShieldCheck, Building2 } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ALL_MODULES } from "@/lib/navigation";
import { formatTrpcErrorMessage } from "@/lib/trpc/format-error";
import { checkPasswordPolicy, PASSWORD_REQUIREMENTS } from "@digitify/api/src/lib/password-policy";
import { useToast } from "@/components/feedback/toast-provider";

// ─── Module Access Panel (owner-only) ─────────────────────────────────────────

function ModuleAccessPanel({ userId, userName }: { userId: string; userName: string }) {
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const { data, isLoading, error, refetch } = trpc.user.getUserModules.useQuery({ userId }, { retry: 1 });
  const setModule = trpc.user.setUserModule.useMutation({
    onSuccess: () => {
      utils.user.getUserModules.invalidate({ userId });
      showToast({ title: "Moduletoegang bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Moduletoegang kon niet worden bijgewerkt", description: error.message, variant: "error" }),
  });

  const disabledSet = new Set(data?.disabled || []);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
        <p className="text-destructive">Moduletoegang kon niet geladen worden.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Opnieuw proberen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Module-toegang voor <strong>{userName}</strong>. Uitgeschakelde modules verschijnen niet in de sidebar.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ALL_MODULES.map((mod) => {
          const enabled = !disabledSet.has(mod.id);
          return (
            <div key={mod.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
              <span className={enabled ? "" : "text-muted-foreground"}>{mod.label}</span>
              <Switch
                checked={enabled}
                disabled={setModule.isPending}
                onCheckedChange={(value) =>
                  setModule.mutate({ userId, module: mod.id, enabled: value })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TeamAccount = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date | string;
  _count: { leads: number };
  googleCalendar?: { connected: boolean; syncEnabled: boolean; accountEmail: string; calendarId: string };
  workspaces?: Array<{ id: string; name: string; type: string; role: string; status: string }>;
};

function AccountActions({
  user,
  canManageModules,
  canManageUsers,
  currentUserId,
  isPlatformOwner,
  onEdit,
  onModules,
  onView,
  onDelete,
}: {
  user: TeamAccount;
  canManageModules: boolean;
  canManageUsers: boolean;
  currentUserId?: string;
  isPlatformOwner: boolean;
  onEdit: () => void;
  onModules: () => void;
  onView: (workspace: NonNullable<TeamAccount["workspaces"]>[number]) => void;
  onDelete: () => void;
}) {
  const targetWorkspaces = (user.workspaces ?? []).filter((workspace) => workspace.status === "ACTIVE");
  if (!canManageModules) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Gebruiker bewerken" aria-label="Gebruiker bewerken" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title={user.id === currentUserId ? "Je eigen moduletoegang kan niet worden gewijzigd" : "Module toegang"} aria-label="Module toegang" disabled={user.id === currentUserId} onClick={onModules}><Layers className="h-4 w-4" /></Button>
      {canManageUsers && user.id !== currentUserId && targetWorkspaces.length === 1 ? <Button variant="ghost" size="icon" className="h-8 w-8" title="Account bekijken" aria-label="Account bekijken" onClick={() => onView(targetWorkspaces[0])}><Eye className="h-4 w-4" /></Button> : null}
      {canManageUsers && user.id !== currentUserId && targetWorkspaces.length > 1 ? <Select onValueChange={(workspaceId) => { const workspace = targetWorkspaces.find((item) => item.id === workspaceId); if (workspace) onView(workspace); }}><SelectTrigger className="h-8 w-[145px] text-xs" aria-label="Account bekijken in workspace"><Eye className="mr-1 h-3.5 w-3.5" /><SelectValue placeholder="Workspace kiezen" /></SelectTrigger><SelectContent>{targetWorkspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent></Select> : null}
      {!isPlatformOwner ? <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Gebruiker verwijderen" aria-label="Gebruiker verwijderen" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button> : null}
    </div>
  );
}

export default function TeamSettingsPage() {
  const { showToast } = useToast();
  const { data: session } = useSession();
  const sessionUser = session?.user as
    | { role?: string; workspaceRole?: string; isPersonalWorkspace?: boolean }
    | undefined;
  const currentRole = sessionUser?.workspaceRole ?? sessionUser?.role;
  const canManageUsers = currentRole === "OWNER";
  const canManageModules = currentRole === "OWNER" || currentRole === "ADMIN";
  const { data: platformAccess, error: platformAccessError, refetch: refetchPlatformAccess } = trpc.user.getPlatformAccess.useQuery(undefined, { retry: 1 });
  const isPlatformOwner = platformAccess?.isPlatformOwner === true;
  const { data: workspaceInfo, error: workspaceInfoError, refetch: refetchWorkspaceInfo } = trpc.user.getWorkspaceInfo.useQuery(undefined, { retry: 1 });
  const canInviteMembers = canManageUsers && workspaceInfo && !workspaceInfo.isPersonal;
  const { data: users, isLoading, isError: usersError, refetch: refetchUsers } = trpc.user.list.useQuery(undefined, { retry: 1 });
  const { data: requests, isLoading: requestsLoading, error: requestsError, refetch: refetchRequests } = trpc.registration.listRequests.useQuery(undefined, {
    enabled: canManageUsers,
  });
  const utils = trpc.useUtils();

  const updateRole = trpc.user.updateRole.useMutation({
    onSuccess: () => {
      void utils.user.list.invalidate();
      showToast({ title: "Rol bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Rol kon niet worden bijgewerkt", description: error.message, variant: "error" }),
  });

  const createUser = trpc.user.createUser.useMutation({
    onSuccess: () => {
      utils.registration.listRequests.invalidate();
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePassword("");
      showToast({ title: "Uitnodiging aangemaakt", description: "De gebruiker kan de uitnodiging via e-mail bevestigen." });
    },
    onError: (error) => showToast({ title: "Uitnodiging mislukt", description: error.message, variant: "error" }),
  });

  const updateUserDetails = trpc.user.updateUserDetails.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setEditTarget(null);
      setEditName("");
      setEditEmail("");
      showToast({ title: "Gebruiker bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Gebruiker kon niet worden bijgewerkt", description: error.message, variant: "error" }),
  });

  const deleteUser = trpc.user.deleteUser.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setDeleteTarget(null);
      showToast({ title: "Gebruiker verwijderd" });
    },
    onError: (error) => showToast({ title: "Gebruiker kon niet worden verwijderd", description: error.message, variant: "error" }),
  });

  const approveRequest = trpc.registration.approve.useMutation({
    onSuccess: () => {
      utils.registration.listRequests.invalidate();
      utils.user.list.invalidate();
      showToast({ title: "Aanvraag goedgekeurd" });
    },
    onError: (error) => showToast({ title: "Goedkeuren mislukt", description: error.message, variant: "error" }),
  });

  const rejectRequest = trpc.registration.reject.useMutation({
    onSuccess: () => {
      void utils.registration.listRequests.invalidate();
      showToast({ title: "Aanvraag afgewezen" });
    },
    onError: (error) => showToast({ title: "Afwijzen mislukt", description: error.message, variant: "error" }),
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [workspaceFilter, setWorkspaceFilter] = useState("ALL");

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string | null } | null>(null);
  const [moduleTarget, setModuleTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [viewTarget, setViewTarget] = useState<{
    userId: string;
    name: string;
    email: string;
    workspaceId: string;
    workspaceName: string;
  } | null>(null);

  async function startViewingAccount() {
    if (!viewTarget) return;
    try {
      const response = await fetch("/api/account-view/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: viewTarget.userId, workspaceId: viewTarget.workspaceId }),
      });
      if (response.ok) window.location.href = "/dashboard";
      else {
        const payload = await response.json().catch(() => null);
        showToast({ title: "Account bekijken mislukt", description: payload?.message || "De sessie kon niet worden gestart.", variant: "error" });
        setViewTarget(null);
      }
    } catch {
      showToast({ title: "Account bekijken mislukt", description: "Er kon geen verbinding met de server worden gemaakt.", variant: "error" });
      setViewTarget(null);
    }
  }

  const workspaceOptions = useMemo(() => {
    const options = new Map<string, string>();
    users?.forEach((user) => user.workspaces?.forEach((workspace) => options.set(workspace.id, workspace.name)));
    return Array.from(options.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (users ?? []).filter((user) => {
      const matchesQuery = !query || `${user.name ?? ""} ${user.email}`.toLowerCase().includes(query);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesWorkspace = workspaceFilter === "ALL" || user.workspaces?.some((workspace) => workspace.id === workspaceFilter);
      return matchesQuery && matchesRole && matchesWorkspace;
    });
  }, [users, search, roleFilter, workspaceFilter]);

  const accountStats = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      admins: list.filter((user) => user.role === "OWNER" || user.role === "ADMIN").length,
      active: list.filter((user) => user.workspaces?.some((workspace) => workspace.status === "ACTIVE")).length,
    };
  }, [users]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Team & Rollen</h1>
          <p className="text-sm text-muted-foreground">Beheer gebruikers en hun rechten</p>
        </div>
        {canInviteMembers ? (
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Uitnodigen
          </Button>
        ) : null}
      </div>

      {workspaceInfo ? (
        <div className="team-workspace-banner">
          <div className="team-workspace-banner-glow" aria-hidden />
          <div className="team-workspace-banner-accent" />
          <div className="team-workspace-banner-content">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
                <Users2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold tracking-tight">
                    {workspaceInfo.isPersonal ? "Persoonlijke werkruimte" : "Gedeelde workspace"}
                  </p>
                  {workspaceInfo.isOwner ? (
                    <Badge className="border-primary/25 bg-primary/10 text-primary hover:bg-primary/10">
                      Eigenaar
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Teamlid</Badge>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {workspaceInfo.isPersonal
                    ? "Dit is je eigen omgeving. Maak een team-werkruimte aan of nodig leden uit via Werkruimtes om samen te werken."
                    : workspaceInfo.isOwner
                      ? "Jij bent de eigenaar. Teamleden werken in dezelfde omgeving met gedeelde data."
                      : `Je werkt in de workspace van ${workspaceInfo.ownerName}. Leads, campagnes en templates zijn gedeeld.`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch">
              <div className="team-workspace-stat min-w-[88px]">
                <p className="text-lg font-bold tabular-nums leading-none">{workspaceInfo.memberCount}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {workspaceInfo.memberCount === 1 ? "Account" : "Teamleden"}
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-border/50 px-5 pb-5 pt-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Gedeeld in deze workspace
            </p>
            <div className="flex flex-wrap gap-1.5">
              {workspaceInfo.sharedResources.map((resource) => (
                <span key={resource} className="team-workspace-chip">
                  <Layers className="mr-1 inline h-3 w-3 text-primary/70" aria-hidden />
                  {resource}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {workspaceInfoError || platformAccessError ? (
        <Card><CardContent className="flex flex-col gap-3 p-4 text-sm"><p className="text-destructive">Workspace- of platforminformatie kon niet geladen worden.</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { void refetchWorkspaceInfo(); void refetchPlatformAccess(); }}><RefreshCw className="mr-2 h-4 w-4" /> Opnieuw proberen</Button></div></CardContent></Card>
      ) : null}

      {isPlatformOwner ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          <strong>Platformbeheer:</strong> je ziet alle geregistreerde accounts en hun veilige workspace-overzicht. Wachtwoorden, tokens en integratiesleutels blijven afgeschermd.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Accounts", value: accountStats.total, icon: Users2 },
          { label: "Owners & admins", value: accountStats.admins, icon: ShieldCheck },
          { label: "Actieve leden", value: accountStats.active, icon: CheckCircle2 },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><stat.icon className="h-4 w-4" /></div>
              <div><p className="text-2xl font-bold tabular-nums">{isLoading ? "—" : stat.value}</p><p className="text-xs text-muted-foreground">{stat.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek op naam of e-mail" className="pl-9" aria-label="Zoek accounts" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full md:w-[155px]" aria-label="Filter op rol"><SelectValue placeholder="Alle rollen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle rollen</SelectItem><SelectItem value="OWNER">Eigenaar</SelectItem><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="MEMBER">Member</SelectItem><SelectItem value="VIEWER">Viewer</SelectItem><SelectItem value="TESTER">Tester</SelectItem>
            </SelectContent>
          </Select>
          {isPlatformOwner ? (
            <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
              <SelectTrigger className="w-full md:w-[210px]" aria-label="Filter op workspace"><SelectValue placeholder="Alle workspaces" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Alle workspaces</SelectItem>{workspaceOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
        </CardContent>
      </Card>

      {usersError ? (
        <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">Accounts konden niet geladen worden.</p>
          <Button variant="outline" onClick={() => refetchUsers()}><RefreshCw className="mr-2 h-4 w-4" /> Opnieuw proberen</Button>
        </CardContent></Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <Table className="min-w-[980px]">
              <TableHeader><TableRow><TableHead>Naam</TableHead><TableHead>E-mail</TableHead><TableHead>Workspace</TableHead><TableHead>Rol</TableHead><TableHead>Google Agenda</TableHead><TableHead>Leads</TableHead><TableHead>Lid sinds</TableHead><TableHead className="w-[150px]">Acties</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? Array.from({ length: 4 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>) : filteredUsers.length ? filteredUsers.map((user) => {
                  const workspace = user.workspaces?.find((item) => item.status === "ACTIVE") ?? user.workspaces?.[0];
                  return <TableRow key={user.id}><TableCell className="font-medium">{user.name || "—"}</TableCell><TableCell className="text-sm text-muted-foreground">{user.email}</TableCell><TableCell><div className="flex items-center gap-1.5 text-sm"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{workspace?.name || "Geen workspace"}</div><span className="text-xs text-muted-foreground">{workspace?.status === "ACTIVE" ? "Actief" : "Niet actief"}</span></TableCell><TableCell>{canManageUsers ? <Select value={user.role} onValueChange={(role) => { if (window.confirm(`Rol van ${user.name || user.email} wijzigen naar ${role.toLowerCase()}?`)) updateRole.mutate({ userId: user.id, role: role as any }); }}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OWNER">Eigenaar</SelectItem><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="MODERATOR">Moderator</SelectItem><SelectItem value="MEMBER">Member</SelectItem><SelectItem value="TRIAL">Trial</SelectItem><SelectItem value="TESTER">Tester</SelectItem><SelectItem value="VIEWER">Viewer</SelectItem></SelectContent></Select> : <Badge variant="outline">{user.role.toLowerCase()}</Badge>}</TableCell><TableCell>{user.googleCalendar?.connected ? <Badge variant={user.googleCalendar.syncEnabled ? "success" : "secondary"}><CalendarDays className="mr-1 h-3 w-3" />{user.googleCalendar.syncEnabled ? "Sync actief" : "Gekoppeld"}</Badge> : <Badge variant="outline">Niet gekoppeld</Badge>}</TableCell><TableCell>{user._count.leads}</TableCell><TableCell className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</TableCell><TableCell><AccountActions user={user} canManageModules={canManageModules} canManageUsers={canManageUsers} currentUserId={(session?.user as { id?: string } | undefined)?.id} isPlatformOwner={isPlatformOwner} onEdit={() => { setEditTarget({ id: user.id, name: user.name || "", email: user.email }); setEditName(user.name || ""); setEditEmail(user.email); }} onModules={() => setModuleTarget({ id: user.id, name: user.name || user.email })} onView={(workspace) => setViewTarget({ userId: user.id, name: user.name || user.email, email: user.email, workspaceId: workspace.id, workspaceName: workspace.name })} onDelete={() => setDeleteTarget({ id: user.id, name: user.name })} /></TableCell></TableRow>;
                }) : <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Geen accounts gevonden.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {isLoading ? Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="space-y-3 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-8 w-full" /></CardContent></Card>) : filteredUsers.length ? filteredUsers.map((user) => { const workspace = user.workspaces?.find((item) => item.status === "ACTIVE") ?? user.workspaces?.[0]; return <Card key={user.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{user.name || "—"}</p><p className="truncate text-sm text-muted-foreground">{user.email}</p></div><Badge variant="outline">{user.role.toLowerCase()}</Badge></div><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span><Building2 className="mr-1 inline h-3.5 w-3.5" />{workspace?.name || "Geen workspace"}</span><span>{user._count.leads} leads</span></div><AccountActions user={user} canManageModules={canManageModules} canManageUsers={canManageUsers} currentUserId={(session?.user as { id?: string } | undefined)?.id} isPlatformOwner={isPlatformOwner} onEdit={() => { setEditTarget({ id: user.id, name: user.name || "", email: user.email }); setEditName(user.name || ""); setEditEmail(user.email); }} onModules={() => setModuleTarget({ id: user.id, name: user.name || user.email })} onView={(workspace) => setViewTarget({ userId: user.id, name: user.name || user.email, email: user.email, workspaceId: workspace.id, workspaceName: workspace.name })} onDelete={() => setDeleteTarget({ id: user.id, name: user.name })} /></CardContent></Card>; }) : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Geen accounts gevonden.</CardContent></Card>}
          </div>
        </>
      )}

      {viewTarget ? <Dialog open onOpenChange={(open) => !open && setViewTarget(null)}><DialogContent><DialogHeader><DialogTitle>Account bekijken</DialogTitle><DialogDescription>Je opent {viewTarget.name} in workspace {viewTarget.workspaceName} als tijdelijke view-as-sessie.</DialogDescription></DialogHeader><div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm"><p><strong>Account:</strong> {viewTarget.email}</p><p><strong>Duur:</strong> maximaal 30 minuten</p><p><strong>Toegestaan:</strong> normale operationele wijzigingen</p><p><strong>Geblokkeerd:</strong> rollen, secrets, exports, verzendingen en betalingen</p></div><DialogFooter><Button variant="outline" onClick={() => setViewTarget(null)}>Annuleren</Button><Button onClick={() => void startViewingAccount()}><Eye className="mr-2 h-4 w-4" /> Account bekijken</Button></DialogFooter></DialogContent></Dialog> : null}

      {/* Module access modal */}
      {moduleTarget && canManageModules && (
        <Dialog open={!!moduleTarget} onOpenChange={(open) => !open && setModuleTarget(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Module toegang
              </DialogTitle>
              <DialogDescription>
                Schakel modules in of uit voor {moduleTarget.name}.
              </DialogDescription>
            </DialogHeader>
            <ModuleAccessPanel userId={moduleTarget.id} userName={moduleTarget.name} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setModuleTarget(null)}>Sluiten</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canManageUsers ? (
      <Card>
        <CardHeader>
          <CardTitle>Registratieaanvragen</CardTitle>
          <p className="text-sm text-muted-foreground">Geverifieerde aanvragen kunnen hier goed- of afgekeurd worden.</p>
        </CardHeader>
        <CardContent>
          {requestsError ? <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm"><p className="text-destructive">Registratieaanvragen konden niet geladen worden.</p><Button variant="outline" size="sm" onClick={() => refetchRequests()}><RefreshCw className="mr-2 h-4 w-4" /> Opnieuw proberen</Button></div> : <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Bedrijf</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aangevraagd</TableHead>
                <TableHead className="w-[160px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestsLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : requests?.length ? (
                requests.map((request: NonNullable<typeof requests>[number]) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      <div>{request.name}</div>
                      {request.message && <div className="mt-1 max-w-[320px] truncate text-xs text-muted-foreground">{request.message}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{request.email}</TableCell>
                    <TableCell>{request.company || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={request.status === "PENDING_APPROVAL" ? "default" : request.status === "APPROVED" ? "secondary" : "outline"}>
                        {request.status.replaceAll("_", " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(request.createdAt)}</TableCell>
                    <TableCell>
                      {request.status === "PENDING_APPROVAL" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={approveRequest.isPending || rejectRequest.isPending}
                            onClick={() => approveRequest.mutate({ requestId: request.id })}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Goedkeuren
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={approveRequest.isPending || rejectRequest.isPending}
                            onClick={() => rejectRequest.mutate({ requestId: request.id })}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Geen registratieaanvragen.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>}
        </CardContent>
      </Card>
      ) : null}

      {/* Invite User Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gebruiker Uitnodigen</DialogTitle>
            <DialogDescription>
              Verstuur een team-uitnodiging. De gebruiker bevestigt eerst via e-mail en komt daarna als Member in de workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Naam</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jan Janssen" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jan@mijnbedrijf.be" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Wachtwoord</Label>
              <Input value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder={`Minimaal ${PASSWORD_REQUIREMENTS.minLength} tekens`} type="password" aria-describedby="invite-password-help" />
              <p id="invite-password-help" className="text-xs text-muted-foreground">Minimaal {PASSWORD_REQUIREMENTS.minLength} tekens, met een kleine letter, hoofdletter en cijfer.</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              Nieuwe uitnodigingen worden standaard als <strong>Member</strong> aangemaakt na e-mailbevestiging.
            </div>
            {createUser.isError && (
              <div className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {formatTrpcErrorMessage(createUser.error.message)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Annuleren</Button>
            <Button
              onClick={() => createUser.mutate({ name: inviteName, email: inviteEmail, password: invitePassword })}
              disabled={!inviteName.trim() || !inviteEmail.trim() || !checkPasswordPolicy(invitePassword).ok || createUser.isPending}
            >
              {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Uitnodiging versturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gebruiker bewerken</DialogTitle>
            <DialogDescription>Pas naam en e-mail van dit teamlid aan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Naam</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Naam" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="naam@bedrijf.com" type="email" />
            </div>
            {updateUserDetails.isError && (
              <div className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {formatTrpcErrorMessage(updateUserDetails.error.message)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Annuleren</Button>
            <Button
              onClick={() =>
                editTarget && updateUserDetails.mutate({
                  userId: editTarget.id,
                  name: editName,
                  email: editEmail,
                })
              }
              disabled={!editName.trim() || !editEmail.trim() || updateUserDetails.isPending}
            >
              {updateUserDetails.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Gebruiker Verwijderen
            </DialogTitle>
            <DialogDescription>
              Weet je zeker dat je &quot;{deleteTarget?.name || "deze gebruiker"}&quot; wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          {deleteUser.isError && (
            <div className="whitespace-pre-line rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {formatTrpcErrorMessage(deleteUser.error.message)}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuleren</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteUser.mutate({ userId: deleteTarget.id })}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
