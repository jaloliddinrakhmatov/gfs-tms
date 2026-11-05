'use client';

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  Mail,
  MessageSquarePlus,
  Phone,
  Send,
  Star,
  Truck,
  Undo2,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { EVENT_META } from '@/components/dashboard/activity-feed';
import { RouteMap } from '@/components/map';
import { AssignDialog } from '@/components/shipments/assign-dialog';
import { StatusDialog, useShipmentPermissions } from '@/components/shipments/shipment-actions';
import { InvoiceStatusBadge, ShipmentStatusBadge } from '@/components/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, Progress, Skeleton } from '@/components/ui/misc';
import { hasRole, useAuth } from '@/lib/auth-store';
import { EQUIPMENT, PRIORITY } from '@/lib/constants';
import { useFleet } from '@/lib/fleet-store';
import {
  formatDate,
  formatDuration,
  formatMiles,
  formatMoney,
  formatSmartDate,
  formatWeight,
  metersToMiles,
  timeAgo,
} from '@/lib/format';
import { useAddNote, useShipment } from '@/lib/queries';
import type { ShipmentDetail } from '@/lib/types';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function Stepper({ s }: { s: ShipmentDetail }) {
  const steps = [
    { key: 'CREATED', label: 'Tendered', at: s.createdAt },
    { key: 'ASSIGNED', label: 'Dispatched', at: s.events.find((e) => e.type === 'ASSIGNED')?.createdAt },
    { key: 'PICKED_UP', label: 'Picked up', at: s.pickedUpAt },
    { key: 'DELIVERED', label: 'Delivered', at: s.deliveredAt },
  ];
  const reached = { PENDING: 0, ASSIGNED: 1, IN_TRANSIT: 2, DELIVERED: 3, CANCELLED: -1 }[s.status];
  return (
    <ol className="grid grid-cols-4">
      {steps.map((step, i) => {
        const done = i <= reached;
        const current = i === reached && s.status !== 'DELIVERED';
        return (
          <li key={step.key} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={cn('absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2', i <= reached ? 'bg-primary' : 'bg-border')} />}
            <span
              className={cn(
                'relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                current && 'ring-4 ring-primary/15',
              )}
            >
              {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('mt-2 text-xs font-medium', !done && 'text-muted-foreground')}>{step.label}</span>
            <span className="text-[11px] text-muted-foreground">{step.at ? formatSmartDate(step.at) : '—'}</span>
          </li>
        );
      })}
    </ol>
  );
}

