'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/misc';

// Leaflet needs `window`, so maps are client-only and code-split out of the main bundle.
const loading = () => <Skeleton className="h-full w-full rounded-none" />;

export const FleetMap = dynamic(() => import('./fleet-map'), { ssr: false, loading });
export const RouteMap = dynamic(() => import('./route-map'), { ssr: false, loading });
