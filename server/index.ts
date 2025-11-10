import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { initializeDatabase, seedDatabase } from "./db";
import { employeesRouter } from "./routes/employees";
import { departmentsRouter } from "./routes/departments";
import { jobsRouter } from "./routes/jobs";
import { candidatesRouter } from "./routes/candidates";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize database on startup
  try {
    initializeDatabase();
    seedDatabase();
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  app.get("/api/demo", handleDemo);

  // SQLite API routes
  app.use("/api/employees", employeesRouter);
  app.use("/api/departments", departmentsRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/candidates", candidatesRouter);

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", database: "sqlite", timestamp: new Date().toISOString() });
  });

  return app;
}
