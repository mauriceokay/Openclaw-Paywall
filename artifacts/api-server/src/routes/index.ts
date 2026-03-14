import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscriptionRouter from "./subscription";
import configRouter from "./config";
import gatewayRouter from "./gateway";
import usersRouter from "./users";
import anthropicRouter from "./anthropic";
import openclawRouter from "./openclaw";
import hooksRouter from "./hooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(gatewayRouter);
router.use(usersRouter);
router.use(subscriptionRouter);
router.use(anthropicRouter);
router.use("/openclaw", openclawRouter);
router.use(hooksRouter);

export default router;
