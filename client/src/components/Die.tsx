import { memo } from 'react';
import type { DieObject } from '@tabletop-arena/shared';

interface DieProps {
  die: DieObject;
  onRoll: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * D6 pip layout: each cell of a 3x3 grid is either filled or empty.
 * Key: pip positions by value (1-indexed from top-left, row by row):
 *   1: center
 *   2: top-right, bottom-left
 *   3: top-right, center, bottom-left
 *   4: four corners
 *   5: four corners + center
 *   6: left column + right column
 */
const D6_PIPS: Record<number, number[]> = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 4, 7, 3, 6, 9],
};

function D6Face({ value }: { value: number }) {
  const pips = D6_PIPS[value] ?? D6_PIPS[1]!;
  return (
    <div className="d6-face">
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          className={`d6-pip ${pips.includes(i + 1) ? '' : 'empty'}`}
        />
      ))}
    </div>
  );
}

/** SVG shapes for polyhedral dice */
function PolyShape({ sides }: { sides: number }) {
  switch (sides) {
    case 4:
      return (
        <svg viewBox="0 0 52 52">
          <polygon points="26,4 4,48 48,48" />
        </svg>
      );
    case 8:
      return (
        <svg viewBox="0 0 52 52">
          <polygon points="26,2 50,26 26,50 2,26" />
        </svg>
      );
    case 10:
      return (
        <svg viewBox="0 0 52 52">
          <polygon points="26,2 48,20 42,48 10,48 4,20" />
        </svg>
      );
    case 12:
      return (
        <svg viewBox="0 0 52 52">
          <polygon points="26,2 46,12 50,34 38,50 14,50 2,34 6,12" />
        </svg>
      );
    case 20:
      return (
        <svg viewBox="0 0 52 52">
          <polygon points="26,1 47,10 51,33 39,50 13,50 1,33 5,10" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 52 52">
          <rect x="2" y="2" width="48" height="48" rx="6" />
        </svg>
      );
  }
}

export const Die = memo(function Die({
  die,
  onRoll,
  onPointerDown,
  onContextMenu,
  style,
  className = '',
}: DieProps) {
  const isD6 = die.sides === 6;

  return (
    <div
      className={`die ${die.rolling ? 'rolling' : ''} ${className}`}
      style={style}
      onClick={(e) => { e.stopPropagation(); onRoll(); }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      {isD6 ? (
        <D6Face value={die.value} />
      ) : (
        <div className="poly-die">
          <div className="poly-die-shape">
            <div className="poly-die-bg">
              <PolyShape sides={die.sides} />
            </div>
            <span className="poly-die-value">{die.value}</span>
          </div>
        </div>
      )}
      <div className="die-label">d{die.sides}</div>
    </div>
  );
});
