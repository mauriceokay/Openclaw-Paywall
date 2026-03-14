import { Router, type IRouter, type Request, type Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const GATEWAY_URL = "http://127.0.0.1:3001";

router.get("/gateway/control", async (req: Request, res: Response) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    const result = await pool.query(
      `SELECT gateway_enabled FROM app.users WHERE email = $1 LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    return res.json({ enabled: result.rows[0].gateway_enabled });
  } catch (err: any) {
    console.error("Gateway control GET error:", err.message);
    return res.status(500).json({ error: "Failed to fetch gateway status" });
  }
});

router.post("/gateway/control", async (req: Request, res: Response) => {
  const { email, enabled } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled (boolean) required" });

  try {
    const result = await pool.query(
      `UPDATE app.users SET gateway_enabled = $1 WHERE email = $2 RETURNING gateway_enabled`,
      [enabled, email.trim().toLowerCase()]
    );
    if (!result.rows[0]) {
      const ins = await pool.query(
        `INSERT INTO app.users (name, email, gateway_enabled)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET gateway_enabled = EXCLUDED.gateway_enabled
         RETURNING gateway_enabled`,
        [email.trim(), email.trim().toLowerCase(), enabled]
      );
      return res.json({ enabled: ins.rows[0].gateway_enabled });
    }
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
    changeOrigin: true,
    pathRewrite: { "^/api/gateway": "" },
  }) as any,
);

export default router;
