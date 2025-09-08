import React from 'react';

export default function Sidebar({ items, activeId, onNew, onSelect, onRename, onDelete }) {
  return (
    <div className="sidebar">
      <h1>Coolie</h1>
      <button className="button" onClick={onNew} style={{ width: '100%', marginBottom: 10 }}>New Chat</button>
      <div>
        {items.map(item => (
          <div
            key={item.id}
            className={`side-item ${activeId === item.id ? 'active' : ''}`}
            title={item.title}
          >
            <span onClick={() => onSelect(item.id)} style={{ flex: 1 }}>{item.title}</span>
            <span style={{ float: 'right' }}>
              <span className="copy" onClick={() => onRename(item.id, item.title)} title="Rename">✎</span>
              <span className="copy" onClick={() => onDelete(item.id)} title="Delete">🗑</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
