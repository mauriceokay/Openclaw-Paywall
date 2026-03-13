import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/users/register", async (req: Request, res: Response) => {
  const { name, email } = req.body;
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "name and email are required" });
  }

  try {
    const result = await db.execute(sql`
      INSERT INTO app.users (name, email)
      VALUES (${name.trim()}, ${email.trim().toLowerCase()})
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, email, created_at
    `);
    return res.status(200).json(result.rows[0]);
  } catch (err: any) {
    console.error("User register error:", err.message);
    return res.status(500).json({ error: "Failed to register user" });
  }
});

router.get("/users/me", async (req: Request, res: Response) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    const result = await db.execute(sql`
      SELECT id, name, email, created_at FROM app.users
      WHERE email = ${email.trim().toLowerCase()}
      LIMIT 1
    `);
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    return res.json(result.rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
