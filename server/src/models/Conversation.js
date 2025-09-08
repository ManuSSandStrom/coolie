import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model('Conversation', ConversationSchema);
