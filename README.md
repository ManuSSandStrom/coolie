Coolie — Text-Only AI Code Assistant

Overview
- Coolie is a text-only, code-focused chatbot with a Node.js + Express + MongoDB backend and a responsive React web client that works well on desktop and mobile.
- It does not handle files or images. It’s optimized for code answers and bug fixing, with clean monospace presentation and fenced code blocks.

Security First
- Do NOT paste API keys in code. Use environment variables.
- Set `OPENAI_API_KEY` and `MONGODB_URI` in `server/.env` (copy from `server/.env.example`).

Project Structure
- `server/`: Express API, MongoDB models, OpenAI integration
- `web/`: React (Vite) client, responsive chat UI

Quick Start
1) Server
   - cd `server`
   - Copy `.env.example` to `.env` and set values.
   - Install deps: `npm install`
   - Run: `npm run dev` (or `npm start`)

2) Web
   - cd `web`
   - Install deps: `npm install`
   - Run dev: `npm run dev`
   - Default API base: `http://localhost:3000` (override with `VITE_API_BASE`)

Environment Variables (server/.env)
- `PORT` — server port (default 3000)
- `OPENAI_API_KEY` — your OpenAI API key
- `MONGODB_URI` — your MongoDB connection string

Notes
- Text-only by design: no images, no file uploads.
- Conversation history is stored in MongoDB. Messages are limited to the latest window when sending to OpenAI for performance.
- The UI renders fenced code blocks using ``` fences in responses.
