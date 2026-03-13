import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { DISCONNECT_TIMEOUT_MS } from '@tabletop-arena/shared';

import { RoomManager } from './rooms.js';
import { GameStateManager } from './gameState.js';
import {
  validateAction,
  validateCreateRoom,
  validateJoinRoom,
  checkActionRateLimit,
  checkJoinRateLimit,
  clearActionRateLimit,
} from './validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();
const gameStateManager = new GameStateManager();

// ─── Health Endpoint ──────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    rooms: roomManager.getRoomCount(),
    players: roomManager.getPlayerCount(),
  });
});

// ─── Serve Client in Production ───────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Helpers ──────────────────────────────────────────────

function broadcastStateToRoom(roomCode: string): void {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  for (const playerId of Object.keys(room.state.players)) {
    const clientState = gameStateManager.getStateForPlayer(room.state, playerId);
    // Find the socket for this player
    const sockets = io.sockets.adapter.rooms.get(roomCode);
    if (!sockets) continue;

    for (const socketId of sockets) {
      const mapping = roomManager.getPlayerBySocket(socketId);
      if (mapping && mapping.playerId === playerId) {
        try {
          io.to(socketId).emit('stateUpdate', { state: clientState });
        } catch (err) {
          console.error(`[broadcast:error] Failed to send stateUpdate to socket=${socketId}`, err);
        }
      }
    }
  }
}

function getClientIp(socket: { handshake: { headers: Record<string, string | string[] | undefined>; address: string } }): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]!.trim();
  }
  return socket.handshake.address;
}

// ─── Socket.io Connection Handler ─────────────────────────

io.on('connection', (socket) => {
  const clientIp = getClientIp(socket);

  // ── createRoom ────────────────────────────────────────
  socket.on('createRoom', (data: unknown) => {
    if (!checkJoinRateLimit(clientIp)) {
      socket.emit('error', { message: 'Rate limit exceeded. Try again later.' });
      return;
    }

    const validation = validateCreateRoom(data);
    if (!validation.ok) {
      socket.emit('error', { message: validation.error });
      return;
    }

    const result = roomManager.createRoom(validation.data.playerName);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }

    const { room, player } = result;
    socket.join(room.code);
    roomManager.registerSocket(socket.id, room.code, player.id);

    socket.emit('roomCreated', { roomCode: room.code, playerId: player.id });
    broadcastStateToRoom(room.code);
  });

  // ── joinRoom ──────────────────────────────────────────
  socket.on('joinRoom', (data: unknown) => {
    if (!checkJoinRateLimit(clientIp)) {
      socket.emit('error', { message: 'Rate limit exceeded. Try again later.' });
      return;
    }

    const validation = validateJoinRoom(data);
    if (!validation.ok) {
      socket.emit('error', { message: validation.error });
      return;
    }

    const result = roomManager.joinRoom(validation.data.roomCode, validation.data.playerName);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      return;
    }

    const { room, player } = result;
    socket.join(room.code);
    roomManager.registerSocket(socket.id, room.code, player.id);

    socket.emit('roomJoined', { roomCode: room.code, playerId: player.id });

    // Notify other players
    socket.to(room.code).emit('playerJoined', { player });

    broadcastStateToRoom(room.code);
  });

  // ── gameAction ────────────────────────────────────────
  socket.on('gameAction', (data: unknown) => {
    const mapping = roomManager.getPlayerBySocket(socket.id);
    if (!mapping) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }

    if (!checkActionRateLimit(socket.id)) {
      socket.emit('error', { message: 'Action rate limit exceeded' });
      return;
    }

    const validation = validateAction(data);
    if (!validation.ok) {
      socket.emit('error', { message: validation.error });
      return;
    }

    const room = roomManager.getRoom(mapping.roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const result = gameStateManager.processAction(room.state, validation.action, mapping.playerId);
    if ('error' in result) {
      socket.emit('error', { message: result.error });
      console.log(`[action:rejected] room=${mapping.roomCode} player=${mapping.playerId} action=${validation.action.type} reason="${result.error}"`);
      return;
    }

    // Handle dice rolling with delay
    if ('diceRoll' in result && result.diceRoll) {
      const { dieId } = result.diceRoll;

      // Broadcast rolling state immediately
      io.to(mapping.roomCode).emit('diceRolling', { dieId });

      // After 500ms, finalize the roll and broadcast full state
      setTimeout(() => {
        const currentRoom = roomManager.getRoom(mapping.roomCode);
        if (currentRoom) {
          gameStateManager.finalizeDiceRoll(currentRoom.state, dieId);
          broadcastStateToRoom(mapping.roomCode);
        }
      }, 500);

      // Broadcast intermediate rolling state
      broadcastStateToRoom(mapping.roomCode);
      return;
    }

    // Normal action: broadcast full state
    broadcastStateToRoom(mapping.roomCode);
  });

  // ── moveObject (lightweight drag) ─────────────────────
  socket.on('moveObject', (data: unknown) => {
    const mapping = roomManager.getPlayerBySocket(socket.id);
    if (!mapping) return;

    if (!checkActionRateLimit(socket.id)) return;

    // Quick validation — we just need objectId and position
    if (
      typeof data !== 'object' || data === null ||
      !('objectId' in data) || !('position' in data) ||
      typeof (data as Record<string, unknown>).objectId !== 'string' ||
      typeof (data as Record<string, unknown>).position !== 'object'
    ) {
      return;
    }

    const { objectId, position } = data as { objectId: string; position: { x: number; y: number } };

    if (typeof position?.x !== 'number' || typeof position?.y !== 'number') {
      return;
    }

    // Update position in state (server-side tracking)
    const room = roomManager.getRoom(mapping.roomCode);
    if (room) {
      const obj = room.state.objects[objectId];
      if (obj && obj.lockedBy === mapping.playerId) {
        obj.position = position;
      }
    }

    // Broadcast lightweight move to other players in the room (not full state)
    socket.to(mapping.roomCode).emit('objectMoved', {
      objectId,
      position,
      playerId: mapping.playerId,
    });
  });

  // ── disconnect ────────────────────────────────────────
  socket.on('disconnect', () => {
    const mapping = roomManager.getPlayerBySocket(socket.id);
    if (!mapping) return;

    const { roomCode, playerId } = mapping;

    // Mark player as disconnected
    roomManager.markDisconnected(roomCode, playerId);

    console.log(`[player:disconnected] room=${roomCode} player=${playerId} (30s grace period)`);

    // Set up disconnect timeout
    const timeout = setTimeout(() => {
      const result = roomManager.leaveRoom(roomCode, playerId);
      if (result) {
        // Notify remaining players
        io.to(roomCode).emit('playerLeft', {
          playerId,
          newHostId: result.newHostId,
        });
        broadcastStateToRoom(roomCode);
      }
    }, DISCONNECT_TIMEOUT_MS);

    roomManager.setDisconnectTimeout(playerId, timeout);

    // Broadcast disconnected state immediately so other players see it
    broadcastStateToRoom(roomCode);

    // Clean up socket mapping
    clearActionRateLimit(socket.id);
    roomManager.unregisterSocket(socket.id);
  });
});

// ─── Start Server ─────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);

httpServer.listen(PORT, () => {
  console.log(`[server:started] Tabletop Arena server listening on port ${PORT}`);
});

export { app, httpServer, io };
