import { memo } from 'react';
import type { CardObject, PlayerColor } from '@tabletop-arena/shared';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

function suitColor(suit: string): 'red' | 'black' {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

interface CardProps {
  card: CardObject;
  lockedByColor?: PlayerColor | null;
  /** If true, always show face-up (for hand cards) */
  forceFaceUp?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const Card = memo(function Card({
  card,
  lockedByColor,
  forceFaceUp,
  style,
  className = '',
  onPointerDown,
  onDoubleClick,
  onContextMenu,
}: CardProps) {
  const showFace = forceFaceUp || card.faceUp;
  const color = suitColor(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit] ?? '?';

  return (
    <div
      className={`card ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className={`card-inner ${showFace ? '' : 'flipped'}`}>
        {/* Front face */}
        <div className={`card-face ${color}`}>
          <div className="card-top">
            <span className="card-rank">{card.rank}</span>
            <span className="card-suit-small">{symbol}</span>
          </div>
          <span className="card-center-suit">{symbol}</span>
          <div className="card-bottom">
            <span className="card-rank">{card.rank}</span>
            <span className="card-suit-small">{symbol}</span>
          </div>
        </div>
        {/* Back face */}
        <div className="card-back">
          <div className="card-back-pattern">
            <span className="card-back-logo">TA</span>
          </div>
        </div>
      </div>
      {lockedByColor && (
        <div
          className="lock-indicator"
          style={{ background: `var(--color-${lockedByColor})` }}
        />
      )}
    </div>
  );
});
