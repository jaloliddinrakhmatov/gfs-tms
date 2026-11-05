'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, CreditCard, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { InvoiceStatusBadge } from '@/components/status-badges';
import { Lane } from '@/components/lane';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { hasRole, useAuth } from '@/lib/auth-store';
import { formatDate, formatMoney } from '@/lib/format';
import { useInvoice, useRecordPayment } from '@/lib/queries';
import { paymentSchema, type PaymentFormInput, type PaymentFormValues } from '@/lib/schemas';
import { newIdempotencyKey } from '@/lib/utils';

function PaymentForm({ invoiceId, balanceCents }: { invoiceId: string; balanceCents: number }) {
  const record = useRecordPayment(invoiceId);
  // One key per form session: double-submits and network retries can never double-charge.
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [invoiceId, balanceCents]); // eslint-disable-line react-hooks/exhaustive-deps

  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: balanceCents / 100, method: 'ACH', reference: '' },
  });

  useEffect(() => {
    reset({ amount: balanceCents / 100, method: 'ACH', reference: '' });
  }, [balanceCents, reset]);

  const onSubmit = handleSubmit((v) => {
    const amountCents = Math.round(v.amount * 100);
    if (amountCents > balanceCents) {
      setError('amount', { message: `Cannot exceed open balance of ${formatMoney(balanceCents, { cents: true })}` });
      return;
    }
    record.mutate({ amountCents, method: v.method, reference: v.reference || undefined, idempotencyKey });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="size-4 text-muted-foreground" /> Record payment
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (USD)" error={errors.amount?.message}>
          <Input type="number" step="0.01" inputMode="decimal" aria-invalid={!!errors.amount} {...register('amount')} />
        </Field>
        <Field label="Method">
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Payment method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACH">ACH transfer</SelectItem>
                  <SelectItem value="WIRE">Wire</SelectItem>
                  <SelectItem value="CHECK">Check</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="Reference" className="sm:col-span-2">
          <Input placeholder="Remittance / trace number" {...register('reference')} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Idempotent · safe to retry
        </p>
        <Button type="submit" loading={record.isPending}>
          Apply payment
        </Button>
      </div>
    </form>
  );
}

export function InvoiceDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: inv, isLoading } = useInvoice(id);
  const canPay = hasRole(useAuth((s) => s.user), 'ACCOUNTANT');

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right">
        {isLoading || !inv ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle className="font-mono">{inv.number}</DialogTitle>
                <InvoiceStatusBadge status={inv.status} />
              </div>
              <DialogDescription>
                {inv.customer.name} · issued {formatDate(inv.issuedAt)} · due {formatDate(inv.dueAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 p-5">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <Lane origin={inv.shipment.origin} destination={inv.shipment.destination} />
                  <Link href={`/shipments/${inv.shipment.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                    {inv.shipment.reference}
                  </Link>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {inv.shipment.commodity} · delivered {formatDate(inv.shipment.deliveredAt, 'MMM d, HH:mm')}
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Charges</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Line haul</span>
                    <span className="tabular">{formatMoney(inv.lineHaulCents, { cents: true })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fuel surcharge</span>
                    <span className="tabular">{formatMoney(inv.fuelSurchargeCents, { cents: true })}</span>
                  </div>
                  {inv.accessorialCents !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{inv.accessorialCents > 0 ? 'Accessorials' : 'Late delivery credit'}</span>
                      <span className="tabular">{formatMoney(inv.accessorialCents, { cents: true })}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <span>Total</span>
                    <span className="tabular">{formatMoney(inv.totalCents, { cents: true })}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Paid</span>
                    <span className="tabular">−{formatMoney(inv.paidCents, { cents: true })}</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-muted/60 px-3 py-2 font-semibold">
                    <span>Balance due</span>
                    <span className="tabular">{formatMoney(inv.balanceCents, { cents: true })}</span>
                  </div>
                </div>
              </div>

              {canPay && inv.balanceCents > 0 && inv.status !== 'VOID' && <PaymentForm invoiceId={inv.id} balanceCents={inv.balanceCents} />}
              {inv.status === 'PAID' && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-4" /> Paid in full on {formatDate(inv.paidAt)}
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment history</p>
                {inv.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {inv.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{p.method}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(p.createdAt, 'MMM d, yyyy HH:mm')} {p.reference && `· ${p.reference}`}
                          </p>
                        </div>
                        <span className="font-medium tabular">{formatMoney(p.amountCents, { cents: true })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
