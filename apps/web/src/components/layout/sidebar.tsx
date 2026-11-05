'use client';

import { BookOpen, X } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/logo';
import { hasRole, useAuth } from '@/lib/auth-store';
import { useFleet } from '@/lib/fleet-store';
import { useShipmentCounts } from '@/lib/queries';
import { useUi } from '@/lib/ui-store';
import { cn } from '@/lib/utils';
import { NAV } from './nav';

function SidebarBody({ onNavigate, layoutId }: { onNavigate?: () => void; layoutId: string }) {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const connected = useFleet((s) => s.connected);
  const moving = useFleet((s) => Object.keys(s.positions).length);
  const { data: counts } = useShipmentCounts();

  const items = NAV.filter((n) => hasRole(user, ...n.roles));
  const badge: Record<string, number | undefined> = {
    '/shipments': user?.role === 'DRIVER' ? undefined : counts?.PENDING,
    '/tracking': moving || undefined,
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-5 text-white">
        <Logo />
      </div>

      <nav className="stagger flex-1 space-y-0.5 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">Operations</p>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                active ? 'text-white' : 'hover:bg-sidebar-accent/40 hover:text-white',
              )}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-lg bg-sidebar-accent shadow-[inset_0_0_0_1px_rgb(255_255_255/0.04)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                >
                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-indigo-400 shadow-[0_0_12px_2px] shadow-indigo-500/60" />
                </motion.span>
              )}
              <Icon
                className={cn(
                  'relative size-[18px] transition-transform duration-300 group-hover:scale-110',
                  active ? 'text-indigo-300' : 'text-sidebar-muted group-hover:text-white',
                )}
              />
              <span className="relative flex-1">{user?.role === 'DRIVER' && item.driverLabel ? item.driverLabel : item.label}</span>
              {badge[item.href] ? (
                <span
                  key={badge[item.href]}
                  className={cn(
                    'relative animate-[badge-pop_0.4s_var(--ease-out-expo)] rounded-full px-1.5 py-px text-[10px] font-semibold tabular',
                    item.href === '/tracking' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/80',
                  )}
                >
                  {badge[item.href]}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-4">
        <a
          href={`${process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'}/api/docs`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-sidebar-muted transition hover:bg-sidebar-accent/60 hover:text-white"
        >
          <BookOpen className="size-4" /> API documentation
        </a>
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <span className="relative flex size-2">
            {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={cn('relative inline-flex size-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-zinc-500')} />
          </span>
          <div className="text-xs leading-tight">
            <p className="font-medium text-white">{connected ? 'Realtime connected' : 'Connecting…'}</p>
            <p className="text-sidebar-muted">{moving} trucks reporting GPS</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const open = useUi((s) => s.mobileNavOpen);
  const setOpen = useUi((s) => s.setMobileNav);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <SidebarBody layoutId="nav-active" />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-[fade-in_0.25s_ease-out] bg-black/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 animate-[slide-in-left_0.4s_var(--ease-out-expo)] shadow-2xl">
            <button className="absolute right-3 top-5 z-10 text-white/70" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="size-5" />
            </button>
            <SidebarBody layoutId="nav-active-mobile" onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
