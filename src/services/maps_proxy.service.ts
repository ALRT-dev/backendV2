import axios from "axios";
import { config } from "../utils/config.js";

/**
 * Transparent server-side proxy for the Google Maps web-service APIs (Geocoding and
 * Places). The app calls these endpoints instead of Google directly so the API key
 * never ships in the mobile binary — it lives only here (sourced from the AWS Secrets
 * Manager Agent in deployed environments) and can be rotated without an app release.
 *
 * Responses are passed through verbatim so existing client-side parsing is unchanged.
 */

const GOOGLE_MAPS_BASE = "https://maps.googleapis.com/maps/api";

type Query = Record<string, unknown>;

/** Forward only the expected params; never let the caller override the key. */
const pick = (source: Query, allowed: readonly string[]): Query => {
  const out: Query = {};
  for (const key of allowed) {
    const value = source[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
};

const forward = async (path: string, params: Query): Promise<unknown> => {
  const { data } = await axios.get(`${GOOGLE_MAPS_BASE}${path}`, {
    // The server key is injected here; any client-supplied "key" was dropped by pick().
    params: { ...params, key: config.googleMapsApi.apiKey },
    timeout: 10000,
  });
  return data;
};

const GEOCODE_PARAMS = [
  "latlng",
  "address",
  "language",
  "region",
  "result_type",
] as const;

const AUTOCOMPLETE_PARAMS = [
  "input",
  "locationbias",
  "types",
  "components",
  "language",
  "sessiontoken",
  "location",
  "radius",
] as const;

const PLACE_DETAILS_PARAMS = [
  "place_id",
  "fields",
  "language",
  "region",
  "sessiontoken",
] as const;

export const proxyGeocode = (query: Query): Promise<unknown> =>
  forward("/geocode/json", pick(query, GEOCODE_PARAMS));

export const proxyPlaceAutocomplete = (query: Query): Promise<unknown> =>
  forward("/place/autocomplete/json", pick(query, AUTOCOMPLETE_PARAMS));

export const proxyPlaceDetails = (query: Query): Promise<unknown> =>
  forward("/place/details/json", pick(query, PLACE_DETAILS_PARAMS));
