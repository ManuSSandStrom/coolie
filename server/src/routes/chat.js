import express from "express";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { generateChatReply, getOpenAI, getModel } from "../openai.js";

export const router = express.Router();

// Ensure DB is connected
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database connection not ready. Please try again in a moment." });
  }
  next();
});

const SYSTEM_PROMPT = `You are Coolie, a concise, friendly, and highly capable coding assistant.
- Answer with plain text only. No images or files.
- Prefer minimal, correct code examples using fenced blocks.
- When fixing bugs, explain the root cause and a targeted fix.
- Keep responses tight; avoid unnecessary prose.`;

// Create conversation
router.post('/conversations', async (req, res, next) => {
  try {
    const title = (req.body?.title || 'New Chat').slice(0, 120);
    const convo = await Conversation.create({ title });
    res.json({ id: convo._id.toString(), title: convo.title, createdAt: convo.createdAt });
  } catch (err) { next(err); }
});

// List conversations
router.get('/conversations', async (_req, res, next) => {
  try {
    const list = await Conversation.find().sort({ updatedAt: -1 }).limit(100).lean();
    res.json(list.map(c => ({ id: c._id.toString(), title: c.title, updatedAt: c.updatedAt })));
  } catch (err) { next(err); }
});

// Rename conversation
router.patch('/conversations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'invalid id' });
    const title = (req.body?.title || '').toString().trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: 'title is required' });
    await Conversation.updateOne({ _id: id }, { $set: { title, updatedAt: new Date() } });
    res.json({ id, title });
  } catch (err) { next(err); }
});

// Delete conversation and its messages
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'invalid id' });
    await Message.deleteMany({ conversationId: id });
    await Conversation.deleteOne({ _id: id });
    res.json({ id, deleted: true });
  } catch (err) { next(err); }
});

// Get messages for a conversation
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'invalid id' });
    const msgs = await Message.find({ conversationId: id }).sort({ createdAt: 1 }).lean();
    res.json(msgs.map(m => ({ id: m._id.toString(), role: m.role, content: m.content, createdAt: m.createdAt })));
  } catch (err) { next(err); }
});

// Non-streaming chat (fallback)
router.post('/chat', async (req, res, next) => {
  try {
    const { conversationId, message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    let convoId = conversationId;
    if (convoId && !mongoose.Types.ObjectId.isValid(convoId)) convoId = undefined;
    
    if (convoId) {
      const exists = await Conversation.exists({ _id: convoId });
      if (!exists) convoId = undefined;
    }

    if (!convoId) {
      const convo = await Conversation.create({ title: message.trim().slice(0, 60) || 'New Chat' });
      convoId = convo._id.toString();
    }

    await Message.create({ conversationId: convoId, role: 'user', content: message });

    const recent = await Message.find({ conversationId: convoId }).sort({ createdAt: -1 }).limit(10).lean();
    const history = recent.reverse();

    const reply = await generateChatReply(history);
    await Message.create({ conversationId: convoId, role: 'assistant', content: reply });
    await Conversation.updateOne({ _id: convoId }, { $set: { updatedAt: new Date() } });

    res.json({ conversationId: convoId, reply });
  } catch (err) { next(err); }
});

// Streaming chat via SSE
router.get('/chat/stream', async (req, res, next) => {
  let convoId;
  try {
    const message = (req.query.q || '').toString();
    let maybeId = req.query.conversationId ? req.query.conversationId.toString() : undefined;
    
    if (!message) return res.status(400).end();

    // Validate conversationId
    if (maybeId && mongoose.Types.ObjectId.isValid(maybeId)) {
      const exists = await Conversation.exists({ _id: maybeId });
      if (exists) convoId = maybeId;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let closed = false;
    req.on('close', () => { closed = true; });

    if (!convoId) {
      const convo = await Conversation.create({ title: message.trim().slice(0, 60) || 'New Chat' });
      convoId = convo._id.toString();
    }

    await Message.create({ conversationId: convoId, role: 'user', content: message });

    const recent = await Message.find({ conversationId: convoId }).sort({ createdAt: -1 }).limit(10).lean();
    const history = recent.reverse();

    const client = getOpenAI();
    const model = getModel();
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(m => ({ role: m.role, content: m.content }))
    ];

    const stream = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.2,
      stream: true,
    });

    let full = '';
    for await (const part of stream) {
      if (closed) break;
      const delta = part.choices?.[0]?.delta?.content || '';
      if (delta) {
        full += delta;
        res.write(`data: ${JSON.stringify({ type: 'delta', data: delta })}\n\n`);
      }
    }

    if (!closed) {
      await Message.create({ conversationId: convoId, role: 'assistant', content: full });
      await Conversation.updateOne({ _id: convoId }, { $set: { updatedAt: new Date() } });
      res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convoId })}\n\n`);
    }
    res.end();
  } catch (err) {
    console.error('[stream-error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  }
});
