# Coolie — Text-Only AI Code Assistant

## Overview

- **Coolie** is a text-only, code-focused chatbot with a Node.js + Express + MongoDB backend and a responsive React web client that works well on desktop and mobile.
- It is optimized for code answers and bug fixing, with clean monospace presentation and fenced code blocks.

## Security First

- Do **NOT** paste API keys in code. Use environment variables.
- Set `OPENAI_API_KEY` and `MONGODB_URI` in `server/.env` (copy from `server/.env.example`).

## Project Structure

- `server/`: Express API, MongoDB models, OpenAI integration
- `web/`: React (Vite) client, responsive chat UI

## Quick Start

### 1) Server

1.  Navigate to `server`: `cd server`
2.  Copy `.env.example` to `.env` and set values.
3.  Install dependencies: `npm install`
4.  Run: `npm run dev` (or `npm start`)

### 2) Web

1.  Navigate to `web`: `cd web`
2.  Install dependencies: `npm install`
3.  Run dev: `npm run dev`
4.  Default API base: `http://localhost:3000` (override with `VITE_API_BASE`)

## Environment Variables (server/.env)

- `PORT` — server port (default 3000)
- `OPENAI_API_KEY` — your OpenAI API key
- `MONGODB_URI` — your MongoDB connection string

## Deployment

### Backend (Render)

1.  **Create a New Web Service** on Render.
2.  **Connect your GitHub repository**.
3.  **Root Directory**: `server`
4.  **Environment**: `Node`
5.  **Build Command**: `npm install`
6.  **Start Command**: `npm start`
7.  **Environment Variables**:
    - `PORT`: (Auto-set by Render)
    - `MONGODB_URI`: Your MongoDB connection string.
    - `OPENAI_API_KEY`: Your OpenAI API key.

### Frontend (Netlify)

1.  **Create a New Site** from GitHub.
2.  **Base Directory**: `web`
3.  **Build Command**: `npm run build`
4.  **Publish Directory**: `dist` (Note: Netlify usually detects this automatically if the base directory is `web`)
5.  **Environment Variables**:
    - `VITE_API_BASE`: The URL of your backend on Render (e.g., `https://your-app.onrender.com`).

## Notes

- Text-only by design: no images, no file uploads.
- Conversation history is stored in MongoDB.
- UI renders fenced code blocks using ``` syntax.

---

Developed by Manohar
