import mongoose, { Schema } from "mongoose";
import type { InferSchemaType, Model } from "mongoose";

// one chat message (stored inside a conversation)
const messageSchema = new Schema({
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    intent: { type: String },         // assitant messages only
    confidence: { type: Number },     // assistant messages only
    route: { type: String },          // greeting, refuse, clarify, asnwer, answer_static, refule llm  
    feedback: { type: String, enum: ["up", "down"] }, //missing means no feedback yet 
});

const conversationSchema = new Schema(
    {
        guestID: {type: String, required: true },
        title: { type: String, default: "New chat" },
        messages: { type: [messageSchema], default: []},
        expiredAt: { type: Date, required: true }, // auto-delete after this date
    },
    { timestamps: true } // adds createdAt and updatedAt automatically
);

// Fast "list this guest's chats, newest first"
conversationSchema.index({ guestId: 1, updatedAt: -1 });
// MongoDB deletes the document once expiresAt has passed
conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ConversationDoc = InferSchemaType<typeof conversationSchema>;

export const Conversation: Model<ConversationDoc> =
  (mongoose.models.Conversation as Model<ConversationDoc>) ||
  mongoose.model<ConversationDoc>("Conversation", conversationSchema);