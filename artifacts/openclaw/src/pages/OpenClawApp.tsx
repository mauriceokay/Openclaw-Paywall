import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertTriangle, ArrowLeft, Send, Plus, Trash2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionStatus } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-black/30 border border-white/10 rounded-lg p-3 overflow-x-auto my-2 text-sm font-mono">
          {lang && <div className="text-xs text-muted-foreground mb-1">{lang}</div>}
          <code className="text-green-300">{codeLines.join("\n")}</code>
        </pre>
      );
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-bold mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold mt-3 mb-1">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc">
          <InlineMarkdown text={line.slice(2)} />
        </li>
      );
    } else if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\. /, "");
      elements.push(
        <li key={i} className="ml-4 list-decimal">
          <InlineMarkdown text={text} />
        </li>
      );
    } else if (line === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="leading-relaxed">
          <InlineMarkdown text={line} />
        </p>
      );
    }
    i++;
  }
  return <div className="space-y-0.5 text-sm">{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="bg-black/30 text-green-300 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function OpenClawApp() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMsg, setStreamingMsg] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status", user?.email],
    queryFn: async () => {
      const url = user?.email
        ? `${BASE_URL}/api/subscription/status?email=${encodeURIComponent(user.email)}`
        : `${BASE_URL}/api/subscription/status`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/anthropic/conversations`);
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        setActiveConvId(data[data.length - 1].id);
      }
    } finally {
      setLoadingConvs(false);
    }
  }, [activeConvId]);

  const loadMessages = useCallback(async (convId: number) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${BASE_URL}/api/anthropic/conversations/${convId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      scrollToBottom();
    } finally {
      setLoadingMsgs(false);
    }
  }, [scrollToBottom]);

  const createConversation = async () => {
    const res = await fetch(`${BASE_URL}/api/anthropic/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Conversation" }),
    });
    if (!res.ok) return;
    const conv = await res.json();
    setConversations((prev) => [...prev, conv]);
    setActiveConvId(conv.id);
    setMessages([]);
  };

  const deleteConversation = async (convId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${BASE_URL}/api/anthropic/conversations/${convId}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConvId === convId) {
      const remaining = conversations.filter((c) => c.id !== convId);
      setActiveConvId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConvId || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const userMsg: Message = {
      id: Date.now(),
      conversationId: activeConvId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreamingMsg("");
    scrollToBottom();

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${BASE_URL}/api/anthropic/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        signal: abortRef.current.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(6));
          if (payload.content) {
            assistantContent += payload.content;
            setStreamingMsg(assistantContent);
            scrollToBottom();
          }
          if (payload.done || payload.error) {
            const assistantMsg: Message = {
              id: Date.now() + 1,
              conversationId: activeConvId,
              role: "assistant",
              content: assistantContent || payload.error || "",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev.filter((m) => m.id !== userMsg.id), { ...userMsg, id: prev.length + 1 }, assistantMsg]);
            setStreamingMsg(null);
            if (conversations.find((c) => c.id === activeConvId)?.title === "New Conversation") {
              loadConversations();
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStreamingMsg(null);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      }
    } finally {
      setSending(false);
      setStreamingMsg(null);
      textareaRef.current?.focus();
    }
  };

  useEffect(() => {
    if (status?.hasActiveSubscription) {
      loadConversations();
    }
  }, [status?.hasActiveSubscription]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    }
  }, [activeConvId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (statusLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading OpenClaw…</p>
        </div>
      </div>
    );
  }

  if (!status?.hasActiveSubscription) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-sm px-6">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Subscription Required</h2>
          <p className="text-muted-foreground mb-6">
            You need an active subscription to access OpenClaw.
          </p>
          <Button onClick={() => navigate("/pricing")} className="bg-primary text-white">
            View Plans
          </Button>
        </div>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-11 border-b border-white/5 bg-black/40 backdrop-blur shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Button>
        <div className="flex items-center gap-2 ml-1">
          <span className="text-base">🦞</span>
          <span className="text-sm font-semibold text-foreground/80">OpenClaw</span>
          {activeConv && activeConv.title !== "New Conversation" && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">· {activeConv.title}</span>
          )}
          {user?.name && (
            <span className="text-xs text-muted-foreground hidden sm:inline">· {user.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-56 shrink-0 border-r border-white/5 flex flex-col bg-black/20">
          <div className="p-2 border-b border-white/5">
            <Button
              onClick={createConversation}
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs h-8 border-white/10 hover:bg-white/5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {loadingConvs ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 px-2">No conversations yet</p>
            ) : (
              [...conversations].reverse().map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer text-xs transition-colors ${
                    activeConvId === conv.id
                      ? "bg-primary/20 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <span className="truncate flex-1">{conv.title}</span>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all ml-1 shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {!activeConvId ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="text-3xl">🦞</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">Welcome to OpenClaw</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Your AI assistant is ready. Start a new conversation or select one from the sidebar.
                  </p>
                </div>
                <Button onClick={createConversation} className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Conversation
                </Button>
              </div>
            ) : loadingMsgs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 && streamingMsg === null ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Bot className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                        <span className="text-sm">🦞</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-white/5 border border-white/10 rounded-bl-sm text-foreground"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <MarkdownContent content={msg.content} />
                      )}
                    </div>
                  </div>
                ))}
                {streamingMsg !== null && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                      <span className="text-sm">🦞</span>
                    </div>
                    <div className="max-w-[75%] rounded-2xl rounded-bl-sm px-4 py-2.5 bg-white/5 border border-white/10">
                      {streamingMsg ? (
                        <MarkdownContent content={streamingMsg} />
                      ) : (
                        <div className="flex gap-1 py-1">
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input area */}
          {activeConvId && (
            <div className="px-4 py-3 border-t border-white/5 bg-black/20">
              <div className="flex gap-2 items-end max-w-4xl mx-auto">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message OpenClaw… (Enter to send, Shift+Enter for newline)"
                  className="resize-none min-h-[44px] max-h-[200px] bg-white/5 border-white/10 focus:border-primary/50 text-sm rounded-xl"
                  rows={1}
                  disabled={sending}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  size="icon"
                  className="w-11 h-11 shrink-0 rounded-xl"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