function NoteComposer({ id }: { id: string }) {
  const [text, setText] = useState('');
  const add = useAddNote(id);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) add.mutate(text.trim(), { onSuccess: () => setText('') });
      }}
    >
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note for the team or driver…" maxLength={500} className="min-h-16" />
      <div className="flex justify-end">
        <Button size="sm" type="submit" disabled={!text.trim()} loading={add.isPending}>
          <MessageSquarePlus /> Add note
        </Button>
      </div>
    </form>
  );
}

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useAuth((s) => s.user);
  const { data: s, isLoading, error } = useShipment(id);
  const live = useFleet((st) => st.byShipment[id]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [target, setTarget] = useState<'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | null>(null);
  const perms = useShipmentPermissions(s ?? { status: 'CANCELLED', driver: null });

  if (error) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title={error instanceof ApiError && error.status === 403 ? 'You don’t have access to this load' : 'Load not found'}
          description={error instanceof ApiError ? error.message : undefined}
          action={
            <Button variant="outline" asChild>
              <Link href="/shipments">Back to shipments</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  if (isLoading || !s) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-[460px] xl:col-span-2" />
          <Skeleton className="h-[460px]" />
        </div>
      </div>
    );
  }

  const progress = live?.progress ?? s.progress;
  const remaining = live?.remainingSeconds ?? s.remainingSeconds;
  const ratePerMile = Math.round(s.rateCents / Math.max(1, metersToMiles(s.distanceMeters)));

  return (
    <div className="space-y-5 stagger">
      <Link href="/shipments" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> Shipments
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold tracking-tight">{s.reference}</h1>
            <ShipmentStatusBadge status={s.status} />
            {s.priority === 'EXPEDITED' && (
              <Badge tone="amber">
                <Zap className="size-3" /> Expedited
              </Badge>
            )}
            {s.isLate && (
              <Badge tone="red">
                <AlertTriangle className="size-3" /> {s.status === 'DELIVERED' ? 'Delivered late' : 'ETA after deadline'}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {s.origin.name}, {s.origin.state} → {s.destination.name}, {s.destination.state} · {formatMiles(s.distanceMeters)} · {s.customer.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {perms.canUnassign && (
            <Button variant="outline" onClick={() => setTarget('PENDING')}>
              <Undo2 /> Unassign
            </Button>
          )}
          {perms.canCancel && (
            <Button variant="outline" onClick={() => setTarget('CANCELLED')}>
              <XCircle /> Cancel
            </Button>
          )}
          {perms.canAssign && (
            <Button variant={s.status === 'PENDING' ? 'default' : 'outline'} onClick={() => setAssignOpen(true)}>
              <Send /> {s.status === 'ASSIGNED' ? 'Reassign' : 'Dispatch'}
            </Button>
          )}
          {perms.canPickUp && (
            <Button onClick={() => setTarget('IN_TRANSIT')}>
              <Truck /> Mark picked up
            </Button>
          )}
          {perms.canDeliver && (
            <Button variant="success" onClick={() => setTarget('DELIVERED')}>
              <CheckCircle2 /> Mark delivered
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="relative h-[380px]">
              <RouteMap route={s.route} origin={s.origin} destination={s.destination} live={s.status === 'IN_TRANSIT' ? live : null} progress={progress} />
              {s.status === 'IN_TRANSIT' && (
                <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Live · {s.vehicle?.unitNumber}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular">{live ? `${live.speedMph} mph` : '—'}</p>
                  <p className="text-xs text-muted-foreground">{formatDuration(remaining)} to destination</p>
                </div>
              )}
            </div>
            <div className="space-y-5 border-t border-border p-5">
              <Stepper s={s} />
              {s.status === 'IN_TRANSIT' && (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs tabular">
                    <span className="font-medium">{Math.round(progress * 100)}% of route complete</span>
                    <span className="text-muted-foreground">
                      {formatMiles(s.distanceMeters * (1 - progress))} remaining · ETA {formatSmartDate(new Date(Date.now() + remaining * 1000))}
                    </span>
                  </div>
                  <Progress value={progress * 100} tone={s.isLate ? 'danger' : 'primary'} className="h-2" />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {(hasRole(user, 'DISPATCHER') || perms.canDeliver || perms.canPickUp) && <NoteComposer id={s.id} />}
              <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-[13px] before:w-px before:bg-border">
                {s.events.map((e) => {
                  const meta = EVENT_META[e.type];
                  const Icon = meta.icon;
                  return (
                    <li key={e.id} className="relative flex gap-3">
                      <span className={cn('relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card', meta.className)}>
                        <Icon className="size-3.5" />
                      </span>
                      <div className={cn('min-w-0 flex-1 pt-0.5', e.type === 'NOTE' && 'rounded-lg bg-muted/60 px-3 py-2')}>
                        <p className="text-[13px]">{e.message}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {e.actor?.name ?? 'System'} · {formatDate(e.createdAt, 'MMM d, HH:mm')} · {timeAgo(e.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle>Load details</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <Row label="Commodity">{s.commodity}</Row>
              <Row label="Equipment">{EQUIPMENT[s.equipment]}</Row>
              <Row label="Service">{PRIORITY[s.priority]}</Row>
              <Row label="Weight">{formatWeight(s.weightLbs)}</Row>
              <Row label="Distance">
                {formatMiles(s.distanceMeters)} <span className="font-normal text-muted-foreground">· {formatDuration(s.durationSeconds)}</span>
              </Row>
              <Row label="All-in rate">
                <span className="tabular">{formatMoney(s.rateCents)}</span>{' '}
                <span className="font-normal text-muted-foreground tabular">· {formatMoney(ratePerMile, { cents: true })}/mi</span>
              </Row>
              {s.notes && (
                <div className="py-2 text-[13px]">
                  <p className="text-muted-foreground">Notes</p>
                  <p className="mt-1">{s.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" /> Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <Row label="Pickup appointment">{formatSmartDate(s.pickupAt)}</Row>
              <Row label="Picked up">{formatSmartDate(s.pickedUpAt)}</Row>
              <Row label="Deliver by">{formatSmartDate(s.deliveryBy)}</Row>
              <Row label={s.status === 'DELIVERED' ? 'Delivered' : 'ETA'}>
                <span className={cn(s.isLate && 'text-rose-600 dark:text-rose-400')}>
                  {s.status === 'DELIVERED' ? formatSmartDate(s.deliveredAt) : s.status === 'IN_TRANSIT' ? formatSmartDate(new Date(Date.now() + remaining * 1000)) : '—'}
                </span>
              </Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Driver & equipment</CardTitle>
            </CardHeader>
            <CardContent>
              {s.driver ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.driver.name} className="size-10 text-xs" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.driver.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="size-3 fill-amber-400 text-amber-400" /> {s.driver.rating.toFixed(1)} rating
                      </p>
                    </div>
                    <Button variant="outline" size="icon-sm" asChild>
                      <a href={`tel:${s.driver.phone}`} aria-label="Call driver">
                        <Phone />
                      </a>
                    </Button>
                  </div>
                  {s.vehicle && (
                    <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
                      <Truck className="size-4 text-muted-foreground" />
                      <div className="text-[13px]">
                        <p className="font-mono font-medium">{s.vehicle.unitNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.vehicle.make} {s.vehicle.model} · {s.vehicle.plate}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">Not dispatched yet</p>
                  {perms.canAssign && (
                    <Button size="sm" className="mt-3" onClick={() => setAssignOpen(true)}>
                      <Send /> Dispatch now
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" /> {s.customer.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-[13px]">
              <p>{s.customer.contactName}</p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5" /> {s.customer.email}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-3.5" /> {s.customer.phone}
              </p>
            </CardContent>
          </Card>

          {s.invoice && hasRole(user, 'ACCOUNTANT', 'DISPATCHER') && (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft">
                  <FileText className="size-4 text-primary" />
                </span>
                <div className="flex-1">
                  <p className="font-mono text-[13px] font-medium">{s.invoice.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(s.invoice.totalCents, { cents: true })} · due {formatDate(s.invoice.dueAt)}
                  </p>
                </div>
                <InvoiceStatusBadge status={s.invoice.status} />
              </CardContent>
              <div className="border-t border-border px-4 py-2">
                <Link href={`/billing?search=${s.invoice.number}`} className="text-xs font-medium text-primary hover:underline">
                  Open in billing →
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>

      {perms.canAssign && <AssignDialog shipment={s} open={assignOpen} onOpenChange={setAssignOpen} />}
      <StatusDialog shipment={s} target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
