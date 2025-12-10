import type { NextFunction, Request, Response } from "express";

export const errorHandlerMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error occurred:", error);
  res
    .status(error.statusCode || 500)
    .send({ error: error.message || "Internal Server Error" });
};
