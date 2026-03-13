import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscriptionRouter from "./subscription";
import configRouter from "./config";
import gatewayRouter from "./gateway";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(gatewayRouter);
router.use(usersRouter);
router.use(subscriptionRouter);

export default router;
