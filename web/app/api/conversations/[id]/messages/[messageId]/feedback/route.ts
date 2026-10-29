import mongoose from "mongoose";
import { getGuestId } from "@/lib/guest";
import { connectDB } from "@/lib/mongodb";
import { Conversation } from "@/lib/models/Conversation";

type Context = { params: Promise<{ id: string; messageId: string }> };

// Save thumbs up, thumbs down, or clear it (value: null)
export async function POST(request: Request, { params }: Context) {
  const guestId = await getGuestId();
  if (!guestId) {
    return Response.json({ error: "No guest session" }, { status: 401 });
  }

  const { id, messageId } = await params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(messageId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const value = body?.value;
  if (value !== "up" && value !== "down" && value !== null) {
    return Response.json({ error: "Invalid value" }, { status: 400 });
  }

  await connectDB();

  // Find this guest's chat that contains this assistant message
  const filter = {
    _id: id,
    guestId,
    messages: {
      $elemMatch: { _id: new mongoose.Types.ObjectId(messageId), role: "assistant" },
    },
  };
  // "messages.$" means: the message that matched the filter above
  const update = value
    ? { $set: { "messages.$.feedback": value } }
    : { $unset: { "messages.$.feedback": "" } };

  const result = await Conversation.updateOne(filter, update, { timestamps: false });
  if (result.matchedCount === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}