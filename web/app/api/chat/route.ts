import { callBot, type ChatMessage } from "@/lib/botClient";

export const maxDuration = 60; // allow up to 60 seconds for a reply

function isValidMessage(m: unknown): m is ChatMessage {
  const msg = m as ChatMessage;
  return (
    !!msg &&
    (msg.role === "user" || msg.role === "assistant") &&
    typeof msg.content === "string"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const messages = body?.messages;

  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isValidMessage)) {
    return Response.json({ error: "Invalid messages" }, { status: 400 });
  }

  const last = messages[messages.length - 1];
  const text = last.content.trim();
  if (last.role !== "user" || text.length === 0 || text.length > 1000) {
    return Response.json({ error: "Message must be 1 to 1000 characters" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await callBot(messages.slice(-10)); // only the last 10 messages
  } catch {
    return Response.json({ error: "Bot service is unavailable" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "Bot service error" }, { status: 502 });
  }

  // pass the stream straight through to the browser, plus the bot's metadata headers
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Intent": upstream.headers.get("X-Intent") ?? "",
      "X-Confidence": upstream.headers.get("X-Confidence") ?? "",
      "X-Route": upstream.headers.get("X-Route") ?? "",
    },
  });
}