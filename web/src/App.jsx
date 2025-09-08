import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Chat from './components/Chat.jsx';
import { listConversations, createConversation, getMessages, sendChat, streamChat, renameConversation, deleteConversation } from './api.js';

export default function App() {
  const [convos, setConvos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  async function refreshConvos(selectLatest = false) {
    const list = await listConversations();
    setConvos(list);
    if (selectLatest && list[0]) setActiveId(list[0].id);
  }

  async function ensureConversation() {
    if (!activeId) {
      const created = await createConversation('New Chat');
      setActiveId(created.id);
      await refreshConvos();
      return created.id;
    }
    return activeId;
  }

  async function loadMessages(id) {
    if (!id) return;
    const msgs = await getMessages(id);
    setMessages(msgs);
  }

  useEffect(() => { refreshConvos(true); }, []);
  useEffect(() => { loadMessages(activeId); }, [activeId]);

  async function handleSend() {
    const content = input.trim();
    if (!content) return;
    setSending(true);
    try {
      const id = await ensureConversation();
      const optimisticUser = { role: 'user', content, createdAt: new Date().toISOString() };
      setMessages(prev => [...prev, optimisticUser, { role: 'assistant', content: '', createdAt: new Date().toISOString() }]);
      setInput('');

      let appended = '';
      const close = streamChat({
        conversationId: id,
        message: content,
        onDelta: (delta) => {
          appended += delta;
          setMessages(prev => {
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') last.content = appended;
            return copy;
          });
        },
        onDone: async (cid) => {
          if (cid && cid !== activeId) setActiveId(cid);
          await refreshConvos();
          setSending(false);
          inputRef.current?.focus();
        },
        onError: (e) => {
          console.error(e);
          setSending(false);
        }
      });
    } catch (e) {
      alert(e.message || 'Failed to send');
    } finally {
      // sending state handled in stream callbacks
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="app">
      <Sidebar
        items={convos}
        activeId={activeId}
        onNew={async () => {
          const c = await createConversation('New Chat');
          setActiveId(c.id);
          setMessages([]);
          await refreshConvos();
        }}
        onSelect={(id) => setActiveId(id)}
        onRename={async (id, curTitle) => {
          const next = prompt("Rename conversation", curTitle || "");
          if (next && next.trim()) {
            await renameConversation(id, next.trim());
            await refreshConvos();
          }
        }}
        onDelete={async (id) => {
          if (confirm("Delete this conversation?")) {
            await deleteConversation(id);
            if (activeId === id) { setActiveId(null); setMessages([]); }
            await refreshConvos();
          }
        }}
      />

      <div className="chat">
        <div className="header">
          <div className="header-title">Coolie</div>
        </div>

        <Chat messages={messages} />

        <div className="inputbar">
          <div className="inputrow">
            <textarea
              ref={inputRef}
              className="textarea"
              placeholder="Ask Coolie about code or bugs..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="button" onClick={handleSend} disabled={sending}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}





