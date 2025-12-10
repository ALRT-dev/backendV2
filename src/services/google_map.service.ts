import { type GeocodeResult } from "@googlemaps/google-maps-services-js";
import { config } from "../utils/config.js";
import googleMapClient from "../utils/google_map_client.util.js";

/**
 * Converts latitude and longitude coordinates to a human-readable address
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns Promise<string | undefined> - Formatted address string
 */
export const convertLatLngToAddress = async (
  lat: number,
  lng: number
): Promise<string | undefined> => {
  try {
    const response = await googleMapClient.reverseGeocode({
      params: {
        latlng: { lat, lng },
        key: config.googleMapsApi.apiKey,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      if (result && result.formatted_address) {
        return result.formatted_address;
      }
    }

    console.warn("No address found for the given coordinates");
  } catch (error) {
    console.error("Error converting coordinates to address:", error);
  }
};

/**
 * Converts a human-readable address to latitude and longitude coordinates
 * @param address - Human-readable address string
 * @returns Promise<GeocodeResult | undefined> - Object containing lat, lng, formatted_address, and place_id
 */
export const convertAddressToLatLng = async (
  address: string
): Promise<GeocodeResult | undefined> => {
  try {
    if (address.trim() === "") {
      console.warn("Empty address provided");
      return;
    }

    const response = await googleMapClient.geocode({
      params: {
        address: address,
        key: config.googleMapsApi.apiKey,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      if (result && result.geometry && result.geometry.location) {
        return result;
      }
    }

    console.warn(
      "\n\nNo coordinates found for the given address: ",
      address,
      response.data
    );
  } catch (error) {
    console.error("Error converting address to coordinates:", error);
  }
};
