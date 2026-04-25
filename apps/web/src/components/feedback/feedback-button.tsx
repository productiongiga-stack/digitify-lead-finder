"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@digitify/ui";
import { Loader2, MessageSquareText } from "lucide-react";

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const sendFeedback = trpc.registration.sendFeedback.useMutation({
    onSuccess: () => {
      setSubject("");
      setMessage("");
      setOpen(false);
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 inline-flex h-11 items-center gap-2 rounded-md bg-[#f9ae5a] px-4 text-sm font-semibold text-[#14100b] shadow-[0_18px_36px_rgba(249,174,90,0.32)] transition hover:bg-[#eca04e]"
      >
        <MessageSquareText className="h-4 w-4" />
        Feedback
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feedback doorgeven</DialogTitle>
            <DialogDescription>Je bericht wordt naar alle admins gestuurd.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Onderwerp</Label>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Korte titel" />
            </div>
            <div className="space-y-2">
              <Label>Bericht</Label>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder="Wat moet beter of wat mis je?" />
            </div>
            {sendFeedback.isError && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{sendFeedback.error.message}</p>
            )}
            {sendFeedback.isSuccess && (
              <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">Feedback verstuurd.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button
              className="bg-[#f9ae5a] text-[#14100b] hover:bg-[#eca04e]"
              disabled={subject.trim().length < 3 || message.trim().length < 10 || sendFeedback.isPending}
              onClick={() => sendFeedback.mutate({ subject, message, pageUrl: pathname })}
            >
              {sendFeedback.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Versturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
