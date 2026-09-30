import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { ArrowRight, Check, X } from "lucide-react";
import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details: ReactNode;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending || nextOpen) onOpenChange(nextOpen);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content" aria-describedby="confirm-description">
          <div className="dialog-topline"><span className="dialog-icon"><ArrowRight size={19} /></span><AlertDialog.Cancel className="icon-button" aria-label="Close" disabled={pending}><X size={18} /></AlertDialog.Cancel></div>
          <AlertDialog.Title className="dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description id="confirm-description" className="dialog-description">{description}</AlertDialog.Description>
          <div className="confirm-details">{details}</div>
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild><button className="button button-secondary" disabled={pending}>Cancel</button></AlertDialog.Cancel>
            <button className="button button-primary" onClick={onConfirm} disabled={pending}>{pending ? <><span className="spinner" /> Creating…</> : <>{confirmLabel}<Check size={16} /></>}</button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
