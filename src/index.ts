import http from "http";
import env from "dotenv";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { Server } from "socket.io";
import qs from "qs";
import { config } from "./utils/config.js";
import { isAllowedOrigin } from "./utils/cors.util.js";
import {
  authRouter,
  hazardRouter,
  notificationRouter,
  userRouter,
  hazardCategoryRouter,
  xpPointsRouter,
  adminRouter,
  onboardingRouter,
  webhookRouter,
  supportRouter,
} from "./routes/index.js";
import { errorHandlerMiddleware } from "./middlewares/error_handler.middleware.js";
import { unknownRouteMiddleware } from "./middlewares/unknown_route.middleware.js";
import { initSocket } from "./utils/socket_client.util.js";
import { requireSocketAuth } from "./middlewares/auth.middleware.js";
import { initializeScheduledTasks } from "./services/scheduler.service.js";
import { initializeDatabase } from "./services/database_initialization.service.js";
import { initCacheClient } from "./utils/cache_client.util.js";
import {
  apiGeneralRateLimiter,
  authApiRateLimiter,
} from "./middlewares/api_rate_limit.middleware.js";

env.config();

const app = express();

if (config.rateLimit.trustProxy) {
  app.set("trust proxy", 1);
}

// Configure Express to use qs for parsing query strings with nested objects
app.set("query parser", (str: string) =>
  qs.parse(str, { allowDots: true, arrayLimit: 100 }),
);

// Security headers. cross-origin CORP aligns with explicit browser CORS allowlist below.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const corsOriginCallback: cors.CorsOptions["origin"] = (origin, callback) => {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error("Not allowed by CORS"));
  }
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOriginCallback,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
io.use(requireSocketAuth);
initSocket(io);

app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Ensure CORS headers are on every response (including 4xx/5xx from error handler)
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

app.use(express.json());

// Rate limits: webhook first (own per-key limits), then auth (stricter), then general API.
app.use("/api/webhook", webhookRouter);
app.use("/api/auth", authApiRateLimiter, authRouter);
app.use("/api", apiGeneralRateLimiter);

app.use("/api/user", userRouter);
app.use("/api/hazards", hazardRouter);
app.use("/api/hazard-categories", hazardCategoryRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/xp", xpPointsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/support", supportRouter);

app.get("/api/test", (req, res) => {
  res.send("Test route is working!");
});

app.use(errorHandlerMiddleware);
app.use(unknownRouteMiddleware);

server.listen(config.port, async () => {
  console.log(
    `${config.env.toUpperCase()} server is running at PORT:${config.port}`,
  );

  // Initialize database and required data
  try {
    await initializeDatabase();
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }

  // Initialize cache client (non-blocking — app works without cache)
  try {
    await initCacheClient();
  } catch (error) {
    console.error("Failed to initialize cache client:", error);
  }

  // Whether to run scheduled tasks in development environment
  const runScheduledTasksInDev = false;

  if (runScheduledTasksInDev || config.env === "prod") {
    // Initialize scheduled tasks only in production or if explicitly enabled in development
    initializeScheduledTasks();
  }
});
