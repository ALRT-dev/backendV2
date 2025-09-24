import env from "dotenv";
import express from "express";
import cors from "cors";
import { authRouter, userRouter } from "./routes/index.js";
import { errorHandlerMiddleware } from "./middlewares/error_handler.middleware.js";
import { unknownRouteMiddleware } from "./middlewares/unknown_route.middleware.js";

env.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

app.use(errorHandlerMiddleware);
app.use(unknownRouteMiddleware);

app.listen(PORT, () => {
  console.log(`Server is running at PORT:${PORT}`);
});
