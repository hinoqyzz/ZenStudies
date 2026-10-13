import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { MintCore } from "./Symbol";

export function IconTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="kbd" sideOffset={6}>{label}</Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return (
    <div className="empty">
      <MintCore size={22} />
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      <button className="button" type="button" onClick={onAction}>{action}</button>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(value) => { if (!value) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-mask" />
        <Dialog.Content className="dialog">
          <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
          <Dialog.Description>{body}</Dialog.Description>
          <div className="focus-actions" style={{ marginTop: 18 }}>
            <button className="button secondary" type="button" onClick={onCancel}>Cancelar</button>
            <button className={danger ? "button danger" : "button"} type="button" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TextDialog({
  open,
  title,
  body,
  fields,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  fields: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(value) => { if (!value) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-mask" />
        <Dialog.Content className="dialog">
          <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
          {body ? <Dialog.Description>{body}</Dialog.Description> : <Dialog.Description className="muted"> </Dialog.Description>}
          <div style={{ marginTop: 16 }}>{fields}</div>
          <div className="focus-actions" style={{ marginTop: 8 }}>
            <button className="button secondary" type="button" onClick={onCancel}>Cancelar</button>
            <button className="button" type="button" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
