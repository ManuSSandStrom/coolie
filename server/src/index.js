import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectMongo } from './db.js';
import { router as chatRouter } from './routes/chat.js';

const app = express();
app.use(cors());

// Relaxed rate limit for debugging
const limiter = rateLimit({ 
  windowMs: 60 * 1000, 
  limit: 100, 
  standardHeaders: true, 
  legacyHeaders: false 
});
app.use(limiter);
app.use(express.json({ limit: '50kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.get('/health/db', async (_req, res) => { 
  try { 
    const { pingMongo } = await import('./db.js'); 
    await pingMongo(); 
    res.json({ ok: true, status: 'connected' }); 
  } catch (e) { 
    res.status(500).json({ ok: false, error: e.message }); 
  } 
});

app.use('/api', chatRouter);

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error('[Global Error]', err);
  const status = err.status || 500;
  res.status(status).json({ 
    error: err.message || 'Internal Server Error',
    type: err.name
  });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Startup Checks
if (!process.env.OPENAI_API_KEY) console.warn('[CHECK] OPENAI_API_KEY is missing!');
if (!MONGODB_URI) console.error('[CHECK] MONGODB_URI is missing!');

connectMongo(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Coolie server listening on :${PORT}`));
  })
  .catch((e) => {
    console.error('Failed to start server:', e.message);
    process.exit(1);
  });
