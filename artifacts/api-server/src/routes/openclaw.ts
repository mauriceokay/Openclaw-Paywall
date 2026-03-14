import { Router } from "express";
import { db } from "@workspace/db";
import { userAgentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { isValidInstanceUrl } from "../instanceUrlValidator";
import { setSessionCookie, getSessionEmail } from "../sessionAuth";
import { storage } from "../storage";
import { provisionInstance, isDockerProvisioningEnabled } from "../dockerProvisioner";

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

  const existingSession = getSessionEmail(req);
  if (existingSession && existingSession !== id) {
    return res.status(403).json({ error: "Session identity mismatch" });
  }

  const customer = await storage.getCustomerByEmail(id);
  if (!customer) {
    return res.status(403).json({ error: "No active customer found for this email" });
  }

  const sub = await storage.getSubscriptionByCustomerId(customer.id);
  if (!sub) {
    return res.status(403).json({ error: "Active subscription required" });
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

    // Resolve the instance URL: Docker-provisioned > user-supplied > null (pending).
    let resolvedInstanceUrl: string | null = instanceUrl || null;
    if (!resolvedInstanceUrl && isDockerProvisioningEnabled()) {
      resolvedInstanceUrl = await provisionInstance(id);
    }

    if (existing.length > 0) {
      setSessionCookie(res, id);

      const needsUpdate = resolvedInstanceUrl && existing[0].instanceUrl !== resolvedInstanceUrl;
      if (needsUpdate) {
        const [updated] = await db
          .update(userAgentsTable)
          .set({ instanceUrl: resolvedInstanceUrl })
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
        instanceUrl: resolvedInstanceUrl,
      })
      .returning();

    setSessionCookie(res, id);
    console.log(`[openclaw] provisioned agent ${agentName} for user ${id}`);
    return res.json({ agent, provisioned: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Provisioning failed";
    console.error("[openclaw] provision error:", message);
    return res.status(500).json({ error: message });
  }
});

router.get("/instance", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const existing = await db
    .select()
    .from(userAgentsTable)
    .where(eq(userAgentsTable.userId, sessionEmail))
    .limit(1);

  if (existing.length === 0) {
    return res.status(404).json({ error: "No agent found for this user" });
  }

  const appUrl = process.env.APP_URL || "";
  const webhookBase = appUrl ? `${appUrl}/api/hook` : null;

  return res.json({
    agent: existing[0],
    instanceUrl: existing[0].instanceUrl || null,
    ready: !!existing[0].instanceUrl,
    webhookUrls: webhookBase
      ? {
          telegram: `${webhookBase}/telegram/${sessionEmail}`,
          line: `${webhookBase}/line/${sessionEmail}`,
          gchat: `${webhookBase}/gchat/${sessionEmail}`,
          slack: `${webhookBase}/slack/${sessionEmail}`,
        }
      : null,
  });
});

router.get("/agent", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const existing = await db
    .select()
    .from(userAgentsTable)
    .where(eq(userAgentsTable.userId, sessionEmail))
    .limit(1);

  if (existing.length === 0) {
    return res.status(404).json({ error: "No agent found for this user" });
  }

  return res.json({ agent: existing[0] });
});

export default router;
