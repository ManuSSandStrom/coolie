import express from "express";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { generateChatReply, getOpenAI, getModel } from "../openai.js";


export const router = express.Router();

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
    const list = await Conversation.find().sort({ updatedAt: -1 }).limit(50).lean();
    res.json(list.map(c => ({ id: c._id.toString(), title: c.title, updatedAt: c.updatedAt })));
  } catch (err) { next(err); }
});

// Rename conversation
router.patch('/conversations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
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
    await Message.deleteMany({ conversationId: id });
    await Conversation.deleteOne({ _id: id });
    res.json({ id, deleted: true });
  } catch (err) { next(err); }
});

// Get messages for a conversation
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const msgs = await Message.find({ conversationId: id }).sort({ createdAt: 1 }).lean();
    res.json(msgs.map(m => ({ id: m._id.toString(), role: m.role, content: m.content, createdAt: m.createdAt })));
  } catch (err) { next(err); }
});

// Chat endpoint: send user message, get assistant reply (non-streaming)
router.post('/chat', async (req, res, next) => {
  try {
    const body = req.body || {};
    const conversationId = body.conversationId;
    const message = body.message;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message is required' });
    if (message.length > 4000) return res.status(413).json({ error: 'message too long' });

    let convoId = conversationId;
    if (!convoId) {
      const title = message.trim().slice(0, 60) || 'New Chat';
      const convo = await Conversation.create({ title });
      convoId = convo._id.toString();
    }

    await Message.create({ conversationId: convoId, role: 'user', content: message });

    // If conversation title is placeholder, update from first message
    const convoDoc = await Conversation.findById(convoId).lean();
    if (convoDoc && (!convoDoc.title || convoDoc.title === 'New Chat')) {
      await Conversation.updateOne({ _id: convoId }, { $set: { title: message.trim().slice(0, 60) || 'New Chat' } });
    }

    const recent = await Message.find({ conversationId: convoId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    const history = recent.reverse();

    const reply = await generateChatReply(history);
    await Message.create({ conversationId: convoId, role: 'assistant', content: reply });

    // Touch conversation updated time
    await Conversation.updateOne({ _id: convoId }, { $set: { updatedAt: new Date() } });

    res.json({ conversationId: convoId, reply });
  } catch (err) { next(err); }
});

// Streaming chat via SSE for typing effect
router.get('/chat/stream', async (req, res, next) => {
  try {
    const message = (req.query.q || '').toString();
    const conversationId = req.query.conversationId ? req.query.conversationId.toString() : undefined;
    if (!message) return res.status(400).end();
    if (message.length > 4000) return res.status(413).end();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    let closed = false;
    req.on('close', () => { closed = true; });

    let convoId = conversationId;
    if (!convoId) {
      const title = message.trim().slice(0, 60) || 'New Chat';
      const convo = await Conversation.create({ title });
      convoId = convo._id.toString();
    }

    await Message.create({ conversationId: convoId, role: 'user', content: message });

    const convoDoc = await Conversation.findById(convoId).lean();
    if (convoDoc && (!convoDoc.title || convoDoc.title === 'New Chat')) {
      await Conversation.updateOne({ _id: convoId }, { $set: { title: message.trim().slice(0, 60) || 'New Chat' } });
    }

    const recent = await Message.find({ conversationId: convoId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    const history = recent.reverse();

    // Stream from OpenAI
    const client = getOpenAI();
    const messages = history.map(m => ({ role: m.role, content: m.content }));
    const stream = await client.chat.completions.create({
      model: getModel(),
      messages: messages,
      temperature: 0.2,
      stream: true,
    });

    let full = '';
    for await (const part of stream) {
      if (closed) break;
      const delta = (part.choices && part.choices[0] && part.choices[0].delta && part.choices[0].delta.content) || '';
      if (delta) {
        full += delta;
        res.write('data: ' + JSON.stringify({ type: 'delta', data: delta }) + '\n\n');
      }
    }

    if (!closed) {
      await Message.create({ conversationId: convoId, role: 'assistant', content: full });
      await Conversation.updateOne({ _id: convoId }, { $set: { updatedAt: new Date() } });
      res.write('data: ' + JSON.stringify({ type: 'done', conversationId: convoId }) + '\n\n');
    }
    res.end();
  } catch (err) { next(err); }
});




