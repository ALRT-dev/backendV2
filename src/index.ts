import http from "http";
import env from "dotenv";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { config } from "./utils/config.js";
import {
  authRouter,
  hazardRouter,
  notificationRouter,
  userRouter,
  hazardCategoryRouter,
} from "./routes/index.js";
import { errorHandlerMiddleware } from "./middlewares/error_handler.middleware.js";
import { unknownRouteMiddleware } from "./middlewares/unknown_route.middleware.js";
import { initSocket } from "./utils/socket_client.util.js";
import { requireSocketAuth } from "./middlewares/auth.middleware.js";
import { initializeScheduledTasks } from "./services/scheduler.service.js";

env.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
io.use(requireSocketAuth);
initSocket(io);

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/hazards", hazardRouter);
app.use("/api/hazard-categories", hazardCategoryRouter);
app.use("/api/notifications", notificationRouter);

app.use(errorHandlerMiddleware);
app.use(unknownRouteMiddleware);

server.listen(config.port, () => {
  console.log(
    `${config.env.toUpperCase()} server is running at PORT:${config.port}`
  );

  if (config.env === "prod") {
    // Initialize scheduled tasks only in production
    initializeScheduledTasks();
  }
});
