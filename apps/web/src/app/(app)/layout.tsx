import { AuthGate } from '@/components/layout/auth-gate';
import { RealtimeProvider } from '@/components/layout/realtime-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <RealtimeProvider>
        <Sidebar />
        <div className="lg:pl-60">
          <Topbar />
          <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">{children}</main>
        </div>
      </RealtimeProvider>
    </AuthGate>
  );
}
