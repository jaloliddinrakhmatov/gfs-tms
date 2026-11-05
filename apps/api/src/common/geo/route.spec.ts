import { bearing, cumulativeDistances, estimateRoute, haversine, pointAlongRoute, type LatLng } from './route';

const CHI: LatLng = [41.8781, -87.6298];
const DAL: LatLng = [32.7767, -96.797];

describe('geo/route', () => {
  it('computes great-circle distance (Chicago → Dallas ≈ 1,290 km)', () => {
    expect(haversine(CHI, DAL) / 1000).toBeCloseTo(1291, -1);
  });

  it('computes compass bearings', () => {
    expect(bearing([0, 0], [1, 0])).toBeCloseTo(0); // north
    expect(bearing([0, 0], [0, 1])).toBeCloseTo(90); // east
    expect(bearing([0, 0], [-1, 0])).toBeCloseTo(180); // south
  });

  it('interpolates by distance, not by vertex index', () => {
    // short first segment, long second segment
    const route: LatLng[] = [[0, 0], [0, 0.1], [0, 1]];
    const mid = pointAlongRoute(route, 0.5);
    expect(mid.position[1]).toBeCloseTo(0.5, 2);
    expect(mid.heading).toBeCloseTo(90);
  });

  it('clamps progress to the ends of the route', () => {
    const route: LatLng[] = [CHI, DAL];
    expect(pointAlongRoute(route, -1).position).toEqual(CHI);
    expect(pointAlongRoute(route, 2).position).toEqual(DAL);
  });

  it('accepts precomputed cumulative distances', () => {
    const route: LatLng[] = [[0, 0], [0, 1], [0, 2]];
    const cumulative = cumulativeDistances(route);
    expect(cumulative[2]).toBeCloseTo(cumulative[1] * 2, 0);
    expect(pointAlongRoute(route, 0.75, cumulative).position[1]).toBeCloseTo(1.5, 3);
  });

  it('builds a fallback route with road circuity', () => {
    const est = estimateRoute(CHI, DAL);
    expect(est.route[0]).toEqual(CHI);
    expect(est.route[est.route.length - 1][0]).toBeCloseTo(DAL[0]);
    expect(est.distanceMeters).toBeGreaterThan(haversine(CHI, DAL));
    expect(est.durationSeconds).toBeGreaterThan(0);
  });
});
