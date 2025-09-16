import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../models/http_error.js";

export const login = (req: Request, res: Response, next: NextFunction) => {
  try {
    throw new HttpError(501, "Not implemented");
  } catch (error) {
    next(error);
  }
};
