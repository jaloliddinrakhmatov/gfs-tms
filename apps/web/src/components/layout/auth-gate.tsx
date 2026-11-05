'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { refreshSession } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { LogoMark } from '@/components/logo';

/** Restores the in-memory session from the httpOnly refresh cookie on hard reloads. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'loading') return;
    void refreshSession().then((ok) => {
      if (!ok) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });
  }, [status, router, pathname]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="size-11 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
