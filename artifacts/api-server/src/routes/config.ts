import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  });
});

export default router;
