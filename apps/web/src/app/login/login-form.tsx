'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { homeFor } from '@/components/layout/nav';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ApiError, login } from '@/lib/api';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, ROLE_LABEL } from '@/lib/constants';
import { loginSchema, type LoginValues } from '@/lib/schemas';
import { cn } from '@/lib/utils';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'dispatcher@gfs.demo', password: DEMO_PASSWORD },
  });
  const email = watch('email');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const { user } = await login(values.email, values.password);
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(user.role));
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to reach the server');
    }
  });

  return (
    <form onSubmit={onSubmit} className="stagger mt-8 space-y-4" noValidate>
      {serverError && (
        <div role="alert" className="animate-[pop-in_0.3s_var(--ease-out-expo)] rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </div>
      )}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} className="h-10" {...register('email')} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            className="h-10 pr-10"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Sign in {!isSubmitting && <ArrowRight />}
      </Button>

      <div className="pt-4">
        <div className="mb-3 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> Demo accounts <span className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setValue('email', a.email, { shouldValidate: true });
                setValue('password', DEMO_PASSWORD, { shouldValidate: true });
              }}
              className={cn(
                'cursor-pointer rounded-lg border px-3 py-2 text-left transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-soft/40 hover:shadow-md hover:shadow-primary/10 active:translate-y-0',
                email === a.email ? 'border-primary/50 bg-primary-soft/60 ring-2 ring-primary/10' : 'border-border',
              )}
            >
              <p className="text-[13px] font-medium">{ROLE_LABEL[a.role]}</p>
              <p className="text-[11px] text-muted-foreground">{a.hint}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Password for all accounts: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{DEMO_PASSWORD}</code>
        </p>
      </div>
    </form>
  );
}
