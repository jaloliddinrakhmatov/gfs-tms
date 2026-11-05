'use client';

import { CheckCircle2, Eye, MoreHorizontal, Send, Truck, Undo2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, Input } from '@/components/ui/input';
import { hasRole, useAuth } from '@/lib/auth-store';
import { useUpdateShipmentStatus } from '@/lib/queries';
import type { ShipmentStatus } from '@/lib/types';
import { AssignDialog, type AssignableShipment } from './assign-dialog';

type Target = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export function useShipmentPermissions(s: { status: ShipmentStatus; driver: { id: string } | null }) {
  const user = useAuth((st) => st.user);
  const dispatcher = hasRole(user, 'DISPATCHER');
  const ownLoad = user?.role === 'DRIVER' && user.driverId === s.driver?.id;
  return {
    canAssign: dispatcher && (s.status === 'PENDING' || s.status === 'ASSIGNED'),
    canPickUp: (dispatcher || ownLoad) && s.status === 'ASSIGNED',
    canDeliver: (dispatcher || ownLoad) && s.status === 'IN_TRANSIT',
    canUnassign: dispatcher && s.status === 'ASSIGNED',
    canCancel: dispatcher && (s.status === 'PENDING' || s.status === 'ASSIGNED'),
  };
}

/** Confirmation for state transitions; cancellation and unassign capture a reason for the audit log. */
export function StatusDialog({
  shipment,
  target,
  onClose,
}: {
  shipment: { id: string; reference: string };
  target: Target | null;
  onClose: () => void;
}) {
  const mutation = useUpdateShipmentStatus(shipment.id);
  const [reason, setReason] = useState('');
  const copy: Record<Target, { title: string; body: string; cta: string; destructive?: boolean; reason?: boolean }> = {
    IN_TRANSIT: { title: 'Confirm pickup', body: 'The truck will start reporting live GPS on the tracking map.', cta: 'Mark picked up' },
    DELIVERED: { title: 'Confirm delivery', body: 'Proof of delivery is recorded and an invoice is generated automatically.', cta: 'Mark delivered' },
    PENDING: { title: 'Return to load board', body: 'Driver and truck will be released for other loads.', cta: 'Unassign', reason: true },
    CANCELLED: { title: 'Cancel load', body: 'This cannot be undone. Assigned resources will be released.', cta: 'Cancel load', destructive: true, reason: true },
  };
  const c = target ? copy[target] : null;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {c && target && (
          <>
            <DialogHeader>
              <DialogTitle>
                {c.title} · {shipment.reference}
              </DialogTitle>
              <DialogDescription>{c.body}</DialogDescription>
            </DialogHeader>
            {c.reason && (
              <div className="p-5">
                <Field label="Reason (optional)">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Shipper rescheduled" maxLength={300} />
                </Field>
              </div>
            )}
            <DialogFooter className={c.reason ? '' : 'mt-4'}>
              <Button variant="outline" onClick={onClose}>
                Back
              </Button>
              <Button
                variant={c.destructive ? 'destructive' : target === 'DELIVERED' ? 'success' : 'default'}
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate(
                    { status: target, reason: reason.trim() || undefined },
                    { onSuccess: () => { setReason(''); onClose(); } },
                  )
                }
              >
                {c.cta}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ShipmentRowActions({ shipment }: { shipment: AssignableShipment & { status: ShipmentStatus } }) {
  const p = useShipmentPermissions(shipment);
  const [assignOpen, setAssignOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const any = p.canAssign || p.canPickUp || p.canDeliver || p.canCancel;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${shipment.reference}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/shipments/${shipment.id}`}>
              <Eye /> View details
            </Link>
          </DropdownMenuItem>
          {any && <DropdownMenuSeparator />}
          {p.canAssign && (
            <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
              <Send /> {shipment.status === 'ASSIGNED' ? 'Reassign' : 'Dispatch'}
            </DropdownMenuItem>
          )}
          {p.canPickUp && (
            <DropdownMenuItem onSelect={() => setTarget('IN_TRANSIT')}>
              <Truck /> Mark picked up
            </DropdownMenuItem>
          )}
          {p.canDeliver && (
            <DropdownMenuItem onSelect={() => setTarget('DELIVERED')}>
              <CheckCircle2 /> Mark delivered
            </DropdownMenuItem>
          )}
          {p.canUnassign && (
            <DropdownMenuItem onSelect={() => setTarget('PENDING')}>
              <Undo2 /> Return to load board
            </DropdownMenuItem>
          )}
          {p.canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setTarget('CANCELLED')}>
                <XCircle /> Cancel load
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {p.canAssign && <AssignDialog shipment={shipment} open={assignOpen} onOpenChange={setAssignOpen} />}
      <StatusDialog shipment={shipment} target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
