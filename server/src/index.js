import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectMongo } from './db.js';
import { router as chatRouter } from './routes/chat.js';

const app = express();
app.use(cors());
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
app.use(limiter);
app.use(express.json({ limit: '20kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/health/db', async (_req, res) => { try { const { pingMongo } = await import('./db.js'); await pingMongo(); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false, error: e.message }); } });
app.use('/api', chatRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

connectMongo(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Coolie server listening on :${PORT}`));
  })
  .catch((e) => {
    console.error('Failed to start server:', e.message);
    process.exit(1);
  });


