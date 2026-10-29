import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import mongoose from "mongoose";
import type { HydratedDocument } from "mongoose";
import { callBot, type ChatMessage } from "@/lib/botClient";
import { getGuestId } from "@/lib/guest";
import { connectDB } from "@/lib/mongodb";
import { Conversation, type ConversationDoc } from "@/lib/models/Conversation";

export const maxDuration = 60;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const newExpiry = () => new Date(Date.now() + NINETY_DAYS_MS);

export async function POST(request: Request) {
  // 1. Who is this guest?
  const guestId = await getGuestId();
  if (!guestId) {
    return Response.json({ error: "No guest session" }, { status: 401 });
  }

  // Rate limit: stop spam before touching the database or the bot
  const limit = await checkRateLimit(guestId, getClientIp(request));
  if (!limit.allowed) {
    const wait =
      limit.retryAfterSeconds < 60
        ? `${limit.retryAfterSeconds} seconds`
        : `${Math.ceil(limit.retryAfterSeconds / 60)} minutes`;
    return Response.json(
      { error: `You're sending messages too fast. Please wait about ${wait} and try again.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  // 2. Validate the input
  const body = await request.json().catch(() => null);
  const regenerate = body?.regenerate === true;
  const text = typeof body?.message === "string" ? body.message.trim() : "";
  if (!regenerate && (text.length === 0 || text.length > 1000)) {
    return Response.json({ error: "Message must be 1 to 1000 characters" }, { status: 400 });
  }

  await connectDB();

  // 3. Open the existing conversation, or start a new one
  const conversationId = body?.conversationId;
  let conversation: HydratedDocument<ConversationDoc> | null = null;

  if (conversationId) {
    if (!mongoose.isValidObjectId(conversationId)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    // Filter by guestId too, so guests can only open their own chats
    conversation = await Conversation.findOne({ _id: conversationId, guestId });
    if (!conversation) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
  } else if (regenerate) {
    return Response.json({ error: "Nothing to regenerate" }, { status: 400 });
  } else {
    conversation = new Conversation({
      guestId,
      title: text.length > 40 ? text.slice(0, 40) + "..." : text,
      expiresAt: newExpiry(),
    });
  }

  // 4. Save the user's message, or prepare a regenerate
  if (regenerate) {
    // Drop the old answer (if there is one) and answer the last user message again
    const last = conversation.messages[conversation.messages.length - 1];
    if (last?.role === "assistant") conversation.messages.pop();

    const newLast = conversation.messages[conversation.messages.length - 1];
    if (newLast?.role !== "user") {
      return Response.json({ error: "Nothing to regenerate" }, { status: 400 });
    }
  } else {
    conversation.messages.push({ role: "user", content: text, createdAt: new Date() });
  }
  conversation.expiresAt = newExpiry();
  await conversation.save();

  const savedId = conversation._id;
  const conversationHeader = { "X-Conversation-Id": savedId.toString() };

  // 5. Ask the bot, using the last 10 saved messages
  const history: ChatMessage[] = conversation.messages
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  let upstream: Response;
  try {
    upstream = await callBot(history);
  } catch (err) {
    console.error("Could not reach the bot service:", err);
    return Response.json(
      { error: "Bot service is unavailable" },
      { status: 502, headers: conversationHeader }
    );
  }
  if (!upstream.ok || !upstream.body) {
    console.error("Bot service returned status", upstream.status);
    return Response.json(
      { error: "Bot service error" },
      { status: 502, headers: conversationHeader }
    );
  }

  const intent = upstream.headers.get("X-Intent") ?? "";
  const confidence = parseFloat(upstream.headers.get("X-Confidence") ?? "");
  const route = upstream.headers.get("X-Route") ?? "";

  // Create the assistant message's ID now, so the browser can use it for feedback
  const assistantMessageId = new mongoose.Types.ObjectId();

  // 6. A pipe that passes the stream through unchanged, keeps a copy, and saves it at the end
  const decoder = new TextDecoder();
  let reply = "";
  const saver = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      reply += decoder.decode(chunk, { stream: true });
      controller.enqueue(chunk);
    },
    async flush() {
      reply += decoder.decode();
      if (!reply.trim()) return;
      try {
        await Conversation.updateOne(
          { _id: savedId },
          {
            $push: {
              messages: {
                _id: assistantMessageId,
                role: "assistant",
                content: reply,
                intent: intent && intent !== "none" ? intent : undefined,
                confidence: Number.isNaN(confidence) ? undefined : confidence,
                route: route || undefined,
                createdAt: new Date(),
              },
            },
            $set: { expiresAt: newExpiry() },
          }
        );
      } catch (err) {
        console.error("Failed to save reply:", err);
      }
    },
  });

  return new Response(upstream.body.pipeThrough(saver), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...conversationHeader,
      "X-Message-Id": assistantMessageId.toString(),
      "X-Intent": intent,
      "X-Confidence": upstream.headers.get("X-Confidence") ?? "",
      "X-Route": route,
    },
  });
}