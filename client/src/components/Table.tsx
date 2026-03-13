import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ClientGameState,
  CardObject,
  DeckObject,
  DieObject,
  Position,
  DiceSides,
  Player,
} from '@tabletop-arena/shared';
import type { SocketActions } from '../hooks/useSocket';
import { useDrag } from '../hooks/useDrag';
import { Card } from './Card';
import { Deck } from './Deck';
import { Die } from './Die';
import { Hand } from './Hand';
import { PlayerList } from './PlayerList';

interface TableProps {
  gameState: ClientGameState;
  playerId: string;
  roomCode: string;
  actions: SocketActions;
  error: string | null;
  liveDragPositions: Record<string, Position>;
}

interface ContextMenuState {
  x: number;
  y: number;
  objectId: string;
  objectType: 'card' | 'deck' | 'die';
}

const DICE_OPTIONS: DiceSides[] = [4, 6, 8, 10, 12, 20];

export function Table({
  gameState,
  playerId,
  roomCode,
  actions,
  error,
  liveDragPositions,
}: TableProps) {
  const [showDiceMenu, setShowDiceMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copied, setCopied] = useState(false);
  const diceMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside (use mousedown to avoid race with contextmenu event)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Don't close if clicking inside the context menu itself
      const target = e.target as HTMLElement;
      if (target.closest('.context-menu')) return;
      setContextMenu(null);
      if (!target.closest('.dice-dropdown')) {
        setShowDiceMenu(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  // Drag handler
  const { handlePointerDown } = useDrag({
    onGrab: actions.grabObject,
    onMove: actions.moveObject,
    onRelease: actions.releaseObject,
  });

  // Determine effective position (use live drag position if available)
  const getPosition = useCallback(
    (obj: { id: string; position: Position }): Position => {
      return liveDragPositions[obj.id] ?? obj.position;
    },
    [liveDragPositions],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, objectId: string, objectType: 'card' | 'deck' | 'die') => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, objectId, objectType });
    },
    [],
  );

  const handleAddDeck = useCallback(() => {
    // Place near center with random offset to avoid stacking
    const x = 450 + Math.floor(Math.random() * 100);
    const y = 250 + Math.floor(Math.random() * 100);
    actions.addDeck({ x, y });
  }, [actions]);

  const handleAddDie = useCallback(
    (sides: DiceSides) => {
      const x = 450 + Math.floor(Math.random() * 100);
      const y = 250 + Math.floor(Math.random() * 100);
      actions.addDie(sides, { x, y });
      setShowDiceMenu(false);
    },
    [actions],
  );

  const handleCopyCode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(roomCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [roomCode],
  );

  // Find all decks for "return to deck" context menu
  const decks = Object.values(gameState.objects).filter(
    (o): o is DeckObject => o.type === 'deck',
  );

  // Get player color from their ID for lock indicators
  const getPlayerColor = (lockPlayerId: string | null): Player['color'] | null => {
    if (!lockPlayerId) return null;
    return gameState.players[lockPlayerId]?.color ?? null;
  };

  // Filter out cards that are inside a deck (they shouldn't be rendered on the table)
  // and sort by zIndex for proper layering
  const sortedObjects = Object.values(gameState.objects)
    .filter(obj => {
      if (obj.type === 'card') {
        const card = obj as CardObject;
        // Don't render cards that belong to a deck
        if (card.deckId !== null) return false;
        // Don't render cards that are in any hand
        if (gameState.myHand.some(c => c.id === card.id)) return false;
      }
      return true;
    })
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="table-container">
      {/* Top Bar */}
      <div className="table-topbar">
        <div className="table-topbar-left">
          <div className="table-topbar-title">Tabletop Arena</div>
          <div
            className="room-code-badge"
            onClick={handleCopyCode}
            style={{ position: 'relative' }}
          >
            Room: <span>{roomCode}</span>
            {copied && <div className="copied-tooltip">Copied!</div>}
          </div>
        </div>

        <PlayerList
          players={gameState.players}
          myPlayerId={playerId}
          otherHands={gameState.otherHands}
        />

        <div className="table-topbar-right">
          <button className="toolbar-btn" onClick={handleAddDeck}>
            + Deck
          </button>
          <div style={{ position: 'relative' }} ref={diceMenuRef}>
            <button
              className={`toolbar-btn ${showDiceMenu ? 'active' : ''}`}
              onClick={e => {
                e.stopPropagation();
                setShowDiceMenu(!showDiceMenu);
              }}
            >
              + Die
            </button>
            {showDiceMenu && (
              <div className="dice-dropdown" onClick={e => e.stopPropagation()}>
                {DICE_OPTIONS.map(sides => (
                  <button key={sides} onClick={() => handleAddDie(sides)}>
                    d{sides}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Surface */}
      <div
        className="table-surface"
        onContextMenu={e => e.preventDefault()}
      >
        {sortedObjects.map(obj => {
          const pos = getPosition(obj);
          const isLocked = obj.lockedBy !== null && obj.lockedBy !== playerId;
          const isDragging = obj.lockedBy === playerId;

          const baseStyle: React.CSSProperties = {
            left: pos.x,
            top: pos.y,
            ['--z-index' as string]: obj.zIndex,
            transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
          };

          if (obj.type === 'card') {
            const card = obj as CardObject;
            return (
              <div
                key={obj.id}
                className={`game-object ${isDragging ? 'dragging' : ''} ${isLocked ? 'locked' : ''}`}
                style={baseStyle}
              >
                <Card
                  card={card}
                  lockedByColor={getPlayerColor(obj.lockedBy)}
                  onPointerDown={
                    isLocked ? undefined : e => handlePointerDown(e, obj.id, pos)
                  }
                  onDoubleClick={() => !isLocked && actions.flipCard(card.id)}
                  onContextMenu={e => handleContextMenu(e, obj.id, 'card')}
                />
              </div>
            );
          }

          if (obj.type === 'deck') {
            const deck = obj as DeckObject;
            return (
              <div
                key={obj.id}
                className={`game-object ${isDragging ? 'dragging' : ''}`}
                style={baseStyle}
              >
                <Deck
                  deck={deck}
                  onDrawToHand={() => actions.drawCard(deck.id, true)}
                  onDrawToTable={() => actions.drawCard(deck.id, false)}
                  onShuffle={() => actions.shuffleDeck(deck.id)}
                  onPointerDown={e => {
                    // Only allow drag if pointer target is the stack, not a button
                    const target = e.target as HTMLElement;
                    if (target.closest('.deck-action-btn') || target.closest('.deck-actions')) return;
                    handlePointerDown(e, obj.id, pos);
                  }}
                  onContextMenu={e => handleContextMenu(e, obj.id, 'deck')}
                />
              </div>
            );
          }

          if (obj.type === 'die') {
            const die = obj as DieObject;
            return (
              <div
                key={obj.id}
                className={`game-object ${isDragging ? 'dragging' : ''}`}
                style={baseStyle}
              >
                <Die
                  die={die}
                  onRoll={() => actions.rollDie(die.id)}
                  onPointerDown={e => handlePointerDown(e, obj.id, pos)}
                  onContextMenu={e => handleContextMenu(e, obj.id, 'die')}
                />
              </div>
            );
          }

          return null;
        })}

        {/* Hand Area */}
        <Hand
          cards={gameState.myHand}
          onPlayCard={actions.playCardFromHand}
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.objectType === 'card' && (
            <>
              <button
                onClick={() => {
                  actions.flipCard(contextMenu.objectId);
                  setContextMenu(null);
                }}
              >
                Flip Card
              </button>
              {decks.length > 0 &&
                decks.map(deck => (
                  <button
                    key={deck.id}
                    onClick={() => {
                      actions.returnCardToDeck(contextMenu.objectId, deck.id);
                      setContextMenu(null);
                    }}
                  >
                    Return to {deck.name || 'Deck'}
                  </button>
                ))}
              <button
                className="danger"
                onClick={() => {
                  actions.removeObject(contextMenu.objectId);
                  setContextMenu(null);
                }}
              >
                Remove
              </button>
            </>
          )}
          {contextMenu.objectType === 'deck' && (
            <>
              <button
                onClick={() => {
                  actions.drawCard(contextMenu.objectId, true);
                  setContextMenu(null);
                }}
              >
                Draw to Hand
              </button>
              <button
                onClick={() => {
                  actions.drawCard(contextMenu.objectId, false);
                  setContextMenu(null);
                }}
              >
                Draw to Table
              </button>
              <button
                onClick={() => {
                  actions.shuffleDeck(contextMenu.objectId);
                  setContextMenu(null);
                }}
              >
                Shuffle
              </button>
              <button
                className="danger"
                onClick={() => {
                  actions.removeObject(contextMenu.objectId);
                  setContextMenu(null);
                }}
              >
                Remove
              </button>
            </>
          )}
          {contextMenu.objectType === 'die' && (
            <>
              <button
                onClick={() => {
                  actions.rollDie(contextMenu.objectId);
                  setContextMenu(null);
                }}
              >
                Roll
              </button>
              <button
                className="danger"
                onClick={() => {
                  actions.removeObject(contextMenu.objectId);
                  setContextMenu(null);
                }}
              >
                Remove
              </button>
            </>
          )}
        </div>
      )}

      {/* Error Toast */}
      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
