"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@digitify/ui";

type LeadOption = { id: string; companyName: string };

type DomainFormValues = {
  domainName: string;
  registrar?: string | null;
  registeredAt?: string | Date | null;
  expiresAt?: string | Date | null;
  status?: string;
  sslStatus?: string | null;
  notes?: string | null;
  leadId?: string | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: DomainFormValues | null;
  leadOptions?: LeadOption[];
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    domainName: string;
    registrar?: string;
    registeredAt?: string;
    expiresAt?: string;
    status?: "ACTIVE" | "EXPIRING" | "EXPIRED" | "TRANSFERRED";
    sslStatus?: "VALID" | "EXPIRED" | "NONE" | "UNKNOWN";
    notes?: string;
    leadId?: string;
  }) => void;
};

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export function DomainFormDialog({
  open,
  mode,
  initial,
  leadOptions,
  pending,
  onOpenChange,
  onSubmit,
}: Props) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      domainName: String(form.get("domainName") || ""),
      registrar: String(form.get("registrar") || "") || undefined,
      registeredAt: String(form.get("registeredAt") || "") || undefined,
      expiresAt: String(form.get("expiresAt") || "") || undefined,
      status: (form.get("status") as "ACTIVE" | "EXPIRING" | "EXPIRED" | "TRANSFERRED") || undefined,
      sslStatus: (form.get("sslStatus") as "VALID" | "EXPIRED" | "NONE" | "UNKNOWN") || undefined,
      notes: String(form.get("notes") || "") || undefined,
      leadId: String(form.get("leadId") || "") || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nieuw domein" : "Domein bewerken"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Voeg een domein toe aan je portfolio voor monitoring, analyse en tracking."
              : "Pas registrar, vervaldatum, status en lead-koppeling aan."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domainName">Domeinnaam *</Label>
            <Input
              id="domainName"
              name="domainName"
              required
              defaultValue={initial?.domainName ?? ""}
              placeholder="voorbeeld.be"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrar">Registrar</Label>
            <Input id="registrar" name="registrar" defaultValue={initial?.registrar ?? ""} placeholder="Combell, Namecheap, …" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registeredAt">Registratiedatum</Label>
              <Input id="registeredAt" name="registeredAt" type="date" defaultValue={toDateInput(initial?.registeredAt)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Vervaldatum</Label>
              <Input id="expiresAt" name="expiresAt" type="date" defaultValue={toDateInput(initial?.expiresAt)} />
            </div>
          </div>
          {mode === "edit" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={initial?.status ?? "ACTIVE"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="ACTIVE">Actief</option>
                  <option value="EXPIRING">Verloopt binnenkort</option>
                  <option value="EXPIRED">Verlopen</option>
                  <option value="TRANSFERRED">Overgedragen</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sslStatus">SSL-status</Label>
                <select
                  id="sslStatus"
                  name="sslStatus"
                  defaultValue={initial?.sslStatus ?? "UNKNOWN"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="VALID">Geldig</option>
                  <option value="EXPIRED">Verlopen</option>
                  <option value="NONE">Geen</option>
                  <option value="UNKNOWN">Onbekend</option>
                </select>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="leadId">Gekoppelde lead</Label>
            <select
              id="leadId"
              name="leadId"
              defaultValue={initial?.leadId ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Geen</option>
              {leadOptions?.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.companyName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notities</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes ?? ""} placeholder="Interne notities, contractinfo, …" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Bezig…" : mode === "create" ? "Domein toevoegen" : "Opslaan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
