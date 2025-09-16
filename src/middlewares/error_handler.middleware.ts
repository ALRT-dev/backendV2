import type { NextFunction, Request, Response } from "express"

export const errorHandlerMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res
    .status(error.statusCode || 400)
    .send({ error: error.message || "Internal Server Error" })
}
