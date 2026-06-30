import { Router } from "express";
import {
  geocode,
  placeAutocomplete,
  placeDetails,
} from "../controllers/maps.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const mapsRouter = Router();

// Authenticated so the proxy can't be used as an open relay against our Google quota.
mapsRouter.get("/geocode", requireAuth, geocode);
mapsRouter.get("/places/autocomplete", requireAuth, placeAutocomplete);
mapsRouter.get("/places/details", requireAuth, placeDetails);

export default mapsRouter;
