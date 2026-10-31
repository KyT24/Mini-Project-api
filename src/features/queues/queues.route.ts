import { Router } from "express";
import { QueueController } from "./queues.controller";
import { authenticate, authorize } from "../../middlewares/auth.middleware";

const router = Router();

// public: anyone can open the queue display
router.get("/live", QueueController.live);

// admin and staff only
router.post(
  "/check-in",
  authenticate,
  authorize("ADMIN", "STAFF"),
  QueueController.checkIn
);
router.post(
  "/sessions/:sessionId/call-next",
  authenticate,
  authorize("ADMIN", "STAFF"),
  QueueController.callNext
);
router.patch(
  "/appointments/:appointmentId/no-show",
  authenticate,
  authorize("ADMIN", "STAFF"),
  QueueController.noShow
);

export default router;