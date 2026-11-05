'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, addHours, format, setHours, setMinutes } from 'date-fns';
import { ArrowLeftRight, Info, Loader2, Snowflake, Truck, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { RouteMap } from '@/components/map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDuration, formatMoney, formatNumber } from '@/lib/format';
import { useCreateShipment, useCustomerOptions, useLocations, useQuote } from '@/lib/queries';
import { shipmentSchema, type ShipmentFormInput, type ShipmentFormValues } from '@/lib/schemas';
import type { Equipment, Priority } from '@/lib/types';
import { cn } from '@/lib/utils';

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

function defaults(): ShipmentFormInput {
  const pickup = setMinutes(setHours(addDays(new Date(), 1), 8), 0);
  return {
    customerId: '',
    originCode: '',
    destinationCode: '',
    equipment: 'DRY_VAN',
    priority: 'STANDARD',
    commodity: '',
    weightLbs: '' as unknown as number,
    rate: '',
    pickupAt: toLocalInput(pickup),
    deliveryBy: toLocalInput(addHours(pickup, 48)),
    notes: '',
  };
}

const EQUIPMENT_OPTIONS: { value: Equipment; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'DRY_VAN', label: 'Dry van', desc: "53' · 45,000 lbs", icon: Truck },
  { value: 'REEFER', label: 'Reefer', desc: 'Temp-controlled +15%', icon: Snowflake },
  { value: 'FLATBED', label: 'Flatbed', desc: "48' open deck +10%", icon: ArrowLeftRight },
];

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div className={cn('grid gap-2', options.length === 3 ? 'grid-cols-3' : 'grid-cols-2')} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 text-left transition',
              active ? 'border-primary bg-primary-soft/50 ring-3 ring-primary/10' : 'border-border hover:border-primary/30 hover:bg-muted/50',
            )}
          >
            <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-[13px] font-medium">{o.label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{o.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ShipmentForm() {
  const router = useRouter();
  const { data: locations } = useLocations();
  const { data: customers } = useCustomerOptions();
  const create = useCreateShipment();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ShipmentFormInput, unknown, ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: defaults(),
    mode: 'onTouched',
  });

  const [originCode, destinationCode, equipment, priority] = useWatch({
    control,
    name: ['originCode', 'destinationCode', 'equipment', 'priority'],
  });
  const quote = useQuote({ originCode, destinationCode, equipment, priority });
  const origin = locations?.find((l) => l.code === originCode);
  const destination = locations?.find((l) => l.code === destinationCode);

  const onSubmit = handleSubmit((v) => {
    create.mutate(
      {
        customerId: v.customerId,
        originCode: v.originCode,
        destinationCode: v.destinationCode,
        equipment: v.equipment,
        priority: v.priority,
        commodity: v.commodity,
        weightLbs: v.weightLbs,
        rateCents: v.rate === '' || v.rate === undefined ? undefined : Math.round(v.rate * 100),
        pickupAt: new Date(v.pickupAt).toISOString(),
        deliveryBy: new Date(v.deliveryBy).toISOString(),
        notes: v.notes || undefined,
      },
      { onSuccess: (s) => router.push(`/shipments/${s.id}`) },
    );
  });

  const locationSelect = (name: 'originCode' | 'destinationCode', placeholder: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger aria-invalid={!!errors[name]} aria-label={placeholder}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {locations?.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}, {l.state} <span className="ml-1 font-mono text-[11px] text-muted-foreground">{l.code}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Lane & customer</CardTitle>
              <CardDescription>Where the freight moves and who is paying for it.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" error={errors.customerId?.message} className="sm:col-span-2">
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={!!errors.customerId} aria-label="Customer">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} <span className="ml-1 text-xs text-muted-foreground">Net {c.paymentTermsDays}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Origin" error={errors.originCode?.message}>
              {locationSelect('originCode', 'Pickup terminal')}
            </Field>
            <div className="relative">
              <Field label="Destination" error={errors.destinationCode?.message}>
                {locationSelect('destinationCode', 'Delivery terminal')}
              </Field>
              <button
                type="button"
                onClick={() => {
                  setValue('originCode', destinationCode, { shouldValidate: true });
                  setValue('destinationCode', originCode, { shouldValidate: true });
                }}
                disabled={!originCode && !destinationCode}
                className="absolute -left-[22px] top-[30px] hidden size-7 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:text-foreground disabled:opacity-0 sm:flex"
                aria-label="Swap origin and destination"
              >
                <ArrowLeftRight className="size-3.5" />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Freight</CardTitle>
              <CardDescription>Equipment, service level and cargo details.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Equipment">
              <Controller control={control} name="equipment" render={({ field }) => <Segmented value={field.value} onChange={field.onChange} options={EQUIPMENT_OPTIONS} />} />
            </Field>
            <Field label="Service level">
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Segmented<Priority>
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'STANDARD', label: 'Standard', desc: 'Best available capacity', icon: Truck },
                      { value: 'EXPEDITED', label: 'Expedited', desc: 'Priority dispatch +25%', icon: Zap },
                    ]}
                  />
                )}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Commodity" htmlFor="commodity" error={errors.commodity?.message}>
                <Input id="commodity" placeholder="e.g. Packaged foods" aria-invalid={!!errors.commodity} {...register('commodity')} />
              </Field>
              <Field label="Weight (lbs)" htmlFor="weightLbs" error={errors.weightLbs?.message}>
                <Input id="weightLbs" type="number" inputMode="numeric" placeholder="42,000" aria-invalid={!!errors.weightLbs} {...register('weightLbs')} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Schedule & rate</CardTitle>
              <CardDescription>Appointment windows and the agreed all-in rate.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Pickup" htmlFor="pickupAt" error={errors.pickupAt?.message}>
              <Input id="pickupAt" type="datetime-local" aria-invalid={!!errors.pickupAt} {...register('pickupAt')} />
            </Field>
            <Field label="Deliver by" htmlFor="deliveryBy" error={errors.deliveryBy?.message}>
              <Input id="deliveryBy" type="datetime-local" aria-invalid={!!errors.deliveryBy} {...register('deliveryBy')} />
            </Field>
            <Field
              label="All-in rate (USD)"
              htmlFor="rate"
              error={errors.rate?.message}
              hint={quote.data ? `Leave empty to use the system quote of ${formatMoney(quote.data.totalCents)}` : 'Leave empty to use the system quote'}
              className="sm:col-span-2"
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="rate"
                  type="number"
                  step="1"
                  inputMode="decimal"
                  className="pl-7"
                  placeholder={quote.data ? String(Math.round(quote.data.totalCents / 100)) : '2,850'}
                  aria-invalid={!!errors.rate}
                  {...register('rate')}
                />
              </div>
            </Field>
            <Field label="Notes for driver" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" placeholder="Dock hours, appointment numbers, special handling…" {...register('notes')} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5 xl:sticky xl:top-22 xl:self-start">
        <Card className="overflow-hidden">
          <div className="h-64 border-b border-border">
            {origin && destination && quote.data ? (
              <RouteMap route={quote.data.route} origin={origin} destination={destination} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/40 text-center text-sm text-muted-foreground">
                {quote.isFetching ? <Loader2 className="size-5 animate-spin" /> : <Info className="size-5" />}
                {quote.isFetching ? 'Calculating road route…' : 'Pick an origin and destination to preview the route'}
              </div>
            )}
          </div>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Instant quote</p>
              {quote.data && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {quote.data.routeSource === 'estimate' ? 'Estimated route' : 'Road route'}
                </span>
              )}
            </div>
            {quote.isLoading && quote.fetchStatus !== 'idle' ? (
              <div className="space-y-2">
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
                <Skeleton className="h-8" />
              </div>
            ) : quote.data ? (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 pb-2">
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Distance</p>
                    <p className="font-semibold tabular">{formatNumber(quote.data.miles)} mi</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Drive time</p>
                    <p className="font-semibold tabular">{formatDuration(quote.data.durationSeconds)}</p>
                  </div>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Line haul</span>
                  <span className="tabular text-foreground">{formatMoney(quote.data.lineHaulCents, { cents: true })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Fuel surcharge (18%)</span>
                  <span className="tabular text-foreground">{formatMoney(quote.data.fuelSurchargeCents, { cents: true })}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="font-medium">All-in</span>
                  <span className="text-right">
                    <span className="block text-xl font-semibold tabular">{formatMoney(quote.data.totalCents, { cents: true })}</span>
                    <span className="text-xs text-muted-foreground tabular">{formatMoney(quote.data.ratePerMileCents, { cents: true })} / mile</span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Quotes use live road distance, equipment and service level.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={create.isPending}>
            Create load
          </Button>
        </div>
      </div>
    </form>
  );
}
