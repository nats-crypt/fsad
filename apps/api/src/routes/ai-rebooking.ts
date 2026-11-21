import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { validate } from "../lib/validate.js";
import { suggestRebooking } from "../ai/rebooking.js";

export const aiRebookingRouter = Router();

const rebookingBodySchema = z.object({
  flightId: z.string().min(1),
});

/** POST /api/ai/rebooking { flightId } → array of alternative flights */
aiRebookingRouter.post(
  "/",
  validate(rebookingBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flightId } = req.body as z.infer<typeof rebookingBodySchema>;
      const alternatives = await suggestRebooking(flightId);
      res.json(alternatives);
    } catch (err) {
      next(err);
    }
  }
);
