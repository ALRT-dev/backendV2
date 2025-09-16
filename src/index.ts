import env from "dotenv";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/index.js";
import {
  errorHandlerMiddleware,
  unknownRouteMiddleware,
} from "./middlewares/index.js";

env.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);

app.use(errorHandlerMiddleware);
app.use(unknownRouteMiddleware);

app.listen(PORT, () => {
  console.log(`Server is running at PORT:${PORT}`);
});
