/** Lat/lng for every airport Horizon Airways serves */
export interface AirportInfo {
  code: string;
  city: string;
  name: string;
  lat: number;
  lng: number;
}

export const AIRPORT_COORDS: Record<string, AirportInfo> = {
  DEL: { code: 'DEL', city: 'Delhi',     name: 'Indira Gandhi International', lat: 28.5665, lng: 77.1031 },
  BOM: { code: 'BOM', city: 'Mumbai',    name: 'Chhatrapati Shivaji Maharaj', lat: 19.0896, lng: 72.8656 },
  BLR: { code: 'BLR', city: 'Bangalore', name: 'Kempegowda International',    lat: 13.1986, lng: 77.7066 },
  HYD: { code: 'HYD', city: 'Hyderabad', name: 'Rajiv Gandhi International',  lat: 17.2403, lng: 78.4294 },
  MAA: { code: 'MAA', city: 'Chennai',   name: 'Chennai International',        lat: 12.9941, lng: 80.1709 },
  CCU: { code: 'CCU', city: 'Kolkata',   name: 'Netaji Subhas Chandra Bose',  lat: 22.6520, lng: 88.4467 },
};

/** Interpolate a position along the great-circle route (simple linear for short distances) */
export function interpolatePosition(
  originCode: string,
  destCode: string,
  departAt: string,
  arriveAt: string,
): { lat: number; lng: number; pct: number; heading: number } | null {
  const origin = AIRPORT_COORDS[originCode];
  const dest   = AIRPORT_COORDS[destCode];
  if (!origin || !dest) return null;

  const now  = Date.now();
  const dep  = new Date(departAt).getTime();
  const arr  = new Date(arriveAt).getTime();
  const dur  = arr - dep;
  if (dur <= 0) return null;

  const raw = (now - dep) / dur;
  const pct = Math.max(0, Math.min(1, raw));

  const lat = origin.lat + (dest.lat - origin.lat) * pct;
  const lng = origin.lng + (dest.lng - origin.lng) * pct;

  // Bearing (degrees from north) for the icon rotation
  const dLng = (dest.lng - origin.lng) * (Math.PI / 180);
  const lat1 = origin.lat * (Math.PI / 180);
  const lat2 = dest.lat   * (Math.PI / 180);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const heading = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return { lat, lng, pct, heading };
}
