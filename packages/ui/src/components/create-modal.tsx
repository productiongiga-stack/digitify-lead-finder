"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { cn } from "../lib/utils";

export interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Called when user confirms. If it returns a Promise, the submit button shows a pending state. */
  onSubmit?: () => void | Promise<void>;
  submitLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  submitDisabled?: boolean;
  submitVariant?: React.ComponentProps<typeof Button>["variant"];
  pending?: boolean;
  /** When true, the form element is rendered so onSubmit fires on Enter. */
  asForm?: boolean;
  contentClassName?: string;
  hideFooter?: boolean;
}

export function CreateModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Opslaan",
  cancelLabel = "Annuleren",
  submitDisabled,
  submitVariant,
  pending,
  asForm,
  contentClassName,
  hideFooter,
}: CreateModalProps) {
  const [internalPending, setInternalPending] = React.useState(false);
  const isPending = pending ?? internalPending;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!onSubmit) return;
    try {
      const result = onSubmit();
      if (result instanceof Promise) {
        setInternalPending(true);
        await result;
      }
    } finally {
      setInternalPending(false);
    }
  }

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      <div className="py-2">{children}</div>
      {!hideFooter ? (
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {cancelLabel}
          </Button>
          {onSubmit ? (
            <Button
              type={asForm ? "submit" : "button"}
              variant={submitVariant}
              disabled={submitDisabled || isPending}
              onClick={asForm ? undefined : () => handleSubmit()}
            >
              {isPending ? "Bezig..." : submitLabel}
            </Button>
          ) : null}
        </DialogFooter>
      ) : null}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("z-[100]", contentClassName)}>
        {asForm && onSubmit ? <form onSubmit={handleSubmit}>{body}</form> : body}
      </DialogContent>
    </Dialog>
  );
}
