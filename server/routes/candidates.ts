import { Router, Request, Response } from "express";
import { db } from "../db";

export const candidatesRouter = Router();

/**
 * GET /api/candidates - Get all candidates
 */
candidatesRouter.get("/", (_req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM candidates ORDER BY appliedDate DESC");
    const candidates = stmt.all();
    res.json(candidates);
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

/**
 * GET /api/candidates/:id - Get single candidate
 */
candidatesRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM candidates WHERE id = ?");
    const candidate = stmt.get(req.params.id);
    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }
    res.json(candidate);
  } catch (error) {
    console.error("Error fetching candidate:", error);
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

/**
 * GET /api/candidates/job/:jobId - Get candidates for a job
 */
candidatesRouter.get("/job/:jobId", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM candidates WHERE jobId = ? ORDER BY appliedDate DESC");
    const candidates = stmt.all(req.params.jobId);
    res.json(candidates);
  } catch (error) {
    console.error("Error fetching candidates for job:", error);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

/**
 * POST /api/candidates - Create new candidate
 */
candidatesRouter.post("/", (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, jobId, status, resumeUrl, notes, rating } = req.body;

    const id = `cand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO candidates (
        id, firstName, lastName, email, phone, jobId, status, appliedDate, resumeUrl, notes, rating, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, firstName, lastName, email, phone, jobId, status || "applied", now, resumeUrl || null, notes || null, rating || null, now, now
    );

    res.status(201).json({ id, message: "Candidate created successfully" });
  } catch (error) {
    console.error("Error creating candidate:", error);
    res.status(500).json({ error: "Failed to create candidate" });
  }
});

/**
 * PUT /api/candidates/:id - Update candidate
 */
candidatesRouter.put("/:id", (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, status, resumeUrl, notes, rating } = req.body;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE candidates SET
        firstName = COALESCE(?, firstName),
        lastName = COALESCE(?, lastName),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        status = COALESCE(?, status),
        resumeUrl = COALESCE(?, resumeUrl),
        notes = COALESCE(?, notes),
        rating = COALESCE(?, rating),
        updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(firstName, lastName, email, phone, status, resumeUrl, notes, rating, now, req.params.id);

    res.json({ message: "Candidate updated successfully" });
  } catch (error) {
    console.error("Error updating candidate:", error);
    res.status(500).json({ error: "Failed to update candidate" });
  }
});

/**
 * DELETE /api/candidates/:id - Delete candidate
 */
candidatesRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("DELETE FROM candidates WHERE id = ?");
    stmt.run(req.params.id);
    res.json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("Error deleting candidate:", error);
    res.status(500).json({ error: "Failed to delete candidate" });
  }
});
