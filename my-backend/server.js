require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { pool, query } = require("./db");

const authRouter = require("./routes/auth");
const dataRouter = require("./routes/data");
const reservationsRouter = require("./routes/reservations");
const usersRouter = require("./routes/users");
const { authenticate } = require("./middleware/authenticate");
const { updatePassword } = require("./supabase-auth");
const { createInitialState } = require("./store");
const { ensureDatabaseReady } = require("./db");

const app = express();
const port = Number(process.env.PORT) || 5000;
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://elibuvtoledo.netlify.app",
  ...(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.has(origin));
    },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "Backend is running 🚀",
    env: process.env.NODE_ENV || "development",
  });
});

const healthCheck = (req, res) => {
  if (!pool) return res.status(503).json({ status: "not_configured", uptime: process.uptime() });
  query("SELECT 1")
    .then(() => res.json({ status: "ok", uptime: process.uptime() }))
    .catch(() => res.status(503).json({ status: "database_unavailable", uptime: process.uptime() }));
};
app.get(["/health", "/api/health"], healthCheck);

app.get("/api/bootstrap", (req, res) => {
  const { rooms } = createInitialState();
  res.json({ rooms });
});

app.get("/api/demo-accounts/:role", (req, res) => {
  const clientAddress = req.socket.remoteAddress;
  const isLoopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(clientAddress);
  if (process.env.NODE_ENV !== "development" || !isLoopback) {
    return res.status(404).json({ error: "Demo sign-in is available only in local development." });
  }
  if (!["student", "faculty"].includes(req.params.role)) {
    return res.status(404).json({ error: "Demo account not found." });
  }
  const accounts = {
    student: process.env.DEMO_STUDENT_ID,
    faculty: process.env.DEMO_FACULTY_ID,
  };
  const id = accounts[req.params.role];
  const password = process.env.DEMO_PASSWORD;
  if (!id || !password) {
    return res.status(503).json({ error: "Local demo credentials are not configured." });
  }
  res.set("Cache-Control", "no-store");
  return res.json({ id, password });
});

app.use("/api/auth", authRouter);
app.use("/api/data", dataRouter);
app.use("/api/users", usersRouter);
app.use("/api/reservations", reservationsRouter);

app.put("/api/auth/password", authenticate, async (req, res, next) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  if (!currentPassword) return res.status(400).json({ error: "Enter your current password." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  try {
    const authorization = req.get("authorization");
    await updatePassword(authorization.replace(/^Bearer\s+/i, ""), req.profile.email, currentPassword, password);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);

  const status = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({ error: message });
});

if (require.main === module) {
  (async () => {
    const status = await ensureDatabaseReady();
    if (!status.ready && status.configured) {
      console.warn(`Database schema check failed: ${status.message}`);
    }
    if (!status.configured) {
      console.warn("Database schema skipped: DATABASE_URL is not configured.");
    }

    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Stop the existing process or change PORT in your .env file.`);
        process.exit(1);
      }

      throw error;
    });
  })().catch((error) => {
    console.error("Unable to initialize the database schema.", error);
    process.exit(1);
  });
}

module.exports = app;