import { Router } from "express";

const adminAuthRouter = Router();

adminAuthRouter.post("/login", (req, res) => {
  // Admin login logic here
  res.send("Admin login");
});

export default adminAuthRouter;
