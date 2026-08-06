import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../models/http_error.js";
import { askAlrt } from "../services/askalrt.service.js";
import type { AskAlrtBody } from "../validators/askalrt.validator.js";

/**
 * POST /api/ask — Ask ALRT assistant.
 *
 * Privacy: the question is processed and discarded; only a content-free
 * daily AI-question count is stored (see askalrt.service).
 */
export const postAskAlrt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = res;
    if (!userId) {
      throw new HttpError(400, "Unauthenticated user");
    }

    const { question, latitude, longitude }: AskAlrtBody = req.body;

    const result = await askAlrt({ userId, question, latitude, longitude });

    res.json(result);
  } catch (error) {
    next(error);
  }
};
