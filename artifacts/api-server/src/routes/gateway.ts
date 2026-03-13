import { Router, type IRouter } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const router: IRouter = Router();

const GATEWAY_URL = "http://127.0.0.1:3001";

router.use(
  "/gateway",
  createProxyMiddleware({
    target: GATEWAY_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/gateway": "" },
  }) as any,
);

export default router;
