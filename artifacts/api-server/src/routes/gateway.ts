import { Router, type IRouter, type Request, type Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { getSessionEmail } from "../sessionAuth";
import { getLocalUser, isDbEnabled, setLocalGatewayEnabled } from "../localDev";
import { trackUsageEvent } from "../usageTracking";

const router: IRouter = Router();

const GATEWAY_URL = (process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:3005").trim();

router.get("/gateway-control", async (req: Request, res: Response) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });

  if (!isDbEnabled()) {
    const user = getLocalUser(email);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ enabled: user.gatewayEnabled });
  }

  try {
    const { pool } = await import("@workspace/db");
    const result = await pool.query(
      `SELECT gateway_enabled FROM app.users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase()]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    return res.json({ enabled: result.rows[0].gateway_enabled });
  } catch (err: any) {
    console.error("Gateway control GET error:", err.message);
    return res.status(500).json({ error: "Failed to fetch gateway status" });
  }
});

router.post("/gateway-control", async (req: Request, res: Response) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled (boolean) required" });

  if (!isDbEnabled()) {
    const user = setLocalGatewayEnabled(email, enabled);
    await trackUsageEvent(email, "gateway_toggle", { enabled });
    return res.json({ enabled: user.gatewayEnabled });
  }

  try {
    const { pool } = await import("@workspace/db");
    const result = await pool.query(
      `UPDATE app.users SET gateway_enabled = $1 WHERE email = $2 RETURNING gateway_enabled`,
      [enabled, email.toLowerCase()]
    );
    if (!result.rows[0]) {
      const ins = await pool.query(
        `INSERT INTO app.users (name, email, gateway_enabled)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET gateway_enabled = EXCLUDED.gateway_enabled
         RETURNING gateway_enabled`,
        [email, email.toLowerCase(), enabled]
      );
      await trackUsageEvent(email, "gateway_toggle", { enabled });
      return res.json({ enabled: ins.rows[0].gateway_enabled });
    }
    await trackUsageEvent(email, "gateway_toggle", { enabled });
    return res.json({ enabled: result.rows[0].gateway_enabled });
  } catch (err: any) {
    console.error("Gateway control POST error:", err.message);
    return res.status(500).json({ error: "Failed to update gateway status" });
  }
});

router.use(
  "/gateway",
  createProxyMiddleware({
    target: GATEWAY_URL,
    changeOrigin: false,
    pathRewrite: { "^/api/gateway": "" },
  }) as any,
);

export default router;
