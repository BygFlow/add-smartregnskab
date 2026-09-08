import { type Express } from "express";
import { db } from "./storage";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "../shared/schema";
import { tenantId, requireRole } from "./auth";

const h = (fn: (req: any, res: any, next?: any) => any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function registerExtendedRoutes8(app: Express) {

  // ════════════════════════════════════════
  //  VIKAR-/BEMANDINGSFLOW
  // ════════════════════════════════════════
  app.get("/api/substitution-suggestions", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.substitutionSuggestions)
      .where(eq(schema.substitutionSuggestions.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/substitution-suggestions", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.substitutionSuggestions).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/substitution-suggestions/:id", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, respondedAt: new Date().toISOString() };
    const row = db.update(schema.substitutionSuggestions)
      .set(data)
      .where(and(eq(schema.substitutionSuggestions.id, parseInt(req.params.id)), eq(schema.substitutionSuggestions.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Forslag ikke fundet" });
    res.json(row);
  }));

  // Auto-generate suggestions for an absence
  app.post("/api/substitution-suggestions/generate/:absenceId", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    // Get the absent employee
    const absences = db.select().from(schema.absences)
      .where(and(eq(schema.absences.id, parseInt(req.params.absenceId)), eq(schema.absences.companyId, cid))).all();
    if (!absences.length) return res.status(404).json({ error: "Fravær ikke fundet" });
    const absence = absences[0];

    // Get all employees (excluding the absent one)
    const allEmployees = db.select().from(schema.employees)
      .where(eq(schema.employees.companyId, cid)).all();
    const candidates = allEmployees.filter(e => e.id !== absence.employeeId);

    // Check who has the same role/type
    const absentEmp = allEmployees.find(e => e.id === absence.employeeId);
    const suggestions: any[] = [];

    for (const emp of candidates) {
      let score = 0;
      const reasons: string[] = [];

      // Role match
      if (absentEmp && emp.role === absentEmp.role) {
        score += 30;
        reasons.push("rolle_match");
      }

      // Has required competencies (check certifications)
      const certs = db.select().from(schema.employeeCertifications)
        .where(and(eq(schema.employeeCertifications.employeeId, emp.id), eq(schema.employeeCertifications.status, "aktiv"))).all();
      if (certs.length > 0) {
        score += 20;
        reasons.push("kompetence_match");
      }

      // Not absent on the same date
      const conflictingAbsences = db.select().from(schema.absences).where(and(
        eq(schema.absences.employeeId, emp.id),
        eq(schema.absences.companyId, cid),
        eq(schema.absences.startDate, absence.startDate)
      )).all();
      if (conflictingAbsences.length === 0) {
        score += 25;
        reasons.push("ledig");
      }

      // Location proximity — skip if employee schema doesn't have location fields
      // Role match and competency match are the primary factors

      if (score > 0) {
        const row = db.insert(schema.substitutionSuggestions).values({
          companyId: cid,
          absenceId: absence.id,
          originalEmployeeId: absence.employeeId,
          suggestedEmployeeId: emp.id,
          reason: reasons.join(", "),
          score,
          status: "foreslaaet",
          createdAt: new Date().toISOString(),
        }).returning().get();
        suggestions.push(row);
      }
    }

    // Sort by score descending
    suggestions.sort((a, b) => (b.score || 0) - (a.score || 0));
    res.json({ generated: suggestions.length, suggestions });
  }));

  // ════════════════════════════════════════
  //  SLA-OVERVÅGNING
  // ════════════════════════════════════════
  app.get("/api/sla-alerts", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.slaAlerts)
      .where(eq(schema.slaAlerts.companyId, cid)).all();
    res.json(rows);
  }));

  app.post("/api/sla-alerts", h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body, companyId: cid, createdAt: new Date().toISOString() };
    const row = db.insert(schema.slaAlerts).values(data).returning().get();
    res.json(row);
  }));

  app.patch("/api/sla-alerts/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const data = { ...req.body };
    if (req.body.status === "loest" || req.body.status === "ignoreret") {
      data.resolvedAt = new Date().toISOString();
    }
    const row = db.update(schema.slaAlerts)
      .set(data)
      .where(and(eq(schema.slaAlerts.id, parseInt(req.params.id)), eq(schema.slaAlerts.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "SLA alert ikke fundet" });
    res.json(row);
  }));

  // Auto-generate SLA alerts for today
  app.post("/api/sla-alerts/generate", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const today = new Date().toISOString().split("T")[0];
    let generated = 0;

    // Check tasks scheduled for today that haven't started
    const tasks = db.select().from(schema.tasks)
      .where(and(eq(schema.tasks.companyId, cid), eq(schema.tasks.status, "planlagt"))).all();
    for (const task of tasks) {
      if (task.date && task.date <= today) {
        const existing = db.select().from(schema.slaAlerts).where(and(
          eq(schema.slaAlerts.companyId, cid),
          eq(schema.slaAlerts.taskId, task.id),
          eq(schema.slaAlerts.alertType, "task_not_started"),
          eq(schema.slaAlerts.status, "aktiv")
        )).all();
        if (!existing.length) {
          db.insert(schema.slaAlerts).values({
            companyId: cid,
            alertType: "task_not_started",
            taskId: task.id,
            customerId: task.customerId,
            employeeId: task.employeeId,
            severity: task.date < today ? "hoej" : "mellem",
            message: `Opgave "${task.title}" er ikke startet${task.date < today ? " og er forsinket" : " i dag"}`,
            status: "aktiv",
            createdAt: new Date().toISOString(),
          }).run();
          generated++;
        }
      }
    }

    // Check for missing check-ins (tasks with employees who haven't checked in)
    const activeCheckins = db.select().from(schema.qrCheckins)
      .where(and(eq(schema.qrCheckins.companyId, cid), eq(schema.qrCheckins.status, "aktiv"))).all();
    const checkedInTaskIds = new Set(activeCheckins.map(c => c.taskId).filter(Boolean));

    for (const task of tasks) {
      if (task.date === today && !checkedInTaskIds.has(task.id) && task.employeeId) {
        const existing = db.select().from(schema.slaAlerts).where(and(
          eq(schema.slaAlerts.companyId, cid),
          eq(schema.slaAlerts.taskId, task.id),
          eq(schema.slaAlerts.alertType, "missing_checkin"),
          eq(schema.slaAlerts.status, "aktiv")
        )).all();
        if (!existing.length) {
          db.insert(schema.slaAlerts).values({
            companyId: cid,
            alertType: "missing_checkin",
            taskId: task.id,
            customerId: task.customerId,
            employeeId: task.employeeId,
            severity: "mellem",
            message: `Manglende QR check-in for opgave "${task.title}"`,
            status: "aktiv",
            createdAt: new Date().toISOString(),
          }).run();
          generated++;
        }
      }
    }

    res.json({ generated, message: `${generated} SLA alerts genereret` });
  }));

  // ════════════════════════════════════════
  //  KUNDERAPPORTER
  // ════════════════════════════════════════
  app.get("/api/customer-reports", h(async (req, res) => {
    const cid = tenantId(req);
    const rows = db.select().from(schema.customerReports)
      .where(eq(schema.customerReports.companyId, cid)).all();
    res.json(rows);
  }));

  // Generate report for a customer for a month
  app.post("/api/customer-reports/generate", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const { customerId, month, year } = req.body;

    // Get completed tasks for this customer in this month
    const allTasks = db.select().from(schema.tasks)
      .where(and(eq(schema.tasks.companyId, cid), eq(schema.tasks.customerId, customerId))).all();
    const monthTasks = allTasks.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    // Get time entries for these tasks
    const taskIds = monthTasks.map(t => t.id);
    const allTimeEntries = db.select().from(schema.timeEntries)
      .where(eq(schema.timeEntries.companyId, cid)).all();
    const monthTimeEntries = allTimeEntries.filter(te => te.taskId !== null && taskIds.includes(te.taskId));
    const totalHours = monthTimeEntries.reduce((sum, te) => sum + ((te.durationMinutes || 0) / 60), 0);

    // Get deviations for this customer
    const allDeviations = db.select().from(schema.deviations)
      .where(and(eq(schema.deviations.companyId, cid), eq(schema.deviations.customerId, customerId))).all();
    const monthDeviations = allDeviations.filter(d => {
      if (!d.createdAt) return false;
      const dt = new Date(d.createdAt);
      return dt.getMonth() + 1 === month && dt.getFullYear() === year;
    });

    // Get feedback for this customer
    const allFeedback = db.select().from(schema.customerFeedback)
      .where(and(eq(schema.customerFeedback.companyId, cid), eq(schema.customerFeedback.customerId, customerId))).all();
    const monthFeedback = allFeedback.filter(f => {
      if (!f.createdAt) return false;
      const dt = new Date(f.createdAt);
      return dt.getMonth() + 1 === month && dt.getFullYear() === year;
    });
    const feedbackAvg = monthFeedback.length > 0
      ? monthFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / monthFeedback.length
      : null;

    // Get checklists for this customer
    const allChecklists = db.select().from(schema.locationChecklists)
      .where(and(eq(schema.locationChecklists.companyId, cid), eq(schema.locationChecklists.customerId, customerId))).all();
    const allExecutions = db.select().from(schema.checklistExecutions)
      .where(eq(schema.checklistExecutions.companyId, cid)).all();
    const monthExecutions = allExecutions.filter(e => {
      if (!e.executedAt) return false;
      const dt = new Date(e.executedAt);
      return dt.getMonth() + 1 === month && dt.getFullYear() === year;
    });
    const completionRate = monthExecutions.length > 0
      ? monthExecutions.reduce((sum, e) => sum + ((e.completedCount || 0) / Math.max(e.totalCount || 1, 1)) * 100, 0) / monthExecutions.length
      : null;

    // Get photos from check-ins
    const allCheckins = db.select().from(schema.qrCheckins)
      .where(and(eq(schema.qrCheckins.companyId, cid), eq(schema.qrCheckins.customerId, customerId))).all();
    const monthCheckins = allCheckins.filter(c => {
      if (!c.checkInTime) return false;
      const dt = new Date(c.checkInTime);
      return dt.getMonth() + 1 === month && dt.getFullYear() === year;
    });
    let photosCount = 0;
    for (const c of monthCheckins) {
      try { photosCount += JSON.parse(c.beforePhotos || "[]").length + JSON.parse(c.afterPhotos || "[]").length; } catch {}
    }

    const reportData = JSON.stringify({
      tasks: monthTasks.map(t => ({ title: t.title, date: t.date, status: t.status })),
      deviations: monthDeviations.map(d => ({ title: d.title, severity: d.severity, status: d.status })),
      feedback: monthFeedback.map(f => ({ rating: f.rating, comment: f.comment, category: f.category })),
    });

    const row = db.insert(schema.customerReports).values({
      companyId: cid,
      customerId,
      month,
      year,
      tasksCompleted: monthTasks.filter(t => t.status === "udfoert" || t.status === "completed").length,
      totalHours,
      deviationsCount: monthDeviations.length,
      feedbackAvg,
      checklistCompletionRate: completionRate,
      photosCount,
      reportData,
      generatedAt: new Date().toISOString(),
      status: "genereret",
      createdAt: new Date().toISOString(),
    }).returning().get();

    res.json(row);
  }));

  app.patch("/api/customer-reports/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    const row = db.update(schema.customerReports)
      .set(req.body)
      .where(and(eq(schema.customerReports.id, parseInt(req.params.id)), eq(schema.customerReports.companyId, cid)))
      .returning().get();
    if (!row) return res.status(404).json({ error: "Rapport ikke fundet" });
    res.json(row);
  }));

  app.delete("/api/customer-reports/:id", requireRole("leder", "platform_admin"), h(async (req, res) => {
    const cid = tenantId(req);
    db.delete(schema.customerReports)
      .where(and(eq(schema.customerReports.id, parseInt(req.params.id)), eq(schema.customerReports.companyId, cid))).run();
    res.json({ success: true });
  }));
}
