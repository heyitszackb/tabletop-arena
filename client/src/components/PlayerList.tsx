import { memo } from 'react';
import type { Player } from '@tabletop-arena/shared';

interface PlayerListProps {
  players: Record<string, Player>;
  myPlayerId: string | null;
  otherHands: Record<string, number>;
}

export const PlayerList = memo(function PlayerList({
  players,
  myPlayerId,
  otherHands,
}: PlayerListProps) {
  const sorted = Object.values(players).sort((a, b) => {
    // Host first, then alphabetical
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="player-list">
      {sorted.map(player => {
        const isMe = player.id === myPlayerId;
        const handCount = otherHands[player.id];
        return (
          <div
            key={player.id}
            className={`player-badge ${player.connected ? '' : 'disconnected'}`}
          >
            <div
              className="player-dot"
              style={{ background: `var(--color-${player.color})` }}
            />
            <span className="player-name">
              {player.name}
              {isMe ? ' (you)' : ''}
            </span>
            {player.isHost && <span className="player-host-badge">Host</span>}
            {!isMe && handCount !== undefined && handCount > 0 && (
              <span className="player-hand-count">{handCount} card{handCount !== 1 ? 's' : ''}</span>
            )}
            {!player.connected && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>offline</span>
            )}
          </div>
        );
      })}
    </div>
  );
});
