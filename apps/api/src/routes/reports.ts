import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth, requireRole } from "../lib/auth.js";
import { HttpError } from "../lib/http-error.js";
import {
  revenueReport,
  flightsReport,
  reservationsReport,
  cancellationsReport,
  aircraftReport,
  salaryReport,
  employeesReport,
  attendanceReport,
  performanceReport,
} from "../lib/reports.js";

export const reportsRouter = Router();

const authGuard = [requireAuth, requireRole("ADMIN", "STAFF")];

const REPORT_HANDLERS = {
  revenue: revenueReport,
  flights: flightsReport,
  reservations: reservationsReport,
  cancellations: cancellationsReport,
  aircraft: aircraftReport,
  salary: salaryReport,
  employees: employeesReport,
  attendance: attendanceReport,
  performance: performanceReport,
} as const;

type ReportType = keyof typeof REPORT_HANDLERS;

/** GET /api/reports/:type?from=YYYY-MM-DD&to=YYYY-MM-DD */
reportsRouter.get(
  "/:type",
  ...authGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params;
      const { from, to } = req.query as { from?: string; to?: string };

      if (!(type in REPORT_HANDLERS)) {
        throw new HttpError(400, `Unknown report type: ${type}`);
      }

      const handler = REPORT_HANDLERS[type as ReportType];
      const result = await handler({ from, to });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
