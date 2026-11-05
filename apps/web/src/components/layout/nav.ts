import { Building2, LayoutDashboard, MapPinned, Package, Receipt, Truck } from 'lucide-react';
import type { Role } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  driverLabel?: string;
}

export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['DISPATCHER', 'ACCOUNTANT'] },
  { href: '/shipments', label: 'Shipments', icon: Package, roles: ['DISPATCHER', 'ACCOUNTANT', 'DRIVER'], driverLabel: 'My loads' },
  { href: '/tracking', label: 'Live tracking', icon: MapPinned, roles: ['DISPATCHER', 'DRIVER'] },
  { href: '/fleet', label: 'Fleet', icon: Truck, roles: ['DISPATCHER', 'ACCOUNTANT'] },
  { href: '/customers', label: 'Customers', icon: Building2, roles: ['DISPATCHER', 'ACCOUNTANT'] },
  { href: '/billing', label: 'Billing', icon: Receipt, roles: ['ACCOUNTANT', 'DISPATCHER'] },
];

export function homeFor(role: Role) {
  return role === 'DRIVER' ? '/shipments' : '/dashboard';
}
