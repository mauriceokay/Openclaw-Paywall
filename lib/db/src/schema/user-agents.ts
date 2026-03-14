import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userAgentsTable = pgTable("user_agents", {
  userId: text("user_id").primaryKey(),
  agentName: text("agent_name").notNull(),
  workspaceDir: text("workspace_dir"),
  status: text("status").notNull().default("active"),
  instanceUrl: text("instance_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserAgentSchema = createInsertSchema(userAgentsTable);
export type InsertUserAgent = z.infer<typeof insertUserAgentSchema>;
export type UserAgent = typeof userAgentsTable.$inferSelect;
