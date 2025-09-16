import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../models/http_error.js";

export const login = (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).send({ message: "Logged in!" });
  } catch (error) {
    next(error);
  }
};
