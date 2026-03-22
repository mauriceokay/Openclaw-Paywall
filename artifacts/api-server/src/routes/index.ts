import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscriptionRouter from "./subscription";
import configRouter from "./config";
import gatewayRouter from "./gateway";
import missionControlRouter from "./missionControl";
import paperclipRouter from "./paperclip";
import usersRouter from "./users";
import { isDbEnabled } from "../localDev";
import openclawRouter from "./openclaw";
import nemoclawRouter from "./nemoclaw";
import affiliateRouter from "./affiliate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(gatewayRouter);
router.use(missionControlRouter);
router.use(paperclipRouter);
router.use(usersRouter);
router.use(subscriptionRouter);
router.use(affiliateRouter);
router.use("/openclaw", openclawRouter);
router.use(nemoclawRouter);

if (isDbEnabled()) {
  const { default: anthropicRouter } = await import("./anthropic");
  const { default: hooksRouter } = await import("./hooks");

  router.use(anthropicRouter);
  router.use(hooksRouter);
}

export default router;
