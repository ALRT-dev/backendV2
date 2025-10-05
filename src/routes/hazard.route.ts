import { Router } from "express";
import {
  createHazard,
  getHazardById,
  getHazards,
  deleteHazard,
  populateHazards,
} from "../controllers/hazard.controller.js";

const hazardRouter = Router();

hazardRouter.get("/", getHazards);
hazardRouter.get("/:id", getHazardById);
hazardRouter.post("/", createHazard);
hazardRouter.post("/populate", populateHazards);
hazardRouter.delete("/:id", deleteHazard);

export default hazardRouter;
