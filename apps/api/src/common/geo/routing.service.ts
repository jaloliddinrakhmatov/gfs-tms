import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { CITY_BY_CODE } from './cities';
import { estimateRoute, type LatLng } from './route';
import cachedRoutes from '../../../prisma/data/routes.json';

export interface RouteResult {
  route: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  source: 'cache' | 'osrm' | 'estimate';
}

type CachedRoute = { distanceMeters: number; durationSeconds: number; coordinates: LatLng[] };
const CACHE = cachedRoutes as unknown as Record<string, CachedRoute>;

/** Resolves road routes between terminals: local cache → OSRM → geometric estimate. */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly memo = new Map<string, RouteResult>();

  constructor(private readonly config: AppConfig) {}

  /** Lanes with a pre-computed road route, e.g. `CHI-DAL` (both directions). */
  static cachedLanes(): string[] {
    return Object.keys(CACHE).flatMap((k) => {
      const [a, b] = k.split('-');
      return [`${a}-${b}`, `${b}-${a}`];
    });
  }

  static fromCache(originCode: string, destinationCode: string): RouteResult | null {
    const direct = CACHE[`${originCode}-${destinationCode}`];
    if (direct) return { ...direct, route: direct.coordinates, source: 'cache' };
    const reverse = CACHE[`${destinationCode}-${originCode}`];
    if (reverse) return { ...reverse, route: [...reverse.coordinates].reverse(), source: 'cache' };
    return null;
  }

  async resolve(originCode: string, destinationCode: string): Promise<RouteResult> {
    const from = CITY_BY_CODE.get(originCode);
    const to = CITY_BY_CODE.get(destinationCode);
    if (!from || !to) throw new Error(`Unknown location ${originCode} or ${destinationCode}`);

    const key = `${originCode}-${destinationCode}`;
    const memoized = this.memo.get(key);
    if (memoized) return memoized;

    const cached = RoutingService.fromCache(originCode, destinationCode);
    if (cached) return cached;

    if (this.config.get('ROUTING_PROVIDER') === 'osrm') {
      try {
        const result = await this.fetchOsrm([from.lat, from.lng], [to.lat, to.lng]);
        this.memo.set(key, result);
        return result;
      } catch (err) {
        this.logger.warn(`OSRM unavailable for ${key}, using estimate: ${(err as Error).message}`);
      }
    }
    return { ...estimateRoute([from.lat, from.lng], [to.lat, to.lng]), source: 'estimate' };
  }

  private async fetchOsrm(from: LatLng, to: LatLng): Promise<RouteResult> {
    const url = `${this.config.get('OSRM_URL')}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = body.routes?.[0];
    if (!r) throw new Error('no route');
    const step = Math.max(1, Math.floor(r.geometry.coordinates.length / 150));
    const route = r.geometry.coordinates
      .filter((_, i, arr) => i % step === 0 || i === arr.length - 1)
      .map(([lng, lat]) => [+lat.toFixed(5), +lng.toFixed(5)] as LatLng);
    return {
      route,
      distanceMeters: Math.round(r.distance),
      durationSeconds: Math.round(r.duration),
      source: 'osrm',
    };
  }
}
