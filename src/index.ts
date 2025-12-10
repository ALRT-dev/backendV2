import http from "http";
import env from "dotenv";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import qs from "qs";
import { config } from "./utils/config.js";
import {
  authRouter,
  hazardRouter,
  notificationRouter,
  userRouter,
  hazardCategoryRouter,
  xpPointsRouter,
  adminRouter,
  onboardingRouter,
} from "./routes/index.js";
import { errorHandlerMiddleware } from "./middlewares/error_handler.middleware.js";
import { unknownRouteMiddleware } from "./middlewares/unknown_route.middleware.js";
import { initSocket } from "./utils/socket_client.util.js";
import { requireSocketAuth } from "./middlewares/auth.middleware.js";
import { initializeScheduledTasks } from "./services/scheduler.service.js";
import { initializeDatabase } from "./services/database_initialization.service.js";

env.config();

const app = express();

// Configure Express to use qs for parsing query strings with nested objects
app.set("query parser", (str: string) =>
  qs.parse(str, { allowDots: true, arrayLimit: 100 })
);

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
app.use("/api/onboarding", onboardingRouter);
app.use("/api/xp", xpPointsRouter);
app.use("/api/admin", adminRouter);

app.use(errorHandlerMiddleware);
app.use(unknownRouteMiddleware);

server.listen(config.port, async () => {
  console.log(
    `${config.env.toUpperCase()} server is running at PORT:${config.port}`
  );

  // Initialize database and required data
  try {
    await initializeDatabase();
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }

  // Whether to run scheduled tasks in development environment
  const runScheduledTasksInDev = false;

  if (runScheduledTasksInDev || config.env === "prod") {
    // Initialize scheduled tasks only in production or if explicitly enabled in development
    initializeScheduledTasks();
  }
});
