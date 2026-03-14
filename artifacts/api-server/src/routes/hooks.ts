/**
 * Inbound webhook forwarder for messaging platforms.
 *
 * Each per-user OpenClaw Docker container listens on http://localhost:{port}
 * and is not directly reachable from the internet.  These routes receive
 * platform webhook calls and proxy them to the correct user's container.
 *
 * Webhook URL pattern for users to register with each platform:
 *   {APP_URL}/api/hook/{platform}/{userId}
 *
 * The container must expose the corresponding path on its main port:
 *   /telegram-webhook   (Telegram)
 *   /line-webhook       (LINE)
 *   /gchat-webhook      (Google Chat)
 *   /slack-webhook      (Slack — if not using Socket Mode)
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { userAgentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Platforms and the path each one POSTs to on the container.
const PLATFORM_PATHS: Record<string, string> = {
  telegram: "/telegram-webhook",
  line: "/line-webhook",
  gchat: "/gchat-webhook",
  slack: "/slack-webhook",
};

async function forwardToInstance(
  platform: string,
  userId: string,
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
  const containerPath = PLATFORM_PATHS[platform];
  if (!containerPath) {
    res.status(404).json({ error: `Unknown platform: ${platform}` });
    return;
  }

  const [agent] = await db
    .select()
    .from(userAgentsTable)
    .where(eq(userAgentsTable.userId, userId))
    .limit(1);

  if (!agent?.instanceUrl) {
    res.status(404).json({ error: "Instance not found or not yet provisioned" });
    return;
  }

  const target = `${agent.instanceUrl}${containerPath}`;

  try {
    // Forward all original headers except host, plus the raw body.
    const forwardHeaders: Record<string, string> = {
      "content-type": req.headers["content-type"] ?? "application/json",
    };

    // Pass through platform-specific signature/secret headers.
    const passthroughHeaders = [
      "x-telegram-bot-api-secret-token", // Telegram
      "x-line-signature",                 // LINE
      "x-slack-signature",                // Slack
      "x-slack-request-timestamp",        // Slack
      "x-hub-signature-256",              // Generic HMAC (Meta platforms etc.)
    ];
    for (const h of passthroughHeaders) {
      if (req.headers[h]) forwardHeaders[h] = req.headers[h] as string;
    }

    const response = await fetch(target, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    res.status(response.status).set("content-type", response.headers.get("content-type") ?? "application/json").send(text);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Forwarding failed";
    console.error(`[hook/${platform}] forward error for user ${userId}:`, message);
    res.status(502).json({ error: "Could not reach instance" });
  }
}

router.post("/hook/:platform/:userId", async (req, res) => {
  const { platform, userId } = req.params;
  await forwardToInstance(platform, userId, req, res);
});

export default router;
