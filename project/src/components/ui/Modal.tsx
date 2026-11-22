import React, { useEffect, useId, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from './dialog';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'wide';

// sm: confirmations, md: short forms, lg: long forms, xl: detail views, wide: detail views with two dense columns.
const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
  wide: 'max-w-6xl',
};

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

// orange-700 and red-600 keep white text above 4.5:1 (5.18:1 and 4.83:1); orange-500 and red-500 did not (audit 4.1).
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-orange-700 text-white hover:bg-orange-800 focus-visible:ring-orange-700',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-orange-700',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
};

interface ModalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  busy?: boolean;
  busyLabel?: string;
}

export const ModalButton = React.forwardRef<HTMLButtonElement, ModalButtonProps>(
  ({ variant = 'secondary', busy = false, busyLabel, className, children, disabled, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold sm:h-10 sm:w-auto',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANT[variant],
        className,
      )}
      {...props}
    >
      {busy && <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  ),
);
ModalButton.displayName = 'ModalButton';

// Radix only hands focus back to a Dialog.Trigger, and these dialogs open from ordinary buttons.
function useReturnFocus() {
  const lastFocused = useRef<HTMLElement | null>(null);
  return {
    // Called from onOpenAutoFocus, before Radix moves focus, so activeElement is still the opener.
    remember: () => {
      lastFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    restore: (e: Event) => {
      e.preventDefault();
      if (lastFocused.current?.isConnected) lastFocused.current.focus({ preventScroll: true });
    },
  };
}

const FIELD_SELECTOR ='input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: ModalSize;
  // While a request runs, Escape, the overlay and the close button do nothing, so the result is never lost.
  busy?: boolean;
  footer?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  busy = false,
  footer,
  initialFocusRef,
  bodyClassName,
  children,
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnFocus = useReturnFocus();

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          // Radix wires aria-describedby to DialogDescription; without one it must be cleared explicitly.
          {...(description ? {} : { 'aria-describedby': undefined })}
          aria-modal="true"
          onCloseAutoFocus={returnFocus.restore}
          onOpenAutoFocus={(e) => {
            returnFocus.remember();
            // Forms start on their first field and detail views on the dialog itself, not on the close button.
            e.preventDefault();
            const target = initialFocusRef?.current ?? bodyRef.current?.querySelector<HTMLElement>(FIELD_SELECTOR);
            (target ?? (e.currentTarget as HTMLElement)).focus({ preventScroll: true });
          }}
          onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
          onInteractOutside={(e) => { if (busy) e.preventDefault(); }}
          className={cn(
            'fixed inset-0 z-50 m-auto flex h-fit max-h-[90dvh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg bg-white shadow-xl focus:outline-none',
            SIZE[size],
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-4 py-3 sm:px-6">
            <div className="min-w-0 pt-2">
              <DialogTitle className="text-lg font-semibold leading-snug text-gray-900">{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1 text-sm text-gray-600">{description}</DialogDescription>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Tutup"
              disabled={busy}
              className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10"
            >
              <X size={20} aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div
            ref={bodyRef}
            className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4 [overflow-wrap:anywhere] sm:px-6', bodyClassName)}
          >
            {children}
          </div>

          {footer && (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-gray-200 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  // When set, the reason is required and is passed to onConfirm.
  reason?: { label: string; placeholder?: string };
  // Show the result toast inside onConfirm. The dialog closes when it settles, success or not,
  // so a rejected request never leaves the overlay blocking the page.
  onConfirm: (reason: string) => Promise<unknown> | unknown;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  busyLabel = 'Menghapus...',
  reason,
  onConfirm,
}) => {
  const [busy, setBusy] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();

  useEffect(() => {
    if (open) {
      setReasonText('');
      setReasonError('');
      setBusy(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (busy) return;
    if (reason && !reasonText.trim()) {
      setReasonError(`${reason.label} wajib diisi.`);
      reasonRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await onConfirm(reasonText.trim());
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={busy}
      initialFocusRef={reason ? reasonRef : cancelRef}
      footer={
        <>
          <ModalButton ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </ModalButton>
          <ModalButton variant="destructive" onClick={handleConfirm} busy={busy} busyLabel={busyLabel}>
            {confirmLabel}
          </ModalButton>
        </>
      }
    >
      <p className="text-sm text-gray-700">{description}</p>
      {reason && (
        <div className="mt-4">
          <label htmlFor={reasonId} className="mb-1 block text-sm font-medium text-gray-700">
            {reason.label} <span className="text-red-700" aria-hidden="true">*</span>
            <span className="sr-only">(wajib)</span>
          </label>
          <textarea
            ref={reasonRef}
            id={reasonId}
            value={reasonText}
            onChange={(e) => {
              setReasonText(e.target.value);
              if (reasonError) setReasonError('');
            }}
            rows={3}
            disabled={busy}
            placeholder={reason.placeholder}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? `${reasonId}-error` : undefined}
            className={cn(
              'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-700',
              reasonError ? 'border-red-600' : 'border-gray-300',
            )}
          />
          {reasonError && (
            <p id={`${reasonId}-error`} role="alert" className="mt-1 text-sm text-red-700">
              {reasonError}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

interface ImageDialogProps {
  src: string | null;
  alt: string;
  caption?: string;
  onClose: () => void;
}

export const ImageDialog: React.FC<ImageDialogProps> = ({ src, alt, caption, onClose }) => {
  const returnFocus = useReturnFocus();
  return (
  <Dialog open={!!src} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogPortal>
      <DialogOverlay className="bg-black/80" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        aria-modal="true"
        onOpenAutoFocus={returnFocus.remember}
        onCloseAutoFocus={returnFocus.restore}
        className="fixed inset-0 z-50 m-auto flex h-fit w-fit max-w-[90vw] flex-col items-end gap-2 focus:outline-none"
      >
        <DialogTitle className="sr-only">Pratinjau gambar: {alt}</DialogTitle>
        <DialogPrimitive.Close
          aria-label="Tutup pratinjau"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-white text-gray-900 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <X size={20} aria-hidden="true" />
        </DialogPrimitive.Close>
        {src && <img src={src} alt={alt} className="max-h-[80dvh] max-w-[90vw] rounded-md object-contain" />}
        {caption && <p className="self-center text-center text-sm text-white">{caption}</p>}
      </DialogPrimitive.Content>
    </DialogPortal>
  </Dialog>
  );
};
