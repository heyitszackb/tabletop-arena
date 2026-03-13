import { z } from 'zod';

// ─── Client → Server Actions ─────────────────────────────
// These are the actions clients send to the server via Socket.io.

export const CreateRoomSchema = z.object({
  type: z.literal('createRoom'),
  playerName: z.string().min(1).max(20).trim(),
});

export const JoinRoomSchema = z.object({
  type: z.literal('joinRoom'),
  roomCode: z.string().length(6),
  playerName: z.string().min(1).max(20).trim(),
});

export const GrabObjectSchema = z.object({
  type: z.literal('grabObject'),
  objectId: z.string(),
});

export const MoveObjectSchema = z.object({
  type: z.literal('moveObject'),
  objectId: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const ReleaseObjectSchema = z.object({
  type: z.literal('releaseObject'),
  objectId: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const FlipCardSchema = z.object({
  type: z.literal('flipCard'),
  cardId: z.string(),
});

export const DrawCardSchema = z.object({
  type: z.literal('drawCard'),
  deckId: z.string(),
  toHand: z.boolean(), // true = draw to hand, false = draw to table
});

export const PlayCardFromHandSchema = z.object({
  type: z.literal('playCardFromHand'),
  cardId: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  faceUp: z.boolean(),
});

export const ShuffleDeckSchema = z.object({
  type: z.literal('shuffleDeck'),
  deckId: z.string(),
});

export const ReturnCardToDeckSchema = z.object({
  type: z.literal('returnCardToDeck'),
  cardId: z.string(),
  deckId: z.string(),
});

export const RollDieSchema = z.object({
  type: z.literal('rollDie'),
  dieId: z.string(),
});

export const AddDeckSchema = z.object({
  type: z.literal('addDeck'),
  deckType: z.enum(['standard52']),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const AddDieSchema = z.object({
  type: z.literal('addDie'),
  sides: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20)]),
  position: z.object({ x: z.number(), y: z.number() }),
});

export const RemoveObjectSchema = z.object({
  type: z.literal('removeObject'),
  objectId: z.string(),
});

// Union of all game actions (used after joining a room)
export const GameActionSchema = z.discriminatedUnion('type', [
  GrabObjectSchema,
  MoveObjectSchema,
  ReleaseObjectSchema,
  FlipCardSchema,
  DrawCardSchema,
  PlayCardFromHandSchema,
  ShuffleDeckSchema,
  ReturnCardToDeckSchema,
  RollDieSchema,
  AddDeckSchema,
  AddDieSchema,
  RemoveObjectSchema,
]);

export type CreateRoom = z.infer<typeof CreateRoomSchema>;
export type JoinRoom = z.infer<typeof JoinRoomSchema>;
export type GameAction = z.infer<typeof GameActionSchema>;

// ─── Server → Client Events ──────────────────────────────
// These are the events the server sends to clients.

export type ServerEvent =
  | { type: 'roomCreated'; roomCode: string; playerId: string }
  | { type: 'roomJoined'; roomCode: string; playerId: string }
  | { type: 'stateUpdate'; state: import('./types.js').ClientGameState }
  | { type: 'objectMoved'; objectId: string; position: import('./types.js').Position; playerId: string }
  | { type: 'diceRolling'; dieId: string }
  | { type: 'error'; message: string }
  | { type: 'playerJoined'; player: import('./types.js').Player }
  | { type: 'playerLeft'; playerId: string; newHostId?: string };
