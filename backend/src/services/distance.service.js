// Optional workaround for networks where Node's automatic address-family selection fails.
if (process.env.NETWORK_AUTO_SELECT_FAMILY === "false") {
  require("node:net").setDefaultAutoSelectFamily(false);
}

const { AppError } = require("../middleware/error.middleware");

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;
const GEOCODING_PROVIDER = process.env.GEOCODING_PROVIDER || "photon";
const PHOTON_BASE = process.env.PHOTON_BASE_URL || "https://photon.komoot.io";
const NOMINATIM_BASE =
  process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const OSRM_BASE =
  process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
const FREEAIRPORTDB_BASE = "https://www.freeairportdb.com/api";

// User-Agent required by Nominatim usage policy
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || "Gopax/1.0";
let geocodeQueue = Promise.resolve();
let lastGeocodeRequestAt = 0;
let geocoderAccessDenied = false;

async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
    return response;
  } catch {
    throw new AppError(
      "Distance provider is unavailable. Please retry later.",
      503,
      "DISTANCE_PROVIDER_UNAVAILABLE",
    );
  }
}

// In-memory caches to respect rate limits
const geocodeCache = new Map(); // placeName → { lat, lon }
const airportCache = new Map(); // code → { lat, lon, name }
const routeCache = new Map(); // `${lat1},${lon1}→${lat2},${lon2}` → distance_km

// ─── Haversine ────────────────────────────────────────────────────────────────

/**
 * Calculate Great Circle Distance using Haversine formula.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in kilometers
 */
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// ─── Nominatim Geocoding ──────────────────────────────────────────────────────

/**
 * Geocode a place name to coordinates using Nominatim.
 * Results are cached to avoid excessive requests per PRD requirement.
 *
 * @param {string} placeName
 * @returns {Promise<{ lat: number, lon: number }>}
 */
function geocode(placeName) {
  const job = geocodeQueue.then(() => geocodeQueued(placeName));
  geocodeQueue = job.catch(() => {});
  return job;
}

async function geocodeQueued(placeName) {
  const normalizedPlace = placeName
    .replace(/\s*\([A-Z0-9]{2,5}\)/gi, "")
    .trim();
  const key = normalizedPlace.toLowerCase();

  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  if (!["photon", "nominatim"].includes(GEOCODING_PROVIDER)) {
    throw new AppError(
      "Unsupported geocoding provider.",
      503,
      "GEOCODER_CONFIG_ERROR",
    );
  }
  const url =
    GEOCODING_PROVIDER === "photon"
      ? `${PHOTON_BASE}/api/?q=${encodeURIComponent(normalizedPlace)}&limit=1`
      : `${NOMINATIM_BASE}/search?q=${encodeURIComponent(normalizedPlace)}&format=json&limit=1`;

  if (geocoderAccessDenied) {
    throw new AppError(
      "Geocoder access denied. Configure an authorized provider before retrying.",
      503,
      "GEOCODER_ACCESS_DENIED",
    );
  }
  const delayMs = Math.max(0, 1100 - (Date.now() - lastGeocodeRequestAt));
  if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  lastGeocodeRequestAt = Date.now();
  const response = await requestJson(url, {
    headers: { "User-Agent": NOMINATIM_USER_AGENT },
  });
  if (response.status === 403) {
    geocoderAccessDenied = true;
    throw new AppError(
      "Geocoder access denied. Configure an authorized provider before retrying.",
      503,
      "GEOCODER_ACCESS_DENIED",
    );
  }

  if (!response.ok) {
    throw new AppError(
      "We couldn't determine the trip route.",
      502,
      "GEOCODE_FAILED",
    );
  }

  let payload = await response.json();
  let results =
    GEOCODING_PROVIDER === "photon"
      ? payload.features?.map((feature) => ({
          lon: feature.geometry?.coordinates?.[0],
          lat: feature.geometry?.coordinates?.[1],
        }))
      : payload;

  // Fallback: If not found, progressively clean specific house/block numbers
  if (!results || results.length === 0) {
    const cleanedPlace = normalizedPlace
      .replace(/\s*no\.\s*\d+[a-z]?/gi, "")
      .replace(/\s+\d+(\.\d+)+/gi, "")
      .replace(/\s*(no\.|rt|rw|blok|gang|gg)\.?\s*[\w\d\.\-]+/gi, "")
      .replace(/,\s*,+/g, ",")
      .trim();

    if (cleanedPlace && cleanedPlace.toLowerCase() !== key) {
      const fallbackUrl =
        GEOCODING_PROVIDER === "photon"
          ? `${PHOTON_BASE}/api/?q=${encodeURIComponent(cleanedPlace)}&limit=1`
          : `${NOMINATIM_BASE}/search?q=${encodeURIComponent(cleanedPlace)}&format=json&limit=1`;
      const fallbackRes = await requestJson(fallbackUrl, {
        headers: { "User-Agent": NOMINATIM_USER_AGENT },
      });
      if (fallbackRes.ok) {
        const fallbackPayload = await fallbackRes.json();
        results =
          GEOCODING_PROVIDER === "photon"
            ? fallbackPayload.features?.map((feature) => ({
                lon: feature.geometry?.coordinates?.[0],
                lat: feature.geometry?.coordinates?.[1],
              }))
            : fallbackPayload;
      }
    }
  }

  if (!results || results.length === 0) {
    throw new AppError(
      "We couldn't determine the trip route.",
      422,
      "LOCATION_NOT_FOUND",
    );
  }

  const { lat, lon } = results[0];
  const coords = { lat: parseFloat(lat), lon: parseFloat(lon) };

  if (
    !Number.isFinite(coords.lat) ||
    !Number.isFinite(coords.lon) ||
    Math.abs(coords.lat) > 90 ||
    Math.abs(coords.lon) > 180
  ) {
    throw new AppError(
      "Invalid coordinates from provider.",
      502,
      "INVALID_COORDINATES",
    );
  }
  geocodeCache.set(key, coords);
  return coords;
}

// ─── OSRM Route Distance ──────────────────────────────────────────────────────

/**
 * Get driving route distance between two coordinate pairs using OSRM.
 * Cached by coordinate pair.
 *
 * @param {{ lat: number, lon: number }} from
 * @param {{ lat: number, lon: number }} to
 * @returns {Promise<number>} distance in kilometers
 */
