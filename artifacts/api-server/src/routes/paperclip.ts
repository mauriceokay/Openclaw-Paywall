import { Router } from "express";
import { existsSync, readFileSync } from "fs";
import { getSessionEmail } from "../sessionAuth";
import { trackUsageEvent } from "../usageTracking";

const router = Router();
const PAPERCLIP_URL = process.env.PAPERCLIP_URL ?? "http://127.0.0.1:3100";
const PAPERCLIP_BOOTSTRAP_INVITE_FILE =
  process.env.PAPERCLIP_BOOTSTRAP_INVITE_FILE ?? "/paperclip-data/bootstrap_invite_url.txt";
const PAPERCLIP_BOOTSTRAP_INVITE_URL = process.env.PAPERCLIP_BOOTSTRAP_INVITE_URL?.trim() || null;

function toAppRelativePaperclipUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path.startsWith("/") ? path : `/${path}`;
  } catch {
    return null;
  }
}

async function resolvePaperclipLaunchUrl(): Promise<string> {
  try {
    const response = await fetch(`${PAPERCLIP_URL}/api/health`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return "/paperclip?paperclip=1";

    const payload = (await response.json()) as {
      bootstrapStatus?: string;
      bootstrapInviteActive?: boolean;
    };

    if (payload.bootstrapStatus === "bootstrap_pending" && payload.bootstrapInviteActive) {
      const envRelative = PAPERCLIP_BOOTSTRAP_INVITE_URL
        ? toAppRelativePaperclipUrl(PAPERCLIP_BOOTSTRAP_INVITE_URL)
        : null;
      if (envRelative) return envRelative;

      if (existsSync(PAPERCLIP_BOOTSTRAP_INVITE_FILE)) {
        const inviteUrl = readFileSync(PAPERCLIP_BOOTSTRAP_INVITE_FILE, "utf8").trim();
        const relative = toAppRelativePaperclipUrl(inviteUrl);
        if (relative) return relative;
      }
    }
  } catch {
    // fall back to standard launch path
  }

  return "/paperclip?paperclip=1";
}

router.get("/paperclip/launch", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  await trackUsageEvent(sessionEmail, "paperclip_open", {
    source: "dashboard",
  });

  const launchUrl = await resolvePaperclipLaunchUrl();

  return res.json({
    launchUrl,
  });
});

export default router;
