import type { Types } from "mongoose";
import { getGuestId } from "@/lib/guest";
import { connectDB } from "@/lib/mongodb";
import { Conversation } from "@/lib/models/Conversation";

type ListItem = { _id: Types.ObjectId; title: string; updatedAt: Date };

// list this guest's chats, newest first
export async function GET() {
  const guestId = await getGuestId();
  if (!guestId) {
    return Response.json({ error: "No guest session" }, { status: 401 });
  }

  await connectDB();
  const docs = await Conversation.find({ guestId })
    .select("title updatedAt") // only these fields, so messages are not loaded
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean<ListItem[]>();

  return Response.json(
    docs.map((d) => ({ id: d._id.toString(), title: d.title, updatedAt: d.updatedAt }))
  );
}

// delete ALL of this guest's chats
export async function DELETE() {
  const guestId = await getGuestId();
  if (!guestId) {
    return Response.json({ error: "No guest session" }, { status: 401 });
  }

  await connectDB();
  await Conversation.deleteMany({ guestId });
  return new Response(null, { status: 204 });
}