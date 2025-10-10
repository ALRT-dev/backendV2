import env from "dotenv";
import express from "express";
import cors from "cors";
import {
  authRouter,
  hazardRouter,
  notificationRouter,
  userRouter,
} from "./routes/index.js";
import { errorHandlerMiddleware } from "./middlewares/error_handler.middleware.js";
import { unknownRouteMiddleware } from "./middlewares/unknown_route.middleware.js";
import hazardCategoryRouter from "./routes/hazardCategory.route.js";

env.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/hazards", hazardRouter);
app.use("/api/hazard-categories", hazardCategoryRouter);
app.use("/api/notifications", notificationRouter);

app.use(errorHandlerMiddleware);
app.use(unknownRouteMiddleware);

app.listen(PORT, () => {
  console.log(`Server is running at PORT:${PORT}`);
});
