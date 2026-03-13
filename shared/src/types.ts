// ─── Player ───────────────────────────────────────────────
export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  connected: boolean;
  isHost: boolean;
}

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

// ─── Game Objects ─────────────────────────────────────────
export type GameObjectType = 'card' | 'deck' | 'die';

export interface Position {
  x: number;
  y: number;
}

export interface BaseGameObject {
  id: string;
  type: GameObjectType;
  position: Position;
  zIndex: number;
  rotation: number;
  lockedBy: string | null; // playerId or null
}

export interface CardObject extends BaseGameObject {
  type: 'card';
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  deckId: string | null; // null if on table or in hand
}

export interface DeckObject extends BaseGameObject {
  type: 'deck';
  cardIds: string[]; // ordered, top card is last
  name: string;
}

export interface DieObject extends BaseGameObject {
  type: 'die';
  sides: DiceSides;
  value: number; // current face value (1-based)
  rolling: boolean;
}

export type GameObject = CardObject | DeckObject | DieObject;

// ─── Card Properties ──────────────────────────────────────
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type DiceSides = 4 | 6 | 8 | 10 | 12 | 20;

export const ALL_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const ALL_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const ALL_DICE_SIDES: DiceSides[] = [4, 6, 8, 10, 12, 20];

// ─── Game State ───────────────────────────────────────────
//
// State flow:
//   Client Action ──▶ Server Validate ──▶ Update State ──▶ Per-Player Broadcast
//
// Hand privacy:
//   Server sends each player a filtered view:
//   - Your hand: full card data (suit, rank visible)
//   - Others' hands: card count only (no suit/rank)
//
export interface GameState {
  objects: Record<string, GameObject>;  // all objects on the table
  players: Record<string, Player>;
  hands: Record<string, string[]>;     // playerId → cardId[]
  nextZIndex: number;
}

// What clients receive (filtered per-player)
export interface ClientGameState {
  objects: Record<string, GameObject>;
  players: Record<string, Player>;
  myHand: CardObject[];                // full card data for your hand
  otherHands: Record<string, number>;  // playerId → card count
  nextZIndex: number;
}

// ─── Room ─────────────────────────────────────────────────
export interface Room {
  code: string;
  state: GameState;
  createdAt: number;
}

export const MAX_PLAYERS_PER_ROOM = 8;
export const MAX_ROOMS = 100;
export const ROOM_CODE_LENGTH = 6;
export const DISCONNECT_TIMEOUT_MS = 30_000;
export const RATE_LIMIT_ACTIONS_PER_SEC = 30;
export const RATE_LIMIT_JOIN_PER_MIN = 5;
