"use server";

import { requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getAISummaryProvider } from "@/features/ai-summaries/server/get-provider";
import { buildPortfolioContext } from "@/features/assistant/server/build-context";
import { chatRequestSchema } from "@/features/assistant/validation/chat";

const PROMPT_VERSION = "portfolio-chat-v1";

/**
 * User-triggered only, same reasoning as the other AI actions — each call
 * costs real money against a real API key. Not cached: this is a live
 * conversation, and the context (real portfolio data) is rebuilt fresh
 * every call so the assistant is never reasoning from stale holdings.
 */
export async function sendChatMessage(input: unknown): Promise<{ reply: string }> {
  const user = await requireUser();

  const parsed = chatRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const context = await buildPortfolioContext(user.id);
  const provider = getAISummaryProvider();
  const result = await provider.chat({
    messages: parsed.data.messages,
    context,
    promptVersion: PROMPT_VERSION,
  });

  return { reply: result.content };
}
