import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';

const API = '/api';
const token = () => localStorage.getItem('accessToken');
const authHeaders = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

const ROOMS = [
  { id: 'general',   icon: '💬', name: 'General',       desc: 'Team-wide announcements' },
  { id: 'engineers', icon: '🔧', name: 'Engineers',      desc: 'Technical team chat' },
  { id: 'billing',   icon: '💼', name: 'Billing',         desc: 'Payment & invoice queries' },
  { id: 'cases',     icon: '📂', name: 'Case Updates',    desc: 'Case status discussion' },
];

const fmtTime = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const initials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

export default function TeamChatPage() {
  const { user } = useAuth();
  const [room, setRoom] = useState('general');
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typing, setTyping] = useState(null);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const getRoomMessages = useCallback(async (roomId) => {
    try {
      const res = await fetch(`${API}/chat/messages?room=${roomId}`, { headers: authHeaders() });
      const data = await res.json();
      setMessages(prev => ({ ...prev, [roomId]: data.messages || [] }));
    } catch {}
  }, []);

  const getOnlineUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/chat/online`, { headers: authHeaders() });
      const data = await res.json();
      setOnlineUsers(data.users || []);
    } catch {}
  }, []);

  useEffect(() => {
    getRoomMessages(room);
    getOnlineUsers();
    // Poll every 3 seconds
    pollRef.current = setInterval(() => {
      getRoomMessages(room);
      getOnlineUsers();
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [room, getRoomMessages, getOnlineUsers]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[room]]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    // Optimistic update
    const tempMsg = {
      id: `temp_${Date.now()}`,
      room, text,
      sender_id: user?.id,
      sender_name: user?.fullName || user?.username || 'You',
      sender_role: user?.role,
      created_at: new Date().toISOString(),
      is_own: true,
    };
    setMessages(prev => ({ ...prev, [room]: [...(prev[room] || []), tempMsg] }));
    try {
      await fetch(`${API}/chat/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ room, text }),
      });
      getRoomMessages(room); // refresh for server-side data
    } catch {}
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const currentRoom = ROOMS.find(r => r.id === room);
  const msgs = messages[room] || [];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>💬 Team Chat</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Real-time internal communication across your team</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {onlineUsers.slice(0, 5).map((u, i) => (
            <div key={i} title={u.name} style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', fontWeight: 700, color: 'white',
              border: '2px solid var(--status-success)',
              marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i,
              position: 'relative',
            }}>
              {initials(u.name)}
            </div>
          ))}
          {onlineUsers.length > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--status-success)', marginLeft: 6 }}>
              {onlineUsers.length} online
            </span>
          )}
        </div>
      </div>

      <div className="chat-layout">
        {/* Room list */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-title">Channels</div>
          {ROOMS.map(r => (
            <button key={r.id} className={`chat-room-item ${room === r.id ? 'active' : ''}`} onClick={() => setRoom(r.id)}>
              <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
              <span>{r.name}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>You</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: 'white', flexShrink: 0,
              }}>
                {initials(user?.fullName || user?.username)}
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.fullName || user?.username}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--status-success)' }}>● Online</div>
              </div>
            </div>
          </div>
        </div>

        {/* Message area */}
        <div className="chat-messages-area">
          <div className="chat-header">
            <span style={{ fontSize: '1.2rem' }}>{currentRoom?.icon}</span>
            <span>{currentRoom?.name}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>— {currentRoom?.desc}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)' }}>↻ Auto-refreshes every 3s</span>
          </div>

          <div className="chat-messages-list">
            {msgs.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 8 }}>
                <div style={{ fontSize: '2.5rem' }}>{currentRoom?.icon}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No messages yet in #{currentRoom?.name}</div>
                <div style={{ fontSize: '0.75rem' }}>Be the first to say something!</div>
              </div>
            ) : (
              msgs.map((msg, i) => {
                const isOwn = msg.sender_id === user?.id || msg.is_own;
                const showAvatar = i === 0 || msgs[i - 1]?.sender_id !== msg.sender_id;
                return (
                  <div key={msg.id || i} className={`chat-msg ${isOwn ? 'own' : ''}`}>
                    <div className="chat-msg-avatar" style={{ visibility: showAvatar ? 'visible' : 'hidden' }}>
                      {msg.avatar ? <img src={msg.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : initials(msg.sender_name)}
                    </div>
                    <div>
                      {showAvatar && (
                        <div className="chat-msg-name">
                          {msg.sender_name}
                          {msg.sender_role && <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400, fontSize: '0.6rem' }}>
                            ({msg.sender_role?.replace(/_/g, ' ')})
                          </span>}
                        </div>
                      )}
                      <div className="chat-msg-bubble">{msg.text}</div>
                      <div className="chat-msg-time">{fmtTime(msg.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
            {typing && (
              <div className="chat-msg">
                <div className="chat-msg-avatar">...</div>
                <div className="chat-msg-bubble" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {typing} is typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-bar" onSubmit={sendMessage}>
            <input
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${currentRoom?.name}... (Enter to send)`}
              disabled={sending}
              autoFocus
            />
            <button type="submit" className="chat-send-btn" disabled={!input.trim() || sending} title="Send message">
              ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
