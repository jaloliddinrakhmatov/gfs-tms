import { create } from 'zustand';

export interface Notification {
  id: string;
  title: string;
  description?: string;
  href?: string;
  kind: 'shipment' | 'invoice';
  at: number;
}

interface UiState {
  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;
  notifications: Notification[];
  unread: number;
  notify: (n: Omit<Notification, 'id' | 'at'>) => void;
  markAllRead: () => void;
}

export const useUi = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
  notifications: [],
  unread: 0,
  notify: (n) =>
    set((s) => ({
      notifications: [{ ...n, id: crypto.randomUUID(), at: Date.now() }, ...s.notifications].slice(0, 30),
      unread: s.unread + 1,
    })),
  markAllRead: () => set({ unread: 0 }),
}));
