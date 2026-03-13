import { useRef, useCallback } from 'react';
import type { CardObject, Position } from '@tabletop-arena/shared';
import { Card } from './Card';

interface HandProps {
  cards: CardObject[];
  onPlayCard: (cardId: string, pos: Position, faceUp: boolean) => void;
}

export function Hand({ cards, onPlayCard }: HandProps) {
  const dragRef = useRef<{
    cardId: string;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
    ghost: HTMLDivElement | null;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, cardId: string) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);

      dragRef.current = {
        cardId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        ghost: null,
      };

      const handleMove = (ev: PointerEvent) => {
        const state = dragRef.current;
        if (!state || ev.pointerId !== state.pointerId) return;

        const dx = ev.clientX - state.startX;
        const dy = ev.clientY - state.startY;

        if (!state.dragging && Math.abs(dx) + Math.abs(dy) > 8) {
          state.dragging = true;
          // Create a ghost card for visual feedback
          const ghost = document.createElement('div');
          ghost.className = 'hand-drag-ghost';
          ghost.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 10000;
            width: 70px;
            height: 100px;
            background: rgba(108, 99, 255, 0.3);
            border: 2px dashed var(--accent);
            border-radius: 6px;
            opacity: 0.8;
          `;
          document.body.appendChild(ghost);
          state.ghost = ghost;
        }

        if (state.dragging && state.ghost) {
          state.ghost.style.left = `${ev.clientX - 35}px`;
          state.ghost.style.top = `${ev.clientY - 50}px`;
        }
      };

      const handleUp = (ev: PointerEvent) => {
        const state = dragRef.current;
        if (!state || ev.pointerId !== state.pointerId) return;

        if (state.ghost) {
          state.ghost.remove();
        }

        if (state.dragging) {
          // Check if dropped on the table surface
          const table = document.querySelector('.table-surface');
          if (table) {
            const tableRect = table.getBoundingClientRect();
            const x = ev.clientX - tableRect.left - 35;
            const y = ev.clientY - tableRect.top - 50;

            // Only play if dropped within the table area (above the hand)
            if (
              ev.clientX >= tableRect.left &&
              ev.clientX <= tableRect.right &&
              ev.clientY >= tableRect.top &&
              ev.clientY <= tableRect.bottom - 100 // Don't count hand area
            ) {
              onPlayCard(state.cardId, { x, y }, true);
            }
          }
        }

        dragRef.current = null;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [onPlayCard],
  );

  if (cards.length === 0) return null;

  return (
    <div className="hand-area">
      <div className="hand-label">Your Hand ({cards.length} card{cards.length !== 1 ? 's' : ''})</div>
      <div className="hand-cards">
        {cards.map((card) => (
          <div
            key={card.id}
            className="hand-card-wrapper"
            onPointerDown={e => handlePointerDown(e, card.id)}
          >
            <Card card={card} forceFaceUp />
          </div>
        ))}
      </div>
    </div>
  );
}
