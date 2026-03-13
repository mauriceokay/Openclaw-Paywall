import { Router, type IRouter, type Request, type Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import fs from "fs";
import path from "path";
import os from "os";

const router: IRouter = Router();

function getGatewayToken(): string {
  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config?.gateway?.auth?.token ?? "";
  } catch {
    return "";
  }
}

const GATEWAY_URL = "http://127.0.0.1:3001";

router.use(
  "/gateway",
  createProxyMiddleware({
    target: GATEWAY_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/gateway": "" },
    on: {
      proxyReq: (proxyReq) => {
        const token = getGatewayToken();
        if (token) {
          proxyReq.setHeader("Authorization", `Bearer ${token}`);
        }
      },
    },
    logger: console,
  }) as any,
);

export default router;
