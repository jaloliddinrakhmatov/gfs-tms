'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  side,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'right' }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[3px] data-[state=open]:animate-[fade-in_0.25s_ease-out] data-[state=closed]:animate-[fade-out_0.18s_ease-in]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 border border-border bg-card shadow-2xl outline-none',
          side === 'right'
            ? 'inset-y-0 right-0 h-full w-full max-w-xl overflow-y-auto border-y-0 border-r-0 data-[state=open]:animate-[slide-in_0.45s_var(--ease-out-expo)] data-[state=closed]:animate-[slide-out_0.25s_ease-in]'
            : 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl data-[state=open]:animate-[dialog-in_0.35s_var(--ease-out-expo)] data-[state=closed]:animate-[dialog-out_0.15s_ease-in]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1 border-b border-border p-5 pr-12', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-base font-semibold tracking-tight', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3 rounded-b-xl', className)} {...props} />;
}
