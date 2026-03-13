import { useState } from 'react';
import type { SocketActions } from '../hooks/useSocket';

interface LobbyProps {
  actions: SocketActions;
  error: string | null;
  connected: boolean;
}

export function Lobby({ actions, error, connected }: LobbyProps) {
  const [createName, setCreateName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const handleCreate = () => {
    const name = createName.trim();
    if (name.length > 0) {
      actions.createRoom(name);
    }
  };

  const handleJoin = () => {
    const name = joinName.trim();
    const code = joinCode.trim().toUpperCase();
    if (name.length > 0 && code.length === 6) {
      actions.joinRoom(code, name);
    }
  };

  const handleCodeInput = (value: string) => {
    // Only allow alphanumeric, max 4 chars
    const sanitized = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    setJoinCode(sanitized);
  };

  return (
    <div className="lobby">
      <h1 className="lobby-title">Tabletop Arena</h1>
      <p className="lobby-subtitle">Play cards and dice with friends in real time</p>

      {error && <div className="lobby-error">{error}</div>}

      <div className="lobby-panels">
        {/* Create Room Panel */}
        <div className="lobby-panel">
          <h2>Create a Room</h2>
          <p>Start a new table and invite friends with a room code.</p>
          <input
            className="lobby-input"
            type="text"
            placeholder="Your name"
            maxLength={20}
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button
            className="lobby-btn"
            onClick={handleCreate}
            disabled={!connected || createName.trim().length === 0}
          >
            Create Room
          </button>
        </div>

        {/* Join Room Panel */}
        <div className="lobby-panel">
          <h2>Join a Room</h2>
          <p>Enter a 6-character room code to join an existing table.</p>
          <input
            className="lobby-input room-code"
            type="text"
            placeholder="CODE"
            maxLength={6}
            value={joinCode}
            onChange={e => handleCodeInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <input
            className="lobby-input"
            type="text"
            placeholder="Your name"
            maxLength={20}
            value={joinName}
            onChange={e => setJoinName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <button
            className="lobby-btn"
            onClick={handleJoin}
            disabled={!connected || joinName.trim().length === 0 || joinCode.length !== 6}
          >
            Join Room
          </button>
        </div>
      </div>

      {!connected && (
        <p style={{ marginTop: 24, color: 'var(--text-muted)', fontSize: 13 }}>
          Connecting to server...
        </p>
      )}
    </div>
  );
}
