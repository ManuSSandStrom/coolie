import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
  },
  { timestamps: true }
);

ConversationSchema.index({ updatedAt: -1 });

export const Conversation = mongoose.model('Conversation', ConversationSchema);
