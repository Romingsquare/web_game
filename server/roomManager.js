import { Room } from './room.js';

// ── Singleton room registry ───────────────────────────────────────────────────
export const rooms = new Map(); // roomId → Room

export function getOrCreateRoom() {
  for (const room of rooms.values()) {
    if (!room.isFull()) return room;
  }
  const room = new Room();
  rooms.set(room.id, room);
  return room;
}

export function getRoomById(id) {
  return rooms.get(id);
}

export function removeRoom(id) {
  rooms.delete(id);
  console.log(`[roomManager] room ${id} removed (${rooms.size} rooms active)`);
}

export function getStats() {
  let totalPlayers = 0;
  for (const room of rooms.values()) totalPlayers += room.players.size;
  return { roomCount: rooms.size, totalPlayers };
}

/** Broadcast a message string to every socket across all rooms */
export function broadcastAll(msgString) {
  for (const room of rooms.values()) room.broadcast(msgString);
}
