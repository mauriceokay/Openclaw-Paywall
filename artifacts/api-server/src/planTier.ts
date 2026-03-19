export type PlanTier = "starter" | "pro" | "team";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function inferPlanTierFromText(...values: Array<string | null | undefined>): PlanTier | null {
  const text = values
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ")
    .toLowerCase();

  if (!text) return null;
  if (/\b(team|business|enterprise)\b/.test(text)) return "team";
  if (/\b(pro|professional)\b/.test(text)) return "pro";
  if (/\b(starter|basic)\b/.test(text)) return "starter";
  return null;
}

export function inferPlanTierFromPriceLike(priceLike: unknown): PlanTier | null {
  const price = asRecord(priceLike);
  if (!price) return null;

  const product = asRecord(price.product);
  const priceMetadata = asRecord(price.metadata);
  const productMetadata = asRecord(product?.metadata);

  const metadataTier =
    readString(priceMetadata, "tier")
    || readString(priceMetadata, "plan_tier")
    || readString(productMetadata, "tier")
    || readString(productMetadata, "plan_tier");

  const textTier = inferPlanTierFromText(
    metadataTier,
    readString(priceMetadata, "plan"),
    readString(productMetadata, "plan"),
    readString(price, "lookup_key"),
    readString(price, "nickname"),
    readString(product, "name"),
  );
  if (textTier) return textTier;

  const unitAmount = readNumber(price, "unit_amount");
  if (unitAmount === null) return null;

  const recurring = asRecord(price.recurring);
  const interval = readString(recurring, "interval");
  const intervalCount = Math.max(1, readNumber(recurring, "interval_count") ?? 1);

  let monthlyAmount = unitAmount;
  if (interval === "year") {
    monthlyAmount = unitAmount / (12 * intervalCount);
  } else if (interval === "month") {
    monthlyAmount = unitAmount / intervalCount;
  }

  if (monthlyAmount >= 6300) return "team";
  if (monthlyAmount >= 2800) return "pro";
  if (monthlyAmount >= 1200) return "starter";
  return null;
}

export function inferPlanTierFromSubscriptionItem(itemLike: unknown): PlanTier | null {
  const item = asRecord(itemLike);
  if (!item) return null;

  const plan = asRecord(item.plan);
  const planMetadata = asRecord(plan?.metadata);
  const planTier = inferPlanTierFromText(
    readString(plan, "nickname"),
    readString(plan, "id"),
    readString(planMetadata, "tier"),
    readString(planMetadata, "plan_tier"),
    readString(planMetadata, "plan"),
  );
  if (planTier) return planTier;

  return inferPlanTierFromPriceLike(item.price);
}

export function planTierToPlanName(tier: PlanTier | null): string | null {
  if (tier === "team") return "OpenClaw Team";
  if (tier === "pro") return "OpenClaw Pro";
  if (tier === "starter") return "OpenClaw Starter";
  return null;
}

export function isProOrTeamTier(tier: PlanTier | null): boolean {
  return tier === "pro" || tier === "team";
}
