import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { db } from "@workspace/db";
import { userAgentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const execFileAsync = promisify(execFile);

const router = Router();

const OPENCLAW_BIN = join(
  process.cwd(),
  "../../openclaw-app/node_modules/.bin/openclaw"
);
const OPENCLAW_STATE_ROOT = join(process.env.HOME || "/root", ".openclaw");

async function provisionAgent(userId: string): Promise<{ agentName: string; workspaceDir: string }> {
  const agentName = `user-${userId.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 32)}`;
  const workspaceDir = join(OPENCLAW_STATE_ROOT, "workspaces", agentName);

  try {
    await execFileAsync(OPENCLAW_BIN, [
      "agents",
      "add",
      "--non-interactive",
      "--workspace",
      workspaceDir,
      "--json",
      agentName,
    ]);
  } catch (err: any) {
    const msg = err.stderr || err.stdout || err.message || "";
    if (!msg.includes("already exists") && !msg.includes("conflict")) {
      console.error("[openclaw] agents add error:", msg);
      throw new Error(`Failed to provision agent: ${msg}`);
    }
  }

  return { agentName, workspaceDir };
}

router.post("/provision", async (req, res) => {
  const { userId, email } = req.body as { userId?: string; email?: string };
  const id = userId || email;
  if (!id) {
    return res.status(400).json({ error: "userId or email is required" });
  }

  try {
    const existing = await db
      .select()
      .from(userAgentsTable)
      .where(eq(userAgentsTable.userId, id))
      .limit(1);

    if (existing.length > 0) {
      return res.json({ agent: existing[0], provisioned: false });
    }

    const { agentName, workspaceDir } = await provisionAgent(id);

    const [agent] = await db
      .insert(userAgentsTable)
      .values({ userId: id, agentName, workspaceDir, status: "active" })
      .returning();

    console.log(`[openclaw] provisioned agent ${agentName} for user ${id}`);
    return res.json({ agent, provisioned: true });
  } catch (err: any) {
    console.error("[openclaw] provision error:", err.message);
    return res.status(500).json({ error: err.message || "Provisioning failed" });
  }
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

router.get("/agents", async (req, res) => {
  try {
    const { stdout } = await execFileAsync(OPENCLAW_BIN, [
      "agents",
      "list",
      "--json",
    ]);
    return res.json(JSON.parse(stdout));
  } catch {
    const agents = await db.select().from(userAgentsTable);
    return res.json(agents);
  }
});

export default router;
