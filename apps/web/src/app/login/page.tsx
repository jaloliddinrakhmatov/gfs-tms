import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';
import { NetworkArt } from './network-art';
import { Logo } from '@/components/logo';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="animate-[rise-in_0.6s_var(--ease-out-expo)_backwards]">
          <Logo />
        </div>
        <div className="stagger mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your dispatch console.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} GFS Logistics · Demo environment</p>
      </div>
      <NetworkArt />
    </div>
  );
}
