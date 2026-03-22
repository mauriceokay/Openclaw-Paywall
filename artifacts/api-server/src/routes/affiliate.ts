import { Router } from "express";
import { getSessionEmail } from "../sessionAuth";
import { getUncachableStripeClient } from "../stripeClient";
import { isDbEnabled } from "../localDev";

const router = Router();

type AffiliateRow = {
  email: string;
  code: string;
  stripe_account_id: string | null;
};

function normalizeAffiliateCode(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function generateAffiliateCode(email: string, nonce: number): string {
  const localPart = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${localPart.slice(0, 14)}-${nonce}${suffix}`.slice(0, 24);
}

function resolveAppBaseUrl(req: import("express").Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return envUrl;
    } catch {}
  }

  const host = req.get("host");
  if (host) {
    const proto = req.protocol === "https" ? "https" : "http";
    return `${proto}://${host}`;
  }
  return "http://localhost:3001";
}

async function ensureAffiliate(pool: any, email: string): Promise<AffiliateRow> {
  const existing = await pool.query(
    `SELECT email, code, stripe_account_id FROM app.affiliates WHERE email = $1 LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) return existing.rows[0] as AffiliateRow;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateAffiliateCode(email, attempt);
    try {
      const inserted = await pool.query(
        `INSERT INTO app.affiliates (email, code) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
         RETURNING email, code, stripe_account_id`,
        [email, code],
      );
      if (inserted.rows[0]) return inserted.rows[0] as AffiliateRow;
    } catch {}
  }

  const fallback = await pool.query(
    `SELECT email, code, stripe_account_id FROM app.affiliates WHERE email = $1 LIMIT 1`,
    [email],
  );
  if (!fallback.rows[0]) {
    throw new Error("Failed to initialize affiliate profile");
  }
  return fallback.rows[0] as AffiliateRow;
}

router.get("/affiliate/me", async (req, res) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });
  if (!isDbEnabled()) return res.status(400).json({ error: "Affiliate program requires DATABASE_URL" });

  try {
    const { pool } = await import("@workspace/db");
    const affiliate = await ensureAffiliate(pool, email);

    const [statsResult, referralsResult] = await Promise.all([
      pool.query(
        `
          SELECT
            COUNT(*)::int AS commissions_count,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents ELSE 0 END), 0)::int AS pending_cents,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END), 0)::int AS paid_cents,
            COALESCE(SUM(amount_cents), 0)::int AS total_cents
          FROM app.affiliate_commissions
          WHERE affiliate_email = $1
        `,
        [email],
      ),
      pool.query(
        `
          SELECT COUNT(*)::int AS referrals
          FROM app.referral_attributions
          WHERE affiliate_email = $1
        `,
        [email],
      ),
    ]);

    const baseUrl = resolveAppBaseUrl(req);
    const link = new URL(baseUrl);
    link.searchParams.set("ref", affiliate.code);

    return res.json({
      code: affiliate.code,
      link: link.toString(),
      stripeAccountId: affiliate.stripe_account_id,
      referrals: Number(referralsResult.rows[0]?.referrals ?? 0),
      commissionsCount: Number(statsResult.rows[0]?.commissions_count ?? 0),
      pendingCents: Number(statsResult.rows[0]?.pending_cents ?? 0),
      paidCents: Number(statsResult.rows[0]?.paid_cents ?? 0),
      totalCents: Number(statsResult.rows[0]?.total_cents ?? 0),
    });
  } catch (err: any) {
    console.error("Error loading affiliate profile:", err?.message || err);
    return res.status(500).json({ error: "Failed to load affiliate profile" });
  }
});

router.post("/affiliate/connect-account", async (req, res) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });
  if (!isDbEnabled()) return res.status(400).json({ error: "Affiliate program requires DATABASE_URL" });

  try {
    const { pool } = await import("@workspace/db");
    const stripe = await getUncachableStripeClient();
    const affiliate = await ensureAffiliate(pool, email);

    let accountId = affiliate.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          affiliateEmail: email,
        },
      });
      accountId = account.id;
      await pool.query(
        `UPDATE app.affiliates SET stripe_account_id = $2, updated_at = NOW() WHERE email = $1`,
        [email, accountId],
      );
    }

    const baseUrl = resolveAppBaseUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/dashboard`,
      return_url: `${baseUrl}/dashboard`,
      type: "account_onboarding",
    });

    return res.json({ url: accountLink.url, accountId });
  } catch (err: any) {
    console.error("Error creating affiliate connect link:", err?.message || err);
    return res.status(400).json({ error: err?.message || "Failed to create Stripe Connect link" });
  }
});

router.post("/affiliate/payouts/run", async (req, res) => {
  if (!isDbEnabled()) return res.status(400).json({ error: "Affiliate program requires DATABASE_URL" });
  const expected = process.env.AFFILIATE_PAYOUTS_CRON_SECRET?.trim();
  const provided = req.get("x-affiliate-cron-secret")?.trim();
  if (!expected || expected !== provided) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { pool } = await import("@workspace/db");
    const stripe = await getUncachableStripeClient();

    const pendingGroups = await pool.query(
      `
        SELECT
          c.affiliate_email,
          a.stripe_account_id,
          LOWER(c.currency) AS currency,
          SUM(c.amount_cents)::int AS amount_cents,
          ARRAY_AGG(c.id)::bigint[] AS commission_ids
        FROM app.affiliate_commissions c
        INNER JOIN app.affiliates a ON a.email = c.affiliate_email
        WHERE c.status = 'pending'
          AND a.stripe_account_id IS NOT NULL
        GROUP BY c.affiliate_email, a.stripe_account_id, LOWER(c.currency)
      `,
    );

    let paidGroups = 0;
    let paidCents = 0;
    const errors: Array<{ affiliateEmail: string; error: string }> = [];

    for (const row of pendingGroups.rows) {
      const affiliateEmail = String(row.affiliate_email);
      const accountId = String(row.stripe_account_id);
      const currency = String(row.currency || "usd");
      const amountCents = Number(row.amount_cents ?? 0);
      const commissionIds = (row.commission_ids ?? []) as number[];

      if (!accountId || !amountCents || amountCents < 1 || commissionIds.length === 0) continue;

      try {
        const transfer = await stripe.transfers.create({
          amount: amountCents,
          currency,
          destination: accountId,
          metadata: {
            type: "affiliate_payout",
            affiliateEmail,
            commissionCount: String(commissionIds.length),
          },
        });

        await pool.query(
          `
            UPDATE app.affiliate_commissions
            SET status = 'paid',
                paid_at = NOW(),
                stripe_transfer_id = $2
            WHERE id = ANY($1::bigint[])
          `,
          [commissionIds, transfer.id],
        );

        paidGroups += 1;
        paidCents += amountCents;
      } catch (err: any) {
        errors.push({
          affiliateEmail,
          error: err?.message || "Failed transfer",
        });
      }
    }

    return res.json({
      ok: true,
      paidGroups,
      paidCents,
      currency: "mixed",
      errors,
    });
  } catch (err: any) {
    console.error("Error running affiliate payouts:", err?.message || err);
    return res.status(500).json({ error: "Failed to run affiliate payouts" });
  }
});

export default router;
