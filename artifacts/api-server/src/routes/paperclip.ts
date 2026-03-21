import { Router } from "express";
import { getSessionEmail } from "../sessionAuth";
import { trackUsageEvent } from "../usageTracking";

const router = Router();

router.get("/paperclip/launch", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  await trackUsageEvent(sessionEmail, "paperclip_open", {
    source: "dashboard",
  });

  return res.json({
    launchUrl: "/paperclip",
  });
});

export default router;
