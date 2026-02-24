import OpenAI from "openai";

let client;
export function getOpenAI() {
  if (!client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key.trim() === "") {
      throw new Error('OPENAI_API_KEY is missing. Please set it in your Render/Deployment environment variables.');
    }
    const baseURL = process.env.OPENAI_BASE_URL || undefined;
    client = new OpenAI({ 
      apiKey: key, 
      baseURL: baseURL 
    });
    console.log('[OpenAI] Client initialized successfully');
  }
  return client;
}

export function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

const SYSTEM_PROMPT = `You are Coolie, a concise, friendly, and highly capable coding assistant.
- Answer with plain text only. No images or files.
- Prefer minimal, correct code examples using fenced blocks.
- When fixing bugs, explain the root cause and a targeted fix.
- Keep responses tight; avoid unnecessary prose.`;

export async function generateChatReply(history) {
  const client = getOpenAI();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role, content: m.content }))
  ];

  const completion = await client.chat.completions.create({
    model: getModel(),
    messages,
    temperature: 0.2,
  });

  return completion.choices?.[0]?.message?.content?.trim() ?? '';
}
