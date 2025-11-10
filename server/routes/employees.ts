import { Router, Request, Response } from "express";
import { db } from "../db";

export const employeesRouter = Router();

/**
 * GET /api/employees - Get all employees
 */
employeesRouter.get("/", (_req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM employees ORDER BY createdAt DESC");
    const employees = stmt.all();
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

/**
 * GET /api/employees/:id - Get single employee
 */
employeesRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("SELECT * FROM employees WHERE id = ?");
    const employee = stmt.get(req.params.id);
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

/**
 * POST /api/employees - Create new employee
 */
employeesRouter.post("/", (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, department, position, employeeId, hireDate, employmentType, workLocation, monthlySalary, annualLeaveDays, status } = req.body;

    // Generate ID if not provided
    const id = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO employees (
        id, firstName, lastName, email, phone, department, position, employeeId,
        hireDate, employmentType, workLocation, monthlySalary, annualLeaveDays,
        status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, firstName, lastName, email, phone, department, position, employeeId,
      hireDate, employmentType, workLocation, monthlySalary, annualLeaveDays,
      status || "active", now, now
    );

    res.status(201).json({ id, message: "Employee created successfully" });
  } catch (error) {
    console.error("Error creating employee:", error);
    res.status(500).json({ error: "Failed to create employee" });
  }
});

/**
 * PUT /api/employees/:id - Update employee
 */
employeesRouter.put("/:id", (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, department, position, employeeId, hireDate, employmentType, workLocation, monthlySalary, annualLeaveDays, status } = req.body;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE employees SET
        firstName = COALESCE(?, firstName),
        lastName = COALESCE(?, lastName),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        department = COALESCE(?, department),
        position = COALESCE(?, position),
        employeeId = COALESCE(?, employeeId),
        hireDate = COALESCE(?, hireDate),
        employmentType = COALESCE(?, employmentType),
        workLocation = COALESCE(?, workLocation),
        monthlySalary = COALESCE(?, monthlySalary),
        annualLeaveDays = COALESCE(?, annualLeaveDays),
        status = COALESCE(?, status),
        updatedAt = ?
      WHERE id = ?
    `);

    stmt.run(firstName, lastName, email, phone, department, position, employeeId, hireDate, employmentType, workLocation, monthlySalary, annualLeaveDays, status, now, req.params.id);

    res.json({ message: "Employee updated successfully" });
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

/**
 * DELETE /api/employees/:id - Delete employee
 */
employeesRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    const stmt = db.prepare("DELETE FROM employees WHERE id = ?");
    stmt.run(req.params.id);
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});
