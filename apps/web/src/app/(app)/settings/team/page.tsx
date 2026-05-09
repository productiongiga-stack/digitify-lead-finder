"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input, Label } from "@digitify/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@digitify/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@digitify/ui";
import { ArrowLeft, UserPlus, Loader2, Trash2, AlertTriangle, CheckCircle2, XCircle, CalendarDays } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const currentRole = (session?.user as { role?: string } | undefined)?.role;
  const canManageUsers = currentRole === "OWNER";
  const { data: users, isLoading } = trpc.user.list.useQuery();
  const { data: requests, isLoading: requestsLoading } = trpc.registration.listRequests.useQuery();
  const utils = trpc.useUtils();

  const updateRole = trpc.user.updateRole.useMutation({
    onSuccess: () => utils.user.list.invalidate(),
  });

  const createUser = trpc.user.createUser.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePassword("");
      setInviteRole("MEMBER");
    },
  });

  const deleteUser = trpc.user.deleteUser.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setDeleteTarget(null);
    },
  });

  const approveRequest = trpc.registration.approve.useMutation({
    onSuccess: () => {
      utils.registration.listRequests.invalidate();
      utils.user.list.invalidate();
    },
  });

  const rejectRequest = trpc.registration.reject.useMutation({
    onSuccess: () => utils.registration.listRequests.invalidate(),
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MODERATOR" | "MEMBER" | "TRIAL" | "TESTER" | "VIEWER">("MEMBER");

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string | null } | null>(null);

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
        {canManageUsers ? (
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Uitnodigen
          </Button>
        ) : null}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Google Agenda</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Lid sinds</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              users?.map((user: NonNullable<typeof users>[number]) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {canManageUsers ? (
                      <Select
                        value={user.role}
                        onValueChange={(role) =>
                          updateRole.mutate({ userId: user.id, role: role as any })
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OWNER">Eigenaar</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MODERATOR">Moderator</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="TRIAL">Trial (7 days)</SelectItem>
                          <SelectItem value="TESTER">Tester</SelectItem>
                          <SelectItem value="VIEWER">Viewer (legacy)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{user.role.toLowerCase()}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.googleCalendar?.connected ? (
                      <div className="space-y-1">
                        <Badge variant={user.googleCalendar.syncEnabled ? "success" : "secondary"}>
                          <CalendarDays className="mr-1 h-3 w-3" />
                          {user.googleCalendar.syncEnabled ? "Sync actief" : "Gekoppeld"}
                        </Badge>
                        <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {user.googleCalendar.accountEmail || user.googleCalendar.calendarId}
                        </p>
                      </div>
                    ) : (
                      <Badge variant="outline">Niet gekoppeld</Badge>
                    )}
                  </TableCell>
                  <TableCell>{user._count.leads}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    {canManageUsers ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: user.id, name: user.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registratieaanvragen</CardTitle>
          <p className="text-sm text-muted-foreground">Geverifieerde aanvragen kunnen hier goed- of afgekeurd worden.</p>
        </CardHeader>
        <CardContent>
          <Table>
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
                            onClick={() => approveRequest.mutate({ requestId: request.id, role: "MEMBER" })}
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
          </Table>
        </CardContent>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gebruiker Uitnodigen</DialogTitle>
            <DialogDescription>Maak een nieuw account aan voor een teamlid.</DialogDescription>
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
              <Input value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Minimaal 6 tekens" type="password" />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MODERATOR">Moderator</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="TRIAL">Trial (7 days)</SelectItem>
                  <SelectItem value="TESTER">Tester</SelectItem>
                  <SelectItem value="VIEWER">Viewer (legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createUser.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {createUser.error.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Annuleren</Button>
            <Button
              onClick={() => createUser.mutate({ name: inviteName, email: inviteEmail, password: invitePassword, role: inviteRole })}
              disabled={!inviteName.trim() || !inviteEmail.trim() || invitePassword.length < 6 || createUser.isPending}
            >
              {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aanmaken
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
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {deleteUser.error.message}
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
