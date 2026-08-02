import { Router } from "express";
import { postAskAlrt } from "../controllers/askalrt.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { askAlrtBodySchema } from "../validators/askalrt.validator.js";

const askAlrtRouter = Router();

askAlrtRouter.post("/", requireAuth, validate(askAlrtBodySchema, "body"), postAskAlrt);

export default askAlrtRouter;
