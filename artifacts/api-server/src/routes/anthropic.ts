import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireSession } from "../sessionAuth";

const router: IRouter = Router();

router.use(requireSession);

const SYSTEM_PROMPT = `You are OpenClaw AI, a powerful personal AI assistant. You help users with tasks, answer questions, write code, analyze data, and engage in thoughtful conversation. Be concise, helpful, and friendly. Format your responses using markdown when it improves readability (code blocks, lists, headers). Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

router.get("/anthropic/conversations", async (req, res) => {
  const userId = (req as any).sessionEmail as string;
  const rows = await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(conversations.createdAt);
  res.json(rows);
});

router.post("/anthropic/conversations", async (req, res) => {
  const userId = (req as any).sessionEmail as string;
  const { title = "New Conversation" } = req.body ?? {};
  const [row] = await db.insert(conversations).values({ userId, title }).returning();
  res.status(201).json(row);
});

router.get("/anthropic/conversations/:id", async (req, res) => {
  const userId = (req as any).sessionEmail as string;
  const id = req.params.id;
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

router.delete("/anthropic/conversations/:id", async (req, res) => {
  const userId = (req as any).sessionEmail as string;
  const id = req.params.id;
  const [deleted] = await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))).returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.status(204).end();
});

router.get("/anthropic/conversations/:id/messages", async (req, res) => {
  const userId = (req as any).sessionEmail as string;
  const id = req.params.id;
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/anthropic/conversations/:id/messages", async (req, res) => {
  const userId = (req as any).sessionEmail as string;
  const convId = req.params.id;
  const { content } = req.body ?? {};

  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, convId), eq(conversations.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({ conversationId: convId, role: "user", content });

  const history = await db.select().from(messages).where(eq(messages.conversationId, convId)).orderBy(messages.createdAt);

  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: convId, role: "assistant", content: fullResponse });

    if (conv.title === "New Conversation" && chatMessages.length === 1) {
      const titleText = content.slice(0, 50).replace(/\n/g, " ");
      await db.update(conversations).set({ title: titleText }).where(eq(conversations.id, convId));
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "AI request failed";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

export default router;
