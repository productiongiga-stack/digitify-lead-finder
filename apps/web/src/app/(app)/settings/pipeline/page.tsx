"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton, Badge } from "@digitify/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@digitify/ui";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function PipelineSettingsPage() {
  const { data: stages, isLoading } = trpc.pipeline.getStages.useQuery();
  const utils = trpc.useUtils();

  const createStage = trpc.pipeline.createStage.useMutation({
    onSuccess: () => {
      utils.pipeline.getStages.invalidate();
      setShowAddDialog(false);
      setNewName("");
      setNewColor("#6366f1");
    },
  });

  const updateStage = trpc.pipeline.updateStage.useMutation({
    onSuccess: () => {
      utils.pipeline.getStages.invalidate();
      setEditStage(null);
    },
  });

  const deleteStage = trpc.pipeline.deleteStage.useMutation({
    onSuccess: () => {
      utils.pipeline.getStages.invalidate();
      setDeleteTarget(null);
    },
  });

  const reorderStages = trpc.pipeline.reorderStages.useMutation({
    onSuccess: () => utils.pipeline.getStages.invalidate(),
  });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  const [editStage, setEditStage] = useState<{ id: string; name: string; color: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; leadCount: number } | null>(null);

  function handleMoveUp(index: number) {
    if (!stages || index === 0) return;
    const ids = stages.map((s: NonNullable<typeof stages>[number]) => s.id);
    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
    reorderStages.mutate({ stageIds: ids });
  }

  function handleMoveDown(index: number) {
    if (!stages || index === stages.length - 1) return;
    const ids = stages.map((s: NonNullable<typeof stages>[number]) => s.id);
    [ids[index], ids[index + 1]] = [ids[index + 1]!, ids[index]!];
    reorderStages.mutate({ stageIds: ids });
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Pipeline Stages</h1>
          <p className="text-sm text-muted-foreground">Beheer de stappen in je sales pipeline</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Stage Toevoegen
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Stages ({stages?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stages?.map((stage: NonNullable<typeof stages>[number], index: number) => (
            <div
              key={stage.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div
                className="h-8 w-8 rounded-md shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{stage.name}</p>
                <p className="text-xs text-muted-foreground">{stage._count.leads} leads</p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">#{index + 1}</Badge>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === 0 || reorderStages.isPending}
                  onClick={() => handleMoveUp(index)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === (stages?.length ?? 0) - 1 || reorderStages.isPending}
                  onClick={() => handleMoveDown(index)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditStage({ id: stage.id, name: stage.name, color: stage.color })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget({ id: stage.id, name: stage.name, leadCount: stage._count.leads })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {(!stages || stages.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Geen stages gevonden. Voeg een eerste stage toe.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Stage Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Stage Toevoegen</DialogTitle>
            <DialogDescription>Voeg een nieuwe stap toe aan je sales pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Naam</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Bijv. Gekwalificeerd" />
            </div>
            <div className="space-y-2">
              <Label>Kleur</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border"
                />
                <Input value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-32 font-mono" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuleren</Button>
            <Button
              onClick={() => createStage.mutate({ name: newName, color: newColor })}
              disabled={!newName.trim() || createStage.isPending}
            >
              {createStage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stage Dialog */}
      <Dialog open={!!editStage} onOpenChange={(open) => !open && setEditStage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stage Bewerken</DialogTitle>
            <DialogDescription>Pas de naam en kleur van deze stage aan.</DialogDescription>
          </DialogHeader>
          {editStage && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Naam</Label>
                <Input
                  value={editStage.name}
                  onChange={(e) => setEditStage({ ...editStage, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Kleur</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editStage.color}
                    onChange={(e) => setEditStage({ ...editStage, color: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded border"
                  />
                  <Input
                    value={editStage.color}
                    onChange={(e) => setEditStage({ ...editStage, color: e.target.value })}
                    className="w-32 font-mono"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStage(null)}>Annuleren</Button>
            <Button
              onClick={() => editStage && updateStage.mutate({ id: editStage.id, name: editStage.name, color: editStage.color })}
              disabled={updateStage.isPending}
            >
              {updateStage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Stage Verwijderen
            </DialogTitle>
            <DialogDescription>
              Weet je zeker dat je de stage &quot;{deleteTarget?.name}&quot; wilt verwijderen?
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && deleteTarget.leadCount > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <strong>Waarschuwing:</strong> Er zijn {deleteTarget.leadCount} leads gekoppeld aan deze stage.
              Deze leads worden ontkoppeld na verwijdering.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuleren</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteStage.mutate({ id: deleteTarget.id })}
              disabled={deleteStage.isPending}
            >
              {deleteStage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
