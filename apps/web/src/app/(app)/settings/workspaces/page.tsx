"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from "@digitify/ui";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Layers,
  Loader2,
  Mail,
  Plus,
  UserCircle,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/feedback/toast-provider";

export default function WorkspacesSettingsPage() {
  const router = useRouter();
  const { update } = useSession();
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const { data: workspaces, isLoading } = trpc.workspace.listMine.useQuery();
  const { data: invitations, isLoading: invitationsLoading } =
    trpc.workspace.listPendingInvitations.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");

  const switchWorkspace = trpc.workspace.switch.useMutation({
    onSuccess: async () => {
      await update();
      await utils.invalidate();
      router.refresh();
      showToast({ title: "Werkruimte gewisseld" });
    },
  });

  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: async () => {
      await update();
      await utils.workspace.listMine.invalidate();
      setShowCreate(false);
      setNewName("");
      showToast({ title: "Werkruimte aangemaakt", description: "Je bent naar de nieuwe werkruimte gewisseld." });
      router.refresh();
    },
  });

  const respondInvitation = trpc.workspace.respondToInvitation.useMutation({
    onSuccess: async (result) => {
      await update();
      await utils.workspace.listMine.invalidate();
      await utils.workspace.listPendingInvitations.invalidate();
      router.refresh();
      showToast({
        title: result.accepted ? "Uitnodiging geaccepteerd" : "Uitnodiging geweigerd",
      });
    },
  });

  const inviteByEmail = trpc.workspace.inviteByEmail.useMutation({
    onSuccess: () => {
      setInviteWorkspaceId(null);
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      utils.workspace.listMembers.invalidate();
      showToast({ title: "Uitnodiging verstuurd" });
    },
  });

  const activeWorkspace = workspaces?.find((item) => item.isActive);
  const teamWorkspaces = workspaces?.filter((item) => !item.isPersonal && item.status === "ACTIVE") ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Werkruimtes</h1>
          <p className="text-sm text-muted-foreground">
            Elke gebruiker heeft een persoonlijke werkruimte met eigen data en instellingen. Maak gedeelde
            werkruimtes aan en nodig teamleden uit.
          </p>
        </div>
      </div>

      {!invitationsLoading && invitations && invitations.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Openstaande uitnodigingen</CardTitle>
            <CardDescription>Accepteer of weiger uitnodigingen voor gedeelde werkruimtes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((invite) => (
              <div
                key={invite.membershipId}
                className="flex flex-col gap-3 rounded-xl border bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{invite.workspaceName}</p>
                  <p className="text-sm text-muted-foreground">
                    Uitgenodigd door {invite.invitedByName || invite.ownerName}
                    {invite.invitedAt ? ` · ${formatDate(invite.invitedAt)}` : ""}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    Rol: {invite.role}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respondInvitation.isPending}
                    onClick={() =>
                      respondInvitation.mutate({ workspaceId: invite.workspaceId, accept: false })
                    }
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Weigeren
                  </Button>
                  <Button
                    size="sm"
                    disabled={respondInvitation.isPending}
                    onClick={() =>
                      respondInvitation.mutate({ workspaceId: invite.workspaceId, accept: true })
                    }
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Accepteren
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              Jouw werkruimtes
            </CardTitle>
            <CardDescription>
              Actief: {activeWorkspace?.name || "—"}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nieuwe werkruimte
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            workspaces?.map((workspace) => (
              <div
                key={workspace.id}
                className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  {workspace.isPersonal ? (
                    <UserCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{workspace.name}</p>
                      {workspace.isActive ? <Badge>Actief</Badge> : null}
                      {workspace.status === "INVITED" ? (
                        <Badge variant="outline">Uitnodiging open</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {workspace.isPersonal
                        ? "Persoonlijke werkruimte — eigen API-keys, leads en instellingen"
                        : `Gedeelde werkruimte · ${workspace.memberCount} leden · eigenaar ${workspace.ownerName}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!workspace.isActive && workspace.status === "ACTIVE" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={switchWorkspace.isPending}
                      onClick={() => switchWorkspace.mutate({ workspaceId: workspace.id })}
                    >
                      Openen
                    </Button>
                  ) : null}
                  {!workspace.isPersonal && workspace.status === "ACTIVE" && ["OWNER", "ADMIN"].includes(workspace.role) ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setInviteWorkspaceId(workspace.id)}
                    >
                      <Mail className="mr-1.5 h-4 w-4" />
                      Uitnodigen
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {teamWorkspaces.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teamleden beheren</CardTitle>
            <CardDescription>
              Teamleden en rollen beheer je per gedeelde werkruimte via{" "}
              <Link href="/settings/team" className="text-primary underline-offset-4 hover:underline">
                Team & Rollen
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe gedeelde werkruimte</DialogTitle>
            <DialogDescription>
              Start fris met een nieuwe werkruimte. API-keys, leads en instellingen zijn leeg totdat je ze
              configureert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Naam</Label>
            <Input
              id="workspace-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Bijv. Marketing team"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuleren
            </Button>
            <Button
              disabled={createWorkspace.isPending || newName.trim().length < 2}
              onClick={() => createWorkspace.mutate({ name: newName.trim() })}
            >
              {createWorkspace.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(inviteWorkspaceId)} onOpenChange={(open) => !open && setInviteWorkspaceId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teamlid uitnodigen</DialogTitle>
            <DialogDescription>
              Bestaande gebruikers krijgen een uitnodiging in de app. Nieuwe gebruikers ontvangen een
              verificatie-e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Naam (nieuwe gebruikers)</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password">Tijdelijk wachtwoord (nieuwe gebruikers)</Label>
              <Input
                id="invite-password"
                type="password"
                value={invitePassword}
                onChange={(event) => setInvitePassword(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteWorkspaceId(null)}>
              Annuleren
            </Button>
            <Button
              disabled={inviteByEmail.isPending || !inviteEmail || !inviteWorkspaceId}
              onClick={() => {
                if (!inviteWorkspaceId) return;
                inviteByEmail.mutate({
                  workspaceId: inviteWorkspaceId,
                  email: inviteEmail,
                  name: inviteName || undefined,
                  password: invitePassword || undefined,
                });
              }}
            >
              {inviteByEmail.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Uitnodigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
