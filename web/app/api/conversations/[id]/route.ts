import mongoose from "mongoose";
import { getGuestId } from "@/lib/guest";
import { connectDB } from "@/lib/mongodb";
import { Conversation } from "@/lib/models/Conversation";

type Context = { params: Promise<{ id: string }> };

// rename one chat
export async function PATCH(request: Request, { params }: Context) {
  const guestId = await getGuestId();
  if (!guestId) {
    return Response.json({ error: "No guest session" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 80) {
    return Response.json({ error: "Title must be 1 to 80 characters" }, { status: 400 });
  }

  await connectDB();
  // timestamps: false, so renaming does not move the chat to the top of the list
  const result = await Conversation.updateOne(
    { _id: id, guestId },
    { $set: { title } },
    { timestamps: false }
  );
  if (result.matchedCount === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ id, title });
}

// delete one chat
export async function DELETE(_request: Request, { params }: Context) {
  const guestId = await getGuestId();
  if (!guestId) {
    return Response.json({ error: "No guest session" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await connectDB();
  const result = await Conversation.deleteOne({ _id: id, guestId });
  if (result.deletedCount === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}