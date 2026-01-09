import { Router, Request, Response } from "express";
import { db } from "../db";

export const departmentsRouter = Router();

/**
 * GET /api/departments - Get all departments
 */
departmentsRouter.get("/", (_req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM departments ORDER BY createdAt DESC");
    const departments = stmt.all();
    res.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

/**
 * GET /api/departments/:id - Get single department
 */
departmentsRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM departments WHERE id = ?");
    const department = stmt.get(req.params.id);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    res.json(department);
  } catch (error) {
    console.error("Error fetching department:", error);
    res.status(500).json({ error: "Failed to fetch department" });
  }
});

/**
 * POST /api/departments - Create new department
 */
departmentsRouter.post("/", (req: Request, res: Response) => {
  try {
    const { name, description, headCount, manager } = req.body;

    const id = `dept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO departments (id, name, description, headCount, manager, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, description, headCount || 0, manager || null, now, now);

    res.status(201).json({ id, message: "Department created successfully" });
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({ error: "Failed to create department" });
  }
});

/**
 * PUT /api/departments/:id - Update department
 */
departmentsRouter.put("/:id", (req: Request, res: Response) => {
  try {
    const { name, description, headCount, manager } = req.body;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE departments SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        headCount = COALESCE(?, headCount),
        manager = COALESCE(?, manager),
        updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(name, description, headCount, manager, now, req.params.id);

    res.json({ message: "Department updated successfully" });
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({ error: "Failed to update department" });
  }
});

/**
 * DELETE /api/departments/:id - Delete department
 */
departmentsRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("DELETE FROM departments WHERE id = ?");
    stmt.run(req.params.id);
    res.json({ message: "Department deleted successfully" });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({ error: "Failed to delete department" });
  }
});
