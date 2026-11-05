export interface City {
  code: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
}

/** Supported terminals / service locations (US network). */
export const CITIES: City[] = [
  { code: 'CHI', name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { code: 'DAL', name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.797 },
  { code: 'ATL', name: 'Atlanta', state: 'GA', lat: 33.749, lng: -84.388 },
  { code: 'LAX', name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { code: 'HOU', name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { code: 'DEN', name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  { code: 'PHX', name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.074 },
  { code: 'MEM', name: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.049 },
  { code: 'MKC', name: 'Kansas City', state: 'MO', lat: 39.0997, lng: -94.5786 },
  { code: 'BNA', name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
  { code: 'IND', name: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581 },
  { code: 'CMH', name: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988 },
  { code: 'CLT', name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431 },
  { code: 'JAX', name: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557 },
  { code: 'SLC', name: 'Salt Lake City', state: 'UT', lat: 40.7608, lng: -111.891 },
  { code: 'LRD', name: 'Laredo', state: 'TX', lat: 27.5306, lng: -99.4803 },
  { code: 'EWR', name: 'Newark', state: 'NJ', lat: 40.7357, lng: -74.1724 },
  { code: 'SEA', name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  { code: 'LAS', name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
  { code: 'STL', name: 'St. Louis', state: 'MO', lat: 38.627, lng: -90.1994 },
  { code: 'OKC', name: 'Oklahoma City', state: 'OK', lat: 35.4676, lng: -97.5164 },
  { code: 'PIT', name: 'Pittsburgh', state: 'PA', lat: 40.4406, lng: -79.9959 },
];

export const CITY_BY_CODE = new Map(CITIES.map((c) => [c.code, c]));
