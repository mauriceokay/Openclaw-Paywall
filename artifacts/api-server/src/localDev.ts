interface LocalUser {
  name: string;
  email: string;
  gatewayEnabled: boolean;
  createdAt: string;
}

interface LocalAgent {
  userId: string;
  agentName: string;
  status: string;
  instanceUrl: string | null;
  createdAt: string;
}

interface LocalSubscription {
  email: string;
  planName: string;
  status: "active";
  createdAt: string;
}

const users = new Map<string, LocalUser>();
const agents = new Map<string, LocalAgent>();
const subscriptions = new Map<string, LocalSubscription>();

export function isDbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function upsertLocalUser(name: string, email: string): LocalUser {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = users.get(normalizedEmail);
  const user: LocalUser = {
    name: name.trim(),
    email: normalizedEmail,
    gatewayEnabled: existing?.gatewayEnabled ?? true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  users.set(normalizedEmail, user);
  return user;
}

export function getLocalUser(email: string): LocalUser | null {
  return users.get(email.trim().toLowerCase()) ?? null;
}

export function setLocalGatewayEnabled(email: string, enabled: boolean): LocalUser {
  const existing = getLocalUser(email) ?? upsertLocalUser(email, email);
  const updated: LocalUser = { ...existing, gatewayEnabled: enabled };
  users.set(updated.email, updated);
  return updated;
}

export function getLocalInstanceUrl(): string | null {
  return process.env.OPENCLAW_LOCAL_INSTANCE_URL ?? "http://127.0.0.1:3001";
}

export function provisionLocalAgent(email: string, instanceUrl?: string | null): LocalAgent {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = agents.get(normalizedEmail);
  const agent: LocalAgent = {
    userId: normalizedEmail,
    agentName: existing?.agentName ?? `user-${normalizedEmail.replace(/[^a-z0-9]/gi, "-").slice(0, 32)}`,
    status: "active",
    instanceUrl: instanceUrl ?? existing?.instanceUrl ?? getLocalInstanceUrl(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  agents.set(normalizedEmail, agent);
  return agent;
}

export function getLocalAgent(email: string): LocalAgent | null {
  return agents.get(email.trim().toLowerCase()) ?? null;
}

export function activateLocalSubscription(email: string, planName = "OpenClaw Pro"): LocalSubscription {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = subscriptions.get(normalizedEmail);
  const subscription: LocalSubscription = {
    email: normalizedEmail,
    planName,
    status: "active",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  subscriptions.set(normalizedEmail, subscription);
  return subscription;
}

export function getLocalSubscription(email: string): LocalSubscription | null {
  return subscriptions.get(email.trim().toLowerCase()) ?? null;
}
