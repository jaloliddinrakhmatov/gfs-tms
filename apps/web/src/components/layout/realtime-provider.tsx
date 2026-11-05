'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { refreshSession } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { SHIPMENT_STATUS } from '@/lib/constants';
import { useFleet } from '@/lib/fleet-store';
import { formatMoney } from '@/lib/format';
import type { ShipmentStatus, VehiclePosition } from '@/lib/types';
import { useUi } from '@/lib/ui-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

/**
 * Owns the Socket.IO connection for the signed-in session: streams fleet positions into
 * the fleet store and turns domain events into cache invalidations + notifications.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const authenticated = useAuth((s) => s.status === 'authenticated');

  useEffect(() => {
    if (!authenticated) return;
    const { replace, setConnected } = useFleet.getState();
    const { notify } = useUi.getState();

    // `auth` as a callback is re-evaluated on every (re)connect, so it always sends a fresh token.
    const socket: Socket = io(WS_URL, {
      // Prefer WebSocket, but fall back to long-polling if something (proxy, extension) blocks it
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      auth: (cb) => cb({ token: useAuth.getState().accessToken }),
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });

    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      // Coalesce bursts of events into a single refetch
      if (invalidateTimer) return;
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        void qc.invalidateQueries({ queryKey: ['shipments'] });
        void qc.invalidateQueries({ queryKey: ['analytics'] });
        void qc.invalidateQueries({ queryKey: ['fleet'] });
      }, 400);
    };

    // Access tokens live 15 minutes; any reconnect after that (sleep, Wi-Fi drop, API restart)
    // is rejected at the handshake. Refresh once and retry — Socket.IO does not auto-retry
    // middleware rejections.
    let refreshingToken = false;
    const reauth = async () => {
      if (refreshingToken) return;
      refreshingToken = true;
      try {
        if (await refreshSession()) socket.connect();
      } finally {
        refreshingToken = false;
      }
    };

    socket.on('connect', () => setConnected(true));
    socket.on('connect_error', (err) => {
      setConnected(false);
      if (err.message === 'Unauthorized') void reauth();
    });
    socket.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') void reauth();
    });

    // Background tabs get their timers throttled and may miss heartbeats; reconnect on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !socket.connected && !socket.active) socket.connect();
    };
    document.addEventListener('visibilitychange', onVisible);
    socket.on('fleet:positions', (batch: VehiclePosition[]) => replace(batch));

    socket.on('shipment:updated', (e: { id: string; reference: string; status: ShipmentStatus }) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ['shipments', 'detail', e.id] });
      if (e.status === 'DELIVERED' || e.status === 'IN_TRANSIT') {
        const title = `${e.reference} ${e.status === 'DELIVERED' ? 'delivered' : 'picked up'}`;
        notify({ kind: 'shipment', title, description: SHIPMENT_STATUS[e.status].label, href: `/shipments/${e.id}` });
        if (e.status === 'DELIVERED') toast.success(title, { description: 'POD captured · invoice queued' });
      }
    });

    socket.on('invoice:created', (e: { id: string; number: string; totalCents: number; customerName: string }) => {
      void qc.invalidateQueries({ queryKey: ['invoices'] });
      notify({
        kind: 'invoice',
        title: `Invoice ${e.number} issued`,
        description: `${e.customerName} · ${formatMoney(e.totalCents)}`,
        href: '/billing',
      });
    });

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      document.removeEventListener('visibilitychange', onVisible);
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [authenticated, qc]);

  return <>{children}</>;
}
