import { Router, Request, Response } from "express";
import { db } from "../db";

export const jobsRouter = Router();

/**
 * GET /api/jobs - Get all jobs
 */
jobsRouter.get("/", (_req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM jobs ORDER BY postedDate DESC");
    const jobs = stmt.all();
    res.json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

/**
 * GET /api/jobs/:id - Get single job
 */
jobsRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM jobs WHERE id = ?");
    const job = stmt.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

/**
 * POST /api/jobs - Create new job
 */
jobsRouter.post("/", (req: Request, res: Response) => {
  try {
    const { title, description, department, location, salaryMin, salaryMax, employmentType, status, closingDate, createdBy } = req.body;

    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO jobs (
        id, title, description, department, location, salaryMin, salaryMax,
        employmentType, status, postedDate, closingDate, createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, title, description, department, location, salaryMin, salaryMax,
      employmentType, status || "open", now, closingDate || null, createdBy || null, now, now
    );

    res.status(201).json({ id, message: "Job created successfully" });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

/**
 * PUT /api/jobs/:id - Update job
 */
jobsRouter.put("/:id", (req: Request, res: Response) => {
  try {
    const { title, description, department, location, salaryMin, salaryMax, employmentType, status, closingDate } = req.body;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE jobs SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        department = COALESCE(?, department),
        location = COALESCE(?, location),
        salaryMin = COALESCE(?, salaryMin),
        salaryMax = COALESCE(?, salaryMax),
        employmentType = COALESCE(?, employmentType),
        status = COALESCE(?, status),
        closingDate = COALESCE(?, closingDate),
        updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(title, description, department, location, salaryMin, salaryMax, employmentType, status, closingDate, now, req.params.id);

    res.json({ message: "Job updated successfully" });
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({ error: "Failed to update job" });
  }
});

/**
 * DELETE /api/jobs/:id - Delete job
 */
jobsRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("DELETE FROM jobs WHERE id = ?");
    stmt.run(req.params.id);
    res.json({ message: "Job deleted successfully" });
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({ error: "Failed to delete job" });
  }
});
