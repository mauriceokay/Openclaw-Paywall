import { readFileSync } from "fs";
import path from "path";
import { Router } from "express";
import { getSessionEmail } from "../sessionAuth";
import { trackUsageEvent } from "../usageTracking";

const router = Router();

function readMissionControlEnv(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), "mission-control", "backend", ".env"),
    path.resolve(process.cwd(), "..", "..", "mission-control", "backend", ".env"),
    path.resolve(process.cwd(), "..", "mission-control", "backend", ".env"),
  ];

  for (const envPath of candidates) {
    try {
      const raw = readFileSync(envPath, "utf8");
      const entries = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=");
          if (idx === -1) return null;
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          return [key, value] as const;
        })
        .filter((entry): entry is readonly [string, string] => Boolean(entry));

      return Object.fromEntries(entries);
    } catch {
      continue;
    }
  }

  return {};
}

router.get("/mission-control/launch", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const envFile = readMissionControlEnv();
  const authMode = (
    process.env.MISSION_CONTROL_AUTH_MODE
    || process.env.AUTH_MODE
    || envFile.AUTH_MODE
    || "local"
  ).trim().toLowerCase();
  const localAuthToken = (
    envFile.LOCAL_AUTH_TOKEN
    || process.env.MISSION_CONTROL_TOKEN
    || process.env.LOCAL_AUTH_TOKEN
    || ""
  ).trim();
  await trackUsageEvent(sessionEmail, "mission_control_open", {
    authMode,
  });
  return res.json({
    launchUrl: "/mission-control/dashboard",
    authMode,
    localAuthToken: localAuthToken || null,
  });
});

export default router;
