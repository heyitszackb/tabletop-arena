import {
  GameActionSchema,
  CreateRoomSchema,
  JoinRoomSchema,
  type GameAction,
  type CreateRoom,
  type JoinRoom,
} from '@tabletop-arena/shared';
import {
  RATE_LIMIT_ACTIONS_PER_SEC,
  RATE_LIMIT_JOIN_PER_MIN,
} from '@tabletop-arena/shared';

// ─── Zod Validation ──────────────────────────────────────

export function validateAction(data: unknown): { ok: true; action: GameAction } | { ok: false; error: string } {
  const result = GameActionSchema.safeParse(data);
  if (result.success) {
    return { ok: true, action: result.data };
  }
  return { ok: false, error: result.error.issues.map(i => i.message).join(', ') };
}

export function validateCreateRoom(data: unknown): { ok: true; data: CreateRoom } | { ok: false; error: string } {
  const result = CreateRoomSchema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, error: result.error.issues.map(i => i.message).join(', ') };
}

export function validateJoinRoom(data: unknown): { ok: true; data: JoinRoom } | { ok: false; error: string } {
  const result = JoinRoomSchema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, error: result.error.issues.map(i => i.message).join(', ') };
}

// ─── Rate Limiting ───────────────────────────────────────

/** Per-socket action rate limiter: max RATE_LIMIT_ACTIONS_PER_SEC actions per second */
const actionTimestamps = new Map<string, number[]>();

export function checkActionRateLimit(socketId: string): boolean {
  const now = Date.now();
  const windowMs = 1000;
  let timestamps = actionTimestamps.get(socketId);

  if (!timestamps) {
    timestamps = [];
    actionTimestamps.set(socketId, timestamps);
  }

  // Prune old entries
  while (timestamps.length > 0 && timestamps[0]! < now - windowMs) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_ACTIONS_PER_SEC) {
    return false; // rate limited
  }

  timestamps.push(now);
  return true;
}

export function clearActionRateLimit(socketId: string): void {
  actionTimestamps.delete(socketId);
}

/** Per-IP join rate limiter: max RATE_LIMIT_JOIN_PER_MIN join attempts per minute */
const joinTimestamps = new Map<string, number[]>();

export function checkJoinRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  let timestamps = joinTimestamps.get(ip);

  if (!timestamps) {
    timestamps = [];
    joinTimestamps.set(ip, timestamps);
  }

  // Prune old entries
  while (timestamps.length > 0 && timestamps[0]! < now - windowMs) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_JOIN_PER_MIN) {
    return false; // rate limited
  }

  timestamps.push(now);
  return true;
}
