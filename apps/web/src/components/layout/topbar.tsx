'use client';

import { Bell, FileText, LogOut, Menu, Moon, Package, Search, Sun, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, Kbd } from '@/components/ui/misc';
import { logout } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { ROLE_LABEL } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import { useUi } from '@/lib/ui-store';

function GlobalSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      className="relative hidden w-full max-w-sm md:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = ref.current?.value.trim();
        router.push(q ? `/shipments?search=${encodeURIComponent(q)}` : '/shipments');
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        placeholder="Search loads, customers, cities…"
        className="h-9 w-full rounded-lg border border-transparent bg-muted pl-9 pr-14 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-ring focus:bg-card focus:ring-3 focus:ring-ring/15"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2">
        <Kbd>⌘K</Kbd>
      </span>
    </form>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(dark ? 'light' : 'dark')}>
      <span key={dark ? 'sun' : 'moon'} className="flex animate-[spin-in_0.5s_var(--ease-spring)]">
        {dark ? <Sun /> : <Moon />}
      </span>
    </Button>
  );
}

function Notifications() {
  const { notifications, unread, markAllRead } = useUi();
  return (
    <DropdownMenu onOpenChange={(o) => o && markAllRead()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {unread > 0 && (
            <span
              key={unread}
              className="absolute right-1.5 top-1.5 flex size-4 animate-[badge-pop_0.45s_var(--ease-out-expo)] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Live activity</p>
          <p className="text-xs text-muted-foreground">Events streamed from the network in real time</p>
        </div>
        <div className="max-h-96 overflow-y-auto p-1 scrollbar-thin">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No new events yet — deliveries will show up here.</p>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem key={n.id} asChild className="items-start gap-3 py-2">
                <Link href={n.href ?? '#'}>
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-soft">
                    {n.kind === 'invoice' ? <FileText className="!text-primary" /> : <Package className="!text-primary" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{n.title}</span>
                    {n.description && <span className="block truncate text-xs text-muted-foreground">{n.description}</span>}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(new Date(n.at))}</span>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const user = useAuth((s) => s.user)!;
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2.5 rounded-lg p-1 pr-2 outline-none transition hover:bg-muted">
        <Avatar name={user.name} />
        <div className="hidden text-left leading-tight sm:block">
          <p className="text-[13px] font-medium">{user.name}</p>
          <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <p className="font-medium text-foreground">{user.name}</p>
          <p>{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          destructive
          onSelect={async () => {
            await logout();
            router.replace('/login');
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  const setMobileNav = useUi((s) => s.setMobileNav);
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
        <Menu />
      </Button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Notifications />
        <div className="mx-2 h-6 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
