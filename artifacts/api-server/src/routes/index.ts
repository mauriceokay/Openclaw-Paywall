import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscriptionRouter from "./subscription";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(subscriptionRouter);

export default router;
