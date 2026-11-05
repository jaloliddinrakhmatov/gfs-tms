import { create } from 'zustand';
import type { Role, User } from './types';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  /** Access token lives in memory only — never in localStorage (XSS-safe). */
  accessToken: string | null;
  status: Status;
  setSession: (session: { user: User; accessToken: string }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setSession: ({ user, accessToken }) => set({ user, accessToken, status: 'authenticated' }),
  clear: () => set({ user: null, accessToken: null, status: 'unauthenticated' }),
}));

/** RBAC helper mirroring the API: ADMIN can do everything. */
export function hasRole(user: User | null, ...roles: Role[]) {
  if (!user) return false;
  return user.role === 'ADMIN' || roles.includes(user.role);
}
