import { Logger } from '@nestjs/common';

/**
 * Geocoding (Nominatim/OpenStreetMap) and road-distance (OSRM) helpers.
 *
 * Mirrors AgroTrack's public_api/geo.py field-for-field (same services, same
 * constants, same fallback order) so a shipping-cost preview computed here
 * lines up with what AgroTrack itself would compute for the same inputs.
 * Called directly from Oko rather than through AgroTrack, cutting an extra
 * network hop out of every price preview a farmer sees while filling out
 * the arrange-transit form.
 */

const logger = new Logger('AgroTrackPricingGeo');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_URL = 'http://router.project-osrm.org/route/v1/driving';

// Bias geocoding toward Nigeria so plain city/LGA names resolve correctly.
const COUNTRY_BIAS = 'Nigeria';

// Real Nigerian roads are ~30% longer than straight-line distance. Used only
// as a last-resort fallback when OSRM is unreachable.
const ROAD_FACTOR = 1.3;

// Minimum billable distance (km). Prevents ₦0 estimates for same-street trips.
const MIN_DISTANCE_KM = 5.0;

const REQUEST_TIMEOUT_MS = 10_000;

// Identifies this application per Nominatim's usage policy — a distinct
// identity from AgroTrack's own User-Agent, since these are Oko's requests.
const USER_AGENT =
  'OkoAgroNest/1.0 (+https://github.com/Yray-6/oko-agro-nestjs)';

export type DistanceMethod = 'osrm' | 'haversine';

export class UnresolvableAddressError extends Error {}

async function fetchJson(
  url: string,
  description: string,
): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      logger.warn(`HTTP ${response.status} from ${description} (${url})`);
      return null;
    }
    return await response.json();
  } catch (err) {
    logger.warn(`Failed to reach ${description}: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Convert a plain-text address to [latitude, longitude], or null if it can't be resolved. */
export async function geocode(
  address: string,
): Promise<[number, number] | null> {
  const trimmed = address.trim();
  const query = trimmed.toLowerCase().includes(COUNTRY_BIAS.toLowerCase())
    ? trimmed
    : `${trimmed}, ${COUNTRY_BIAS}`;

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });
  const data = await fetchJson(
    `${NOMINATIM_URL}?${params.toString()}`,
    `Nominatim geocode: ${query}`,
  );

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const lat = parseFloat(data[0]?.lat);
  const lon = parseFloat(data[0]?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }
  return [lat, lon];
}

/** Actual road driving distance in km via OSRM, or null if it's unreachable. */
export async function roadDistanceKm(
  origin: [number, number],
  destination: [number, number],
): Promise<number | null> {
  // OSRM expects coordinates as longitude,latitude (GeoJSON order).
  const origStr = `${origin[1]},${origin[0]}`;
  const destStr = `${destination[1]},${destination[0]}`;
  const url = `${OSRM_URL}/${origStr};${destStr}?overview=false&alternatives=false&steps=false`;

  const data = await fetchJson(url, 'OSRM route');
  if (!data || data.code !== 'Ok') {
    return null;
  }

  const distanceM = data?.routes?.[0]?.distance;
  if (typeof distanceM !== 'number') {
    return null;
  }
  return distanceM / 1000;
}

/** Straight-line (Haversine) distance in km, corrected by ROAD_FACTOR. Fallback for when OSRM is down. */
export function haversineKm(
  origin: [number, number],
  destination: [number, number],
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(origin[0]);
  const lon1 = toRad(origin[1]);
  const lat2 = toRad(destination[0]);
  const lon2 = toRad(destination[1]);

  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;

  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));

  const earthRadiusKm = 6371.0;
  return earthRadiusKm * c * ROAD_FACTOR;
}

/**
 * Geocodes both addresses, gets road distance via OSRM, falls back to
 * Haversine if OSRM fails. Throws UnresolvableAddressError if either
 * address can't be geocoded at all.
 */
export async function resolveDistance(
  pickupAddress: string,
  deliveryAddress: string,
): Promise<{ distanceKm: number; method: DistanceMethod }> {
  const origin = await geocode(pickupAddress);
  if (!origin) {
    throw new UnresolvableAddressError(
      `Could not locate pickup address: '${pickupAddress}'. Please provide a more specific address (e.g. include city/state).`,
    );
  }

  const destination = await geocode(deliveryAddress);
  if (!destination) {
    throw new UnresolvableAddressError(
      `Could not locate delivery address: '${deliveryAddress}'. Please provide a more specific address (e.g. include city/state).`,
    );
  }

  const osrmDistance = await roadDistanceKm(origin, destination);
  if (osrmDistance !== null) {
    return {
      distanceKm:
        Math.round(Math.max(osrmDistance, MIN_DISTANCE_KM) * 100) / 100,
      method: 'osrm',
    };
  }

  logger.warn(
    `OSRM unavailable; falling back to Haversine for '${pickupAddress}' -> '${deliveryAddress}'`,
  );
  const haversineDistance = haversineKm(origin, destination);
  return {
    distanceKm:
      Math.round(Math.max(haversineDistance, MIN_DISTANCE_KM) * 100) / 100,
    method: 'haversine',
  };
}
