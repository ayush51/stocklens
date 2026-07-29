"use client";

import { useRef, useState } from "react";
import { MessageCircleIcon, SendIcon, SparklesIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { sendChatMessage } from "@/features/assistant/server/actions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Ask me about your holdings — allocation, concentration, what a thesis says, or how to think about a position. I only work from your real portfolio data, and I won't tell you to buy, sell, or hold.",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function handleSend() {
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      // Cap history sent to the model to the last 20 turns (server-enforced
      // too) — a long-running chat shouldn't grow the request without bound.
      const history = nextMessages.slice(-20).map((m) => ({ role: m.role, content: m.content }));
      const result = await sendChatMessage({ messages: history });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant couldn't respond.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        aria-label="Open portfolio assistant"
      >
        <MessageCircleIcon className="size-6" />
      </button>
    );
  }

  return (
    <div className="bg-card fixed bottom-6 right-6 z-50 flex h-[520px] w-96 flex-col rounded-lg border shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4" />
          <span className="text-sm font-semibold">Portfolio assistant</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted text-foreground"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {loading ? <p className="text-muted-foreground text-xs">Thinking…</p> : null}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>

      <div className="border-t p-3">
        <p className="text-muted-foreground mb-2 text-[11px]">
          AI-generated, grounded in your real holdings — not investment advice.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Am I too concentrated in tech?"
            disabled={loading}
            className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <SendIcon className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
