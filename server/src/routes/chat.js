import express from "express";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { generateChatReply, getOpenAI, getModel } from "../openai.js";

export const router = express.Router();

// Middleware: Ensure DB is connected
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database connection not ready. Check MONGODB_URI." });
  }
  next();
});

const SYSTEM_PROMPT = `You are Coolie, a concise, friendly, and highly capable coding assistant.
- Answer with plain text only. No images or files.
- Prefer minimal, correct code examples using fenced blocks.
- When fixing bugs, explain the root cause and a targeted fix.
- Keep responses tight; avoid unnecessary prose.`;

// Diagnostic route
router.get('/debug', async (req, res) => {
  res.json({
    db: mongoose.connection.readyState === 1 ? 'OK' : 'Disconnected',
    openai_key_set: !!process.env.OPENAI_API_KEY,
    model: getModel(),
    timestamp: new Date().toISOString()
  });
});

// List conversations
router.get('/conversations', async (_req, res, next) => {
  try {
    const list = await Conversation.find().sort({ updatedAt: -1 }).limit(100).lean();
    res.json(list.map(c => ({ id: c._id.toString(), title: c.title, updatedAt: c.updatedAt })));
  } catch (err) { next(err); }
});

// Create conversation
router.post('/conversations', async (req, res, next) => {
  try {
    const title = (req.body?.title || 'New Chat').slice(0, 120);
    const convo = await Conversation.create({ title });
    res.json({ id: convo._id.toString(), title: convo.title, createdAt: convo.createdAt });
  } catch (err) { next(err); }
});

// Get messages
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const msgs = await Message.find({ conversationId: id }).sort({ createdAt: 1 }).lean();
    res.json(msgs.map(m => ({ id: m._id.toString(), role: m.role, content: m.content, createdAt: m.createdAt })));
  } catch (err) { next(err); }
});

// Streaming chat via SSE
router.get('/chat/stream', async (req, res, next) => {
  let convoId;
  try {
    const message = (req.query.q || '').toString();
    const maybeId = req.query.conversationId;
    
    if (!message) return res.status(400).json({ error: "Query 'q' is required" });

    // Step 1: Validate OpenAI Setup before setting stream headers
    let client;
    try {
      client = getOpenAI();
    } catch (e) {
      console.error('[CRITICAL] OpenAI Config Error:', e.message);
      return res.status(500).json({ error: e.message });
    }

    // Step 2: Validate/Find/Create Conversation
    if (maybeId && mongoose.Types.ObjectId.isValid(maybeId)) {
      const exists = await Conversation.findById(maybeId).select('_id').lean();
      if (exists) convoId = maybeId;
    }

    if (!convoId) {
      const convo = await Conversation.create({ title: message.trim().slice(0, 60) || 'New Chat' });
      convoId = convo._id.toString();
    }

    // Step 3: Save User Message
    await Message.create({ conversationId: convoId, role: 'user', content: message });

    // Step 4: Prepare History
    const recent = await Message.find({ conversationId: convoId }).sort({ createdAt: -1 }).limit(10).lean();
    const history = recent.reverse();

    // Step 5: Start Stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = await client.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map(m => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.2,
      stream: true,
    });

    let full = '';
    let closed = false;
    req.on('close', () => { closed = true; });

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
    console.error('[Stream Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Stream start failed: " + err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  }
});
