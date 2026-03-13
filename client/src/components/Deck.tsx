import { memo, useState } from 'react';
import type { DeckObject } from '@tabletop-arena/shared';

interface DeckProps {
  deck: DeckObject;
  onDrawToHand: () => void;
  onDrawToTable: () => void;
  onShuffle: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const Deck = memo(function Deck({
  deck,
  onDrawToHand,
  onDrawToTable,
  onShuffle,
  onPointerDown,
  onContextMenu,
  style,
  className = '',
}: DeckProps) {
  const [shuffling, setShuffling] = useState(false);
  const count = deck.cardIds.length;
  // Show up to 4 layers based on card count
  const layers = Math.min(count, 4);

  const handleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShuffling(true);
    onShuffle();
    setTimeout(() => setShuffling(false), 450);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only draw on plain click (no dragging)
    if (count === 0) return;
    e.stopPropagation();
    onDrawToHand();
  };

  return (
    <div
      className={`deck ${shuffling ? 'shuffling' : ''} ${className}`}
      style={style}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      <div className="deck-actions">
        {count > 0 && (
          <>
            <button className="deck-action-btn" onClick={(e) => { e.stopPropagation(); onDrawToHand(); }}>
              Draw
            </button>
            <button className="deck-action-btn" onClick={(e) => { e.stopPropagation(); onDrawToTable(); }}>
              Flip
            </button>
          </>
        )}
        {count > 1 && (
          <button className="deck-action-btn" onClick={handleShuffle}>
            Shuffle
          </button>
        )}
      </div>

      <div className="deck-stack">
        {Array.from({ length: layers }, (_, i) => (
          <div key={i} className="deck-card-layer" />
        ))}
        {count > 0 && <div className="deck-count">{count}</div>}
      </div>

      <div className="deck-label">{deck.name || 'Deck'}</div>
    </div>
  );
});
