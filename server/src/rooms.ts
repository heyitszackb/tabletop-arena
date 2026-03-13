import { customAlphabet } from 'nanoid';
import {
  type Room,
  type Player,
  type GameState,
  PLAYER_COLORS,
  MAX_PLAYERS_PER_ROOM,
  MAX_ROOMS,
  ROOM_CODE_LENGTH,
} from '@tabletop-arena/shared';

// Exclude ambiguous characters: I/1, O/0, L to avoid confusion when sharing codes verbally
const nanoid = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', ROOM_CODE_LENGTH);
const playerIdGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

/** Timeout handles for empty-room cleanup (60s after last player leaves) */
const roomDestroyTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export class RoomManager {
  private rooms = new Map<string, Room>();

  /** Map from socketId → { roomCode, playerId } for disconnect handling */
  private socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

  /** Map from playerId → disconnect timeout handle */
  private disconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  // ─── Public API ──────────────────────────────────────────

  createRoom(hostName: string): { room: Room; player: Player } | { error: string } {
    if (this.rooms.size >= MAX_ROOMS) {
      return { error: 'Maximum number of rooms reached' };
    }

    // Generate unique room code with collision retry (up to 3 attempts)
    let code: string | null = null;
    for (let i = 0; i < 3; i++) {
      const candidate = nanoid();
      if (!this.rooms.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      return { error: 'Failed to generate unique room code' };
    }

    const playerId = playerIdGen();
    const color = PLAYER_COLORS[0]!;

    const player: Player = {
      id: playerId,
      name: hostName,
      color,
      connected: true,
      isHost: true,
    };

    const state: GameState = {
      objects: {},
      players: { [playerId]: player },
      hands: { [playerId]: [] },
      nextZIndex: 1,
    };

    const room: Room = {
      code,
      state,
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    console.log(`[room:created] code=${code} host="${hostName}"`);

    return { room, player };
  }

  joinRoom(code: string, playerName: string): { room: Room; player: Player } | { error: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      return { error: 'Room not found' };
    }

    const players = Object.values(room.state.players);

    // Check if reconnecting (same name, currently disconnected)
    const existing = players.find(p => p.name === playerName && !p.connected);
    if (existing) {
      existing.connected = true;
      // Cancel disconnect timeout if one is pending
      const timeout = this.disconnectTimeouts.get(existing.id);
      if (timeout) {
        clearTimeout(timeout);
        this.disconnectTimeouts.delete(existing.id);
        console.log(`[player:reconnected] room=${code} name="${playerName}" id=${existing.id}`);
      }
      return { room, player: existing };
    }

    // Check for duplicate name among connected players
    if (players.some(p => p.name === playerName && p.connected)) {
      return { error: 'Name already taken in this room' };
    }

    if (players.length >= MAX_PLAYERS_PER_ROOM) {
      return { error: 'Room is full' };
    }

    // Assign color: pick first unused color
    const usedColors = new Set(players.map(p => p.color));
    const color = PLAYER_COLORS.find(c => !usedColors.has(c)) ?? PLAYER_COLORS[0]!;

    const playerId = playerIdGen();
    const player: Player = {
      id: playerId,
      name: playerName,
      color,
      connected: true,
      isHost: false,
    };

    room.state.players[playerId] = player;
    room.state.hands[playerId] = [];

    // Cancel room destroy timeout if one is pending
    const destroyTimeout = roomDestroyTimeouts.get(code);
    if (destroyTimeout) {
      clearTimeout(destroyTimeout);
      roomDestroyTimeouts.delete(code);
    }

    console.log(`[player:joined] room=${code} name="${playerName}" id=${playerId}`);
    return { room, player };
  }

  /**
   * Handle player leaving (either explicit or disconnect timeout).
   * Returns info about host transfer if applicable, or null if room was destroyed.
   */
  leaveRoom(roomCode: string, playerId: string): { newHostId?: string } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.state.players[playerId];
    if (!player) return null;

    // Return player's hand cards to the table
    const handCardIds = room.state.hands[playerId] ?? [];
    for (const cardId of handCardIds) {
      const card = room.state.objects[cardId];
      if (card && card.type === 'card') {
        card.faceUp = false; // Face-down when returned
        card.position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
        card.lockedBy = null;
      }
    }

    // Free any locked objects
    for (const obj of Object.values(room.state.objects)) {
      if (obj.lockedBy === playerId) {
        obj.lockedBy = null;
      }
    }

    // Remove player
    delete room.state.players[playerId];
    delete room.state.hands[playerId];

    // Clear socket mapping for this player
    for (const [socketId, mapping] of this.socketToPlayer) {
      if (mapping.playerId === playerId) {
        this.socketToPlayer.delete(socketId);
        break;
      }
    }

    // Clear disconnect timeout
    const timeout = this.disconnectTimeouts.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeouts.delete(playerId);
    }

    const wasHost = player.isHost;
    const remainingPlayers = Object.values(room.state.players);

    console.log(`[player:left] room=${roomCode} name="${player.name}" id=${playerId}`);

    if (remainingPlayers.length === 0) {
      // Schedule room destruction after 60 seconds
      const destroyTimeout = setTimeout(() => {
        const currentRoom = this.rooms.get(roomCode);
        if (currentRoom && Object.keys(currentRoom.state.players).length === 0) {
          this.rooms.delete(roomCode);
          roomDestroyTimeouts.delete(roomCode);
          console.log(`[room:destroyed] code=${roomCode}`);
        }
      }, 60_000);
      roomDestroyTimeouts.set(roomCode, destroyTimeout);
      return null;
    }

    // Transfer host if needed
    let newHostId: string | undefined;
    if (wasHost) {
      const newHost = remainingPlayers.find(p => p.connected) ?? remainingPlayers[0]!;
      newHost.isHost = true;
      newHostId = newHost.id;
      console.log(`[host:transferred] room=${roomCode} newHost="${newHost.name}" id=${newHost.id}`);
    }

    return { newHostId };
  }

  getRoom(code: string): Room | null {
    return this.rooms.get(code.toUpperCase()) ?? null;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getPlayerCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += Object.keys(room.state.players).length;
    }
    return count;
  }

  // ─── Socket ↔ Player Mapping ────────────────────────────

  registerSocket(socketId: string, roomCode: string, playerId: string): void {
    this.socketToPlayer.set(socketId, { roomCode, playerId });
  }

  unregisterSocket(socketId: string): void {
    this.socketToPlayer.delete(socketId);
  }

  getPlayerBySocket(socketId: string): { roomCode: string; playerId: string } | null {
    return this.socketToPlayer.get(socketId) ?? null;
  }

  // ─── Disconnect Handling ────────────────────────────────

  setDisconnectTimeout(playerId: string, timeout: ReturnType<typeof setTimeout>): void {
    this.disconnectTimeouts.set(playerId, timeout);
  }

  cancelDisconnectTimeout(playerId: string): void {
    const timeout = this.disconnectTimeouts.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeouts.delete(playerId);
    }
  }

  markDisconnected(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.state.players[playerId];
    if (player) {
      player.connected = false;
    }
  }
}
