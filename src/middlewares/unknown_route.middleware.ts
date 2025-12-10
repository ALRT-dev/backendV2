import type { Request, Response } from "express";

export const unknownRouteMiddleware = (req: Request, res: Response) => {
  res
    .status(404)
    .send({
      error: `The route [${req.method}]: ${req.originalUrl} does not exist!`,
    });
};
