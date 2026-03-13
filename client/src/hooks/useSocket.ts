import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientGameState,
  Position,
  DiceSides,
  Player,
} from '@tabletop-arena/shared';

export interface SocketActions {
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  grabObject: (id: string) => void;
  moveObject: (id: string, pos: Position) => void;
  releaseObject: (id: string, pos: Position) => void;
  flipCard: (id: string) => void;
  drawCard: (deckId: string, toHand: boolean) => void;
  playCardFromHand: (cardId: string, pos: Position, faceUp: boolean) => void;
  shuffleDeck: (id: string) => void;
  rollDie: (id: string) => void;
  addDeck: (pos: Position) => void;
  addDie: (sides: DiceSides, pos: Position) => void;
  removeObject: (id: string) => void;
  returnCardToDeck: (cardId: string, deckId: string) => void;
}

export interface UseSocketReturn {
  connected: boolean;
  roomCode: string | null;
  playerId: string | null;
  gameState: ClientGameState | null;
  error: string | null;
  actions: SocketActions;
  /** Locally-tracked drag positions from other players (objectId -> position) */
  liveDragPositions: Record<string, Position>;
  /** Players that joined/left notifications */
  players: Record<string, Player>;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveDragPositions, setLiveDragPositions] = useState<Record<string, Position>>({});
  const [players, setPlayers] = useState<Record<string, Player>>({});

  useEffect(() => {
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('roomCreated', (data: { roomCode: string; playerId: string }) => {
      setRoomCode(data.roomCode);
      setPlayerId(data.playerId);
      setError(null);
    });

    socket.on('roomJoined', (data: { roomCode: string; playerId: string }) => {
      setRoomCode(data.roomCode);
      setPlayerId(data.playerId);
      setError(null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('stateUpdate', (raw: any) => {
      // Handle both { state: ... } wrapper and direct ClientGameState
      const state: ClientGameState = raw && raw.state && typeof raw.state === 'object' && 'objects' in raw.state
        ? raw.state
        : raw;
      setGameState(state);
      setPlayers(state.players);
      // Clear live drag positions for objects no longer locked
      setLiveDragPositions(prev => {
        const next: Record<string, Position> = {};
        for (const [id, pos] of Object.entries(prev)) {
          const obj = state.objects[id];
          if (obj && obj.lockedBy) {
            next[id] = pos;
          }
        }
        return next;
      });
    });

    socket.on('objectMoved', (data: { objectId: string; position: Position; playerId: string }) => {
      setLiveDragPositions(prev => ({
        ...prev,
        [data.objectId]: data.position,
      }));
    });

    socket.on('diceRolling', (data: { dieId: string }) => {
      // Mark die as rolling in local state for animation
      setGameState(prev => {
        if (!prev) return prev;
        const die = prev.objects[data.dieId];
        if (!die || die.type !== 'die') return prev;
        return {
          ...prev,
          objects: {
            ...prev.objects,
            [data.dieId]: { ...die, rolling: true },
          },
        };
      });
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      // Auto-clear error after 5s
      setTimeout(() => setError(null), 5000);
    });

    socket.on('playerJoined', (data: { player: Player }) => {
      setPlayers(prev => ({ ...prev, [data.player.id]: data.player }));
    });

    socket.on('playerLeft', (data: { playerId: string; newHostId?: string }) => {
      setPlayers(prev => {
        const next = { ...prev };
        delete next[data.playerId];
        if (data.newHostId && next[data.newHostId]) {
          next[data.newHostId] = { ...next[data.newHostId], isHost: true };
        }
        return next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const actions: SocketActions = {
    createRoom: useCallback((name: string) => {
      setError(null);
      emit('createRoom', { type: 'createRoom', playerName: name });
    }, [emit]),

    joinRoom: useCallback((code: string, name: string) => {
      setError(null);
      emit('joinRoom', { type: 'joinRoom', roomCode: code.toUpperCase(), playerName: name });
    }, [emit]),

    grabObject: useCallback((id: string) => {
      emit('gameAction', { type: 'grabObject', objectId: id });
    }, [emit]),

    moveObject: useCallback((id: string, pos: Position) => {
      emit('gameAction', { type: 'moveObject', objectId: id, position: pos });
    }, [emit]),

    releaseObject: useCallback((id: string, pos: Position) => {
      emit('gameAction', { type: 'releaseObject', objectId: id, position: pos });
      // Clear local drag position
      setLiveDragPositions(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, [emit]),

    flipCard: useCallback((id: string) => {
      emit('gameAction', { type: 'flipCard', cardId: id });
    }, [emit]),

    drawCard: useCallback((deckId: string, toHand: boolean) => {
      emit('gameAction', { type: 'drawCard', deckId, toHand });
    }, [emit]),

    playCardFromHand: useCallback((cardId: string, pos: Position, faceUp: boolean) => {
      emit('gameAction', { type: 'playCardFromHand', cardId, position: pos, faceUp });
    }, [emit]),

    shuffleDeck: useCallback((id: string) => {
      emit('gameAction', { type: 'shuffleDeck', deckId: id });
    }, [emit]),

    rollDie: useCallback((id: string) => {
      emit('gameAction', { type: 'rollDie', dieId: id });
    }, [emit]),

    addDeck: useCallback((pos: Position) => {
      emit('gameAction', { type: 'addDeck', deckType: 'standard52', position: pos });
    }, [emit]),

    addDie: useCallback((sides: DiceSides, pos: Position) => {
      emit('gameAction', { type: 'addDie', sides, position: pos });
    }, [emit]),

    removeObject: useCallback((id: string) => {
      emit('gameAction', { type: 'removeObject', objectId: id });
    }, [emit]),

    returnCardToDeck: useCallback((cardId: string, deckId: string) => {
      emit('gameAction', { type: 'returnCardToDeck', cardId, deckId });
    }, [emit]),
  };

  return {
    connected,
    roomCode,
    playerId,
    gameState,
    error,
    actions,
    liveDragPositions,
    players,
  };
}
