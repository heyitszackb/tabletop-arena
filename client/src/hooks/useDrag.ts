import { useRef, useCallback } from 'react';
import type { Position } from '@tabletop-arena/shared';

interface UseDragOptions {
  onGrab: (id: string) => void;
  onMove: (id: string, pos: Position) => void;
  onRelease: (id: string, pos: Position) => void;
}

interface UseDragReturn {
  handlePointerDown: (e: React.PointerEvent, objectId: string, objectPos: Position) => void;
}

/** Minimum ms between move emissions (~30fps) */
const THROTTLE_MS = 33;

export function useDrag({ onGrab, onMove, onRelease }: UseDragOptions): UseDragReturn {
  const dragState = useRef<{
    objectId: string;
    offsetX: number;
    offsetY: number;
    lastEmit: number;
    pointerId: number;
    currentPos: Position;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, objectId: string, objectPos: Position) => {
      // Only primary button
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);

      // Calculate offset from pointer position to the object's top-left
      const rect = el.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      dragState.current = {
        objectId,
        offsetX,
        offsetY,
        lastEmit: 0,
        pointerId: e.pointerId,
        currentPos: objectPos,
      };

      onGrab(objectId);

      const handlePointerMove = (ev: PointerEvent) => {
        const state = dragState.current;
        if (!state || ev.pointerId !== state.pointerId) return;

        // Get the table surface element to compute position relative to it
        const table = document.querySelector('.table-surface');
        if (!table) return;

        const tableRect = table.getBoundingClientRect();
        const x = ev.clientX - tableRect.left - state.offsetX;
        const y = ev.clientY - tableRect.top - state.offsetY;

        state.currentPos = { x, y };

        // Throttle move emissions
        const now = Date.now();
        if (now - state.lastEmit >= THROTTLE_MS) {
          state.lastEmit = now;
          onMove(state.objectId, { x, y });
        }
      };

      const handlePointerUp = (ev: PointerEvent) => {
        const state = dragState.current;
        if (!state || ev.pointerId !== state.pointerId) return;

        onRelease(state.objectId, state.currentPos);
        dragState.current = null;

        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [onGrab, onMove, onRelease],
  );

  return { handlePointerDown };
}
