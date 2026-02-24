const API_BASE = 'https://coolie-36i6.onrender.com';

export async function listConversations() {
  const res = await fetch(`${API_BASE}/api/conversations`);
  if (!res.ok) throw new Error('Failed to list conversations');
  return res.json();
}

export async function createConversation(title) {
  const res = await fetch(`${API_BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  return res.json();
}

export async function getMessages(id) {
  const res = await fetch(`${API_BASE}/api/conversations/${id}/messages`);
  if (!res.ok) throw new Error('Failed to get messages');
  return res.json();
}

export async function sendChat({ conversationId, message }) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message })
  });
  if (!res.ok) throw new Error('Chat failed');
  return res.json();
}

export async function renameConversation(id, title) {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  if (!res.ok) throw new Error('Rename failed');
  return res.json();
}

export async function deleteConversation(id) {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

export function streamChat({ conversationId, message, onDelta, onDone, onError }) {
  const q = encodeURIComponent(message);
  const cid = conversationId ? `&conversationId=${encodeURIComponent(conversationId)}` : '';
  const url = `${API_BASE}/api/chat/stream?q=${q}${cid}`;
  const es = new EventSource(url);
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'delta') onDelta && onDelta(msg.data);
      if (msg.type === 'error') { onError && onError(new Error(msg.message)); es.close(); }
      if (msg.type === 'done') { onDone && onDone(msg.conversationId); es.close(); }
    } catch (e) {
      // ignore parse errors
    }
  };
  es.onerror = (e) => { es.close(); onError && onError(e); };
  return () => es.close();
}
