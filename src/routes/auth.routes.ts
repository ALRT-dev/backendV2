import router from "express";
import { login } from "../controllers/index.js";

const authRouter = router();

authRouter.post("/login", login);

export default authRouter;
