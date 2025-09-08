import React from 'react';

function renderContent(text) {
  const parts = (text || '').split(/```/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <pre key={i} className="code"><code>{part}</code></pre>;
    }
    return <span key={i}>{part}</span>;
  });
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch {}
}

export default function Chat({ messages }) {
  return (
    <div className="messages">
      {messages.map(m => (
        <div key={m.id || m.createdAt} className={`msg ${m.role}`}>
          <div className="role">
            {m.role}
            {m.content && (
              <span className="copy" onClick={() => copyText(m.content)}>Copy</span>
            )}
          </div>
          <div>{renderContent(m.content)}</div>
        </div>
      ))}
    </div>
  );
}
