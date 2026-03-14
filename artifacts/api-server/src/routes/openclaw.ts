import { Router } from "express";
import { db } from "@workspace/db";
import { userAgentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { isValidInstanceUrl } from "../instanceUrlValidator";

const router = Router();

router.post("/provision", async (req, res) => {
  const { userId, email, instanceUrl } = req.body as {
    userId?: string;
    email?: string;
    instanceUrl?: string;
  };
  const id = userId || email;
  if (!id) {
    return res.status(400).json({ error: "userId or email is required" });
  }

  if (instanceUrl && !isValidInstanceUrl(instanceUrl)) {
    return res.status(400).json({ error: "Invalid instanceUrl: must be a valid HTTPS URL on an allowed domain" });
  }

  try {
    const existing = await db
      .select()
      .from(userAgentsTable)
      .where(eq(userAgentsTable.userId, id))
      .limit(1);

    if (existing.length > 0) {
      if (instanceUrl && existing[0].instanceUrl !== instanceUrl) {
        const [updated] = await db
          .update(userAgentsTable)
          .set({ instanceUrl })
          .where(eq(userAgentsTable.userId, id))
          .returning();
        return res.json({ agent: updated, provisioned: false, updated: true });
      }
      return res.json({ agent: existing[0], provisioned: false });
    }

    const agentName = `user-${id.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 32)}`;

    const [agent] = await db
      .insert(userAgentsTable)
      .values({
        userId: id,
        agentName,
        status: "active",
        instanceUrl: instanceUrl || null,
      })
      .returning();

    console.log(`[openclaw] provisioned agent ${agentName} for user ${id}`);
    return res.json({ agent, provisioned: true });
  } catch (err: any) {
    console.error("[openclaw] provision error:", err.message);
    return res.status(500).json({ error: err.message || "Provisioning failed" });
  }
});

router.get("/instance", async (req, res) => {
  const { userId, email } = req.query as { userId?: string; email?: string };
  const id = userId || email;
  if (!id) {
    return res.status(400).json({ error: "userId or email is required" });
  }

  const existing = await db
    .select()
    .from(userAgentsTable)
    .where(eq(userAgentsTable.userId, id))
    .limit(1);

  if (existing.length === 0) {
    return res.status(404).json({ error: "No agent found for this user" });
  }

  return res.json({
    agent: existing[0],
    instanceUrl: existing[0].instanceUrl || null,
    ready: !!existing[0].instanceUrl,
  });
});

router.get("/agent", async (req, res) => {
  const { userId, email } = req.query as { userId?: string; email?: string };
  const id = userId || email;
  if (!id) {
    return res.status(400).json({ error: "userId or email is required" });
  }

  const existing = await db
    .select()
    .from(userAgentsTable)
    .where(eq(userAgentsTable.userId, id))
    .limit(1);

  if (existing.length === 0) {
    return res.status(404).json({ error: "No agent found for this user" });
  }

  return res.json({ agent: existing[0] });
});

router.get("/agents", async (_req, res) => {
  try {
    const agents = await db.select().from(userAgentsTable);
    return res.json(agents);
  } catch (err: any) {
    console.error("[openclaw] list agents error:", err.message);
    return res.status(500).json({ error: "Failed to list agents" });
  }
});

export default router;