async function getRouteDistance(from, to) {
  const cacheKey = `${from.lat.toFixed(4)},${from.lon.toFixed(4)}→${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;

  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  const url =
    `${OSRM_BASE}/route/v1/driving/` +
    `${from.lon},${from.lat};${to.lon},${to.lat}` +
    `?overview=false&geometries=polyline`;

  let response;
  try {
    response = await requestJson(url);
  } catch (err) {
    console.warn(
      `[distance] OSRM route failed (${err.message}). Falling back to Haversine straight-line distance * 1.3 road factor.`,
    );
    const gcd = haversine(from.lat, from.lon, to.lat, to.lon);
    const approxKm = Math.round(gcd * 1.3 * 100) / 100; // Road tortuosity factor ~1.3
    routeCache.set(cacheKey, approxKm);
    return approxKm;
  }

  if (!response.ok) {
    const gcd = haversine(from.lat, from.lon, to.lat, to.lon);
    return Math.round(gcd * 1.3 * 100) / 100;
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new AppError(
      "We couldn't calculate the trip distance. Please try again.",
      422,
      "ROUTE_NOT_FOUND",
    );
  }

  // OSRM returns distance in meters
  const distanceKm = data.routes[0].distance / 1000;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new AppError(
      "Provider returned an invalid route distance.",
      502,
      "INVALID_ROUTE_DISTANCE",
    );
  }
  routeCache.set(cacheKey, distanceKm);

  return distanceKm;
}

// ─── FreeAirportDB ────────────────────────────────────────────────────────────

/**
 * Lookup airport coordinates by IATA or ICAO code via FreeAirportDB.
 * Cached by airport code.
 *
 * @param {string} code - IATA (e.g. "CGK") or ICAO (e.g. "WIII")
 * @returns {Promise<{ lat: number, lon: number, name: string }>}
 */
async function lookupAirport(code) {
  const key = code.toUpperCase().trim();

  if (airportCache.has(key)) {
    return airportCache.get(key);
  }

  // FreeAirportDB REST API: search by IATA code
  const url = `${FREEAIRPORTDB_BASE}/airport/${encodeURIComponent(key)}`;
  const response = await requestJson(url);

  if (!response.ok) {
    // Fallback: try generic search
    const searchUrl = `${FREEAIRPORTDB_BASE}/airports?iata=${encodeURIComponent(key)}&limit=1`;
    const searchResp = await requestJson(searchUrl);

    if (!searchResp.ok) {
      throw new AppError(
        "We couldn't identify one of the airports.",
        422,
        "AIRPORT_NOT_FOUND",
      );
    }

    const searchData = await searchResp.json();
    if (!searchData || (Array.isArray(searchData) && searchData.length === 0)) {
      throw new AppError(
        "We couldn't identify one of the airports.",
        422,
        "AIRPORT_NOT_FOUND",
      );
    }

    const airport = Array.isArray(searchData) ? searchData[0] : searchData;
    const result = {
      lat: parseFloat(airport.latitude || airport.lat),
      lon: parseFloat(airport.longitude || airport.lon),
      name: airport.name,
    };

    airportCache.set(key, result);
    return result;
  }

  const airport = await response.json();
  const result = {
    lat: parseFloat(airport.latitude || airport.lat),
    lon: parseFloat(airport.longitude || airport.lon),
    name: airport.name,
  };

  airportCache.set(key, result);
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve distance for land transport (BUS, MOTORCYCLE, CAR, TRAIN).
 * Uses Nominatim → OSRM pipeline.
 *
 * @param {string} origin
 * @param {string} destination
 * @returns {Promise<number>} distance_km
 */
async function resolveLandDistance(origin, destination) {
  const [fromCoords, toCoords] = await Promise.all([
    geocode(origin),
    geocode(destination),
  ]);

  const distanceKm = await getRouteDistance(fromCoords, toCoords);
  return Math.round(distanceKm * 100) / 100; // round to 2 decimal places
}

/**
 * Resolve distance for AIRPLANE using airport database + Haversine.
 *
 * @param {string} originCode - IATA/ICAO code (e.g. "CGK")
 * @param {string} destinationCode
 * @returns {Promise<number>} distance_km
 */
async function resolveAirportDistance(originCode, destinationCode) {
  const [fromAirport, toAirport] = await Promise.all([
    lookupAirport(originCode),
    lookupAirport(destinationCode),
  ]);

  const distanceKm = haversine(
    fromAirport.lat,
    fromAirport.lon,
    toAirport.lat,
    toAirport.lon,
  );

  return Math.round(distanceKm * 100) / 100;
}

/**
 * Dispatcher: resolve distance based on transport category.
 *
 * @param {string} category - BUS | MOTORCYCLE | CAR | TRAIN | AIRPLANE
 * @param {string} origin
 * @param {string} destination
 * @returns {Promise<number>} distance_km
 */
async function resolveDistance(category, origin, destination) {
  if (category === "AIRPLANE") {
    return resolveAirportDistance(origin, destination);
  }
  // Station-qualified queries avoid matching districts with the same name.
  if (category === "TRAIN") {
    const station = (name) =>
      /^(stasiun|station)\b/i.test(name) ? name : `Stasiun ${name}`;
    return resolveLandDistance(station(origin), station(destination));
  }
  return resolveLandDistance(origin, destination);
}

module.exports = {
  haversine,
  geocode,
  getRouteDistance,
  lookupAirport,
  resolveLandDistance,
  resolveAirportDistance,
  resolveDistance,
};
