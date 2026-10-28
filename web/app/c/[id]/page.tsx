import mongoose from "mongoose";
import { notFound } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";
import { getGuestId } from "@/lib/guest";
import { connectDB } from "@/lib/mongodb";
import { Conversation } from "@/lib/models/Conversation";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestId = await getGuestId();

  if (!guestId || !mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const conversation = await Conversation.findOne({ _id: id, guestId }).lean();
  if (!conversation) notFound();

  const messages = conversation.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return <ChatWindow key={id} initialConversationId={id} initialMessages={messages} />;
}