export type LatLng = [number, number];

const EARTH_RADIUS_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in meters. */
export function haversine([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial compass bearing (0..360, 0 = north) from a to b. */
export function bearing([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Cumulative distance (meters) at each vertex of a polyline. */
export function cumulativeDistances(route: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) out.push(out[i - 1] + haversine(route[i - 1], route[i]));
  return out;
}

export interface RoutePoint {
  position: LatLng;
  heading: number;
}

/**
 * Position along a polyline at a given progress fraction (0..1), measured by distance.
 * Uses binary search over cumulative distances so it is O(log n) per lookup.
 */
export function pointAlongRoute(route: LatLng[], progress: number, cumulative = cumulativeDistances(route)): RoutePoint {
  if (route.length === 0) throw new Error('route must contain at least one point');
  if (route.length === 1) return { position: route[0], heading: 0 };

  const p = Math.min(1, Math.max(0, progress));
  const total = cumulative[cumulative.length - 1];
  const target = p * total;

  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= target) lo = mid;
    else hi = mid;
  }

  const segLen = cumulative[hi] - cumulative[lo];
  const t = segLen === 0 ? 0 : (target - cumulative[lo]) / segLen;
  const [aLat, aLng] = route[lo];
  const [bLat, bLng] = route[hi];
  return {
    position: [aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t],
    heading: bearing(route[lo], route[hi]),
  };
}

/**
 * Fallback route when no routing engine is available: a gently curved line between
 * two points with distance inflated by a typical road "circuity" factor.
 */
export function estimateRoute(from: LatLng, to: LatLng, points = 48) {
  const route: LatLng[] = [];
  const [aLat, aLng] = from;
  const [bLat, bLng] = to;
  // perpendicular offset produces a natural-looking arc instead of a ruler line
  const bulge = 0.06;
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const arc = Math.sin(Math.PI * t) * bulge;
    route.push([
      aLat + (bLat - aLat) * t + (bLng - aLng) * arc * 0.5,
      aLng + (bLng - aLng) * t - (bLat - aLat) * arc * 0.5,
    ]);
  }
  const distanceMeters = Math.round(haversine(from, to) * 1.2);
  const avgSpeedMps = 26.8; // ≈ 60 mph highway average incl. stops
  return { route, distanceMeters, durationSeconds: Math.round(distanceMeters / avgSpeedMps) };
}
