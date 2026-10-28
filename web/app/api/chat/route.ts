import mongoose from "mongoose";
import { callBot, type ChatMessage } from "@/lib/botClient";
import { getGuestId } from "@/lib/guest";
import { connectDB } from "@/lib/mongodb";
import { Conversation } from "@/lib/models/Conversation";

export const maxDuration = 60;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const newExpiry = () => new Date(Date.now() + NINETY_DAYS_MS);

export async function POST(request: Request) {
  // 1. Who is this guest?
  const guestId = await getGuestId();
  if (!guestId) {
    return Response.json({ error: "No guest session" }, { status: 401 });
  }

  // 2. Validate the input
  const body = await request.json().catch(() => null);
  const text = typeof body?.message === "string" ? body.message.trim() : "";
  if (text.length === 0 || text.length > 1000) {
    return Response.json({ error: "Message must be 1 to 1000 characters" }, { status: 400 });
  }

  await connectDB();

  // 3. Open the existing conversation, or start a new one
  const conversationId = body?.conversationId;
  let conversation;
  if (conversationId) {
    if (!mongoose.isValidObjectId(conversationId)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    // Filter by guestId too, so guests can only open their own chats
    conversation = await Conversation.findOne({ _id: conversationId, guestId });
    if (!conversation) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
  } else {
    conversation = new Conversation({
      guestId,
      title: text.length > 40 ? text.slice(0, 40) + "..." : text,
      expiresAt: newExpiry(),
    });
  }

  // 4. Save the user's message
  conversation.messages.push({ role: "user", content: text, createdAt: new Date() });
  conversation.expiresAt = newExpiry();
  await conversation.save();

  // 5. Ask the bot, using the last 10 saved messages
  const history: ChatMessage[] = conversation.messages
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  let upstream: Response;
  try {
    upstream = await callBot(history);
  } catch {
    return Response.json({ error: "Bot service is unavailable" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "Bot service error" }, { status: 502 });
  }

  const intent = upstream.headers.get("X-Intent") ?? "";
  const confidence = parseFloat(upstream.headers.get("X-Confidence") ?? "");
  const route = upstream.headers.get("X-Route") ?? "";
  const savedId = conversation._id;

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
      "X-Conversation-Id": savedId.toString(),
      "X-Intent": intent,
      "X-Confidence": upstream.headers.get("X-Confidence") ?? "",
      "X-Route": route,
    },
  });
}