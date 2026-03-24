import { Router, type Request, type Response } from "express";
import { getSessionEmail } from "../sessionAuth";
import { isDbEnabled } from "../localDev";
import { storage } from "../storage";

const router = Router();

type AdminUserRow = {
  name: string;
  email: string;
  createdAt: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  instanceUrl: string | null;
  agentStatus: string | null;
  lastActivityAt: string | null;
};

function parseAdminEmails(): Set<string> {
  const values = [process.env.ADMIN_EMAILS ?? "", process.env.ADMIN_EMAIL ?? ""]
    .flatMap((raw) => raw.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values);
}

function getAdminSessionEmail(req: Request, res: Response): string | null {
  const sessionEmail = getSessionEmail(req)?.trim().toLowerCase() ?? "";
  if (!sessionEmail) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  const admins = parseAdminEmails();
  if (!admins.has(sessionEmail)) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }

  return sessionEmail;
}

router.get("/admin/me", (req, res) => {
  const sessionEmail = getSessionEmail(req)?.trim().toLowerCase() ?? "";
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const admins = parseAdminEmails();
  return res.json({ isAdmin: admins.has(sessionEmail), email: sessionEmail });
});

router.get("/admin/users", async (req, res) => {
  const adminEmail = getAdminSessionEmail(req, res);
  if (!adminEmail) return;

  try {
    if (!isDbEnabled()) {
      return res.json({ users: [] as AdminUserRow[] });
    }

    const { pool } = await import("@workspace/db");
    const usersResult = await pool.query<{
      name: string;
      email: string;
      created_at: string | null;
    }>(
      `
        SELECT name, email, created_at
        FROM app.users
        ORDER BY created_at DESC
        LIMIT 500
      `,
    );

    const users = usersResult.rows.map((row) => ({
      name: row.name,
      email: row.email.trim().toLowerCase(),
      createdAt: row.created_at,
    }));

    if (!users.length) {
      return res.json({ users: [] as AdminUserRow[] });
    }

    const emails = users.map((user) => user.email);

    const agentsResult = await pool.query<{
      user_id: string;
      status: string | null;
      instance_url: string | null;
    }>(
      `
        SELECT user_id, status, instance_url
        FROM user_agents
        WHERE user_id = ANY($1)
      `,
      [emails],
    );

    const activityResult = await pool.query<{
      email: string;
      last_activity_at: string | null;
    }>(
      `
        SELECT email, MAX(created_at) AS last_activity_at
        FROM app.usage_events
        WHERE email = ANY($1)
        GROUP BY email
      `,
      [emails],
    );

    const agentByEmail = new Map(
      agentsResult.rows.map((row) => [
        row.user_id.trim().toLowerCase(),
        { status: row.status, instanceUrl: row.instance_url },
      ]),
    );

    const activityByEmail = new Map(
      activityResult.rows.map((row) => [row.email.trim().toLowerCase(), row.last_activity_at]),
    );

    const subscriptionByEmail = new Map<string, { planName: string | null; status: string | null }>();
    await Promise.all(
      emails.map(async (email) => {
        const customer = await storage.getCustomerByEmail(email);
        if (!customer) {
          subscriptionByEmail.set(email, { planName: null, status: null });
          return;
        }
        const sub = await storage.getSubscriptionByCustomerId(customer.id);
        if (!sub) {
          subscriptionByEmail.set(email, { planName: null, status: null });
          return;
        }
        let planName: string | null = null;
        try {
          const firstItem = Array.isArray(sub.items?.data) ? sub.items.data[0] : null;
          planName = firstItem?.plan?.nickname || firstItem?.price?.nickname || null;
        } catch {}
        subscriptionByEmail.set(email, { planName, status: sub.status ?? null });
      }),
    );

    const rows: AdminUserRow[] = users.map((user) => {
      const agent = agentByEmail.get(user.email);
      const activity = activityByEmail.get(user.email) ?? null;
      const subscription = subscriptionByEmail.get(user.email) ?? { planName: null, status: null };
      return {
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        planName: subscription.planName,
        subscriptionStatus: subscription.status,
        instanceUrl: agent?.instanceUrl ?? null,
        agentStatus: agent?.status ?? null,
        lastActivityAt: activity,
      };
    });

    return res.json({
      users: rows,
      admin: adminEmail,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load admin users";
    return res.status(500).json({ error: message });
  }
});

export default router;
