'use client';

import {
  ArrowRight,
  CircleDollarSign,
  Clock,
  Gauge,
  MapPinned,
  PackageCheck,
  Plus,
  Route,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AnimatedNumber } from '@/components/fx/animated-number';
import { Reveal } from '@/components/fx/reveal';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { KpiCard, KpiSkeleton } from '@/components/dashboard/kpi-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { StatusBreakdown } from '@/components/dashboard/status-breakdown';
import { homeFor } from '@/components/layout/nav';
import { FleetMap } from '@/components/map';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, Skeleton } from '@/components/ui/misc';
import { hasRole, useAuth } from '@/lib/auth-store';
import { useFleet } from '@/lib/fleet-store';
import { formatMoney, formatNumber } from '@/lib/format';
import { useOverview } from '@/lib/queries';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const user = useAuth((s) => s.user)!;
  const router = useRouter();
  const { data, isLoading } = useOverview();
  const moving = useFleet((s) => Object.keys(s.positions).length);
  const canDispatch = hasRole(user, 'DISPATCHER');

  useEffect(() => {
    if (user.role === 'DRIVER') router.replace(homeFor(user.role));
  }, [user.role, router]);

  const k = data?.kpis;
  const series = data?.revenueSeries ?? [];

  return (
    <div className="space-y-6 stagger">
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' · Network overview for the last 30 days'}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/tracking">
                <MapPinned /> Live map
              </Link>
            </Button>
            {canDispatch && (
              <Button asChild>
                <Link href="/shipments/new">
                  <Plus /> New load
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {isLoading || !k ? (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Revenue (30d)" value={<AnimatedNumber value={k.revenue30dCents} format={(v) => formatMoney(v, { compact: true })} />} icon={CircleDollarSign} change={k.revenueChangePct} hint="vs prior 30d" accent="indigo" />
            <KpiCard label="Loads delivered" value={<AnimatedNumber value={k.delivered30d} format={(v) => formatNumber(Math.round(v))} />} icon={PackageCheck} change={k.deliveredChangePct} hint="vs prior 30d" accent="emerald" />
            <KpiCard label="On-time delivery" value={<AnimatedNumber value={k.onTimeRate} format={(v) => `${v.toFixed(1)}%`} />} icon={Clock} change={k.onTimeChangePts} changeSuffix=" pts" hint="target 95%" accent="sky" />
            <KpiCard label="In transit now" value={<AnimatedNumber value={k.inTransit} />} icon={Truck} hint={`${k.awaitingDispatch} awaiting dispatch`} accent="violet" />
            <KpiCard label="Avg rate / mile" value={<AnimatedNumber value={k.ratePerMileCents} format={(v) => formatMoney(v, { cents: true })} />} icon={Route} change={k.ratePerMileChangePct} hint="all-in" accent="amber" />
            <KpiCard
              label="Fleet utilization"
              value={<AnimatedNumber value={k.fleetUtilization} format={(v) => `${Math.round(v)}%`} />}
              icon={Gauge}
              hint={`${k.activeVehicles}/${k.totalVehicles} trucks on loads`}
              accent="rose"
            />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Revenue & volume</CardTitle>
              <CardDescription>Delivered loads per day, all-in linehaul + fuel</CardDescription>
            </div>
            {k && (
              <div className="text-right">
                <p className="text-lg font-semibold tabular">
                  <AnimatedNumber value={k.revenue30dCents} format={(v) => formatMoney(v)} duration={1.6} />
                </p>
                <p className="text-xs text-muted-foreground">Outstanding AR {formatMoney(k.outstandingCents, { compact: true })}</p>
              </div>
            )}
          </CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-[260px] w-full" /> : <div className="chart-reveal"><RevenueChart data={series} /></div>}</CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                Live fleet
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              </CardTitle>
              <CardDescription>{moving} trucks streaming GPS</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tracking">
                Open <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <div className="relative min-h-64 flex-1 border-t border-border">
            <FleetMap compact />
          </div>
        </Card>
      </div>

      <Reveal className="no-stagger grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Load pipeline</CardTitle>
              <CardDescription>Current status across the network</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{data ? <StatusBreakdown counts={data.statusCounts} /> : <Skeleton className="h-36" />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Top lanes</CardTitle>
              <CardDescription>By revenue, last 90 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="stagger space-y-3.5">
            {!data
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)
              : data.topLanes.map((l) => {
                  const max = data.topLanes[0]?.revenueCents || 1;
                  return (
                    <div key={`${l.origin.code}-${l.destination.code}`}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="truncate font-medium">
                          {l.origin.name} <span className="text-muted-foreground">→</span> {l.destination.name}
                        </span>
                        <span className="shrink-0 font-medium tabular">{formatMoney(l.revenueCents, { compact: true })}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={(l.revenueCents / max) * 100} className="h-1" />
                        <span className="w-28 shrink-0 text-right text-[11px] text-muted-foreground tabular">
                          {l.loads} loads · {formatMoney(l.ratePerMileCents, { cents: true })}/mi
                        </span>
                      </div>
                    </div>
                  );
                })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Dispatch and driver events</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="max-h-[340px] overflow-y-auto scrollbar-thin">
            {data ? <ActivityFeed items={data.recentActivity} /> : <Skeleton className="h-60" />}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
