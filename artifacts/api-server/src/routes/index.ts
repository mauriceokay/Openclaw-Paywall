import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscriptionRouter from "./subscription";

const router: IRouter = Router();

router.use(healthRouter);
router.use(subscriptionRouter);

export default router;
