import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import {
  proxyGeocode,
  proxyPlaceAutocomplete,
  proxyPlaceDetails,
} from "../services/maps_proxy.service.js";

type Query = Record<string, unknown>;

/**
 * GET /api/maps/geocode — proxies Google Geocoding (forward + reverse).
 * Requires either `latlng` (reverse) or `address` (forward).
 */
export const geocode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = req.query as Query;
    if (!query.latlng && !query.address) {
      throw new HttpError(400, "Either 'latlng' or 'address' is required");
    }
    const data = await proxyGeocode(query);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/maps/places/autocomplete — proxies Google Places Autocomplete.
 */
export const placeAutocomplete = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = req.query as Query;
    if (!query.input) {
      throw new HttpError(400, "'input' is required");
    }
    const data = await proxyPlaceAutocomplete(query);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/maps/places/details — proxies Google Place Details.
 */
export const placeDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = req.query as Query;
    if (!query.place_id) {
      throw new HttpError(400, "'place_id' is required");
    }
    const data = await proxyPlaceDetails(query);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
