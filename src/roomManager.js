const { randomInt } = require("crypto");

const DEFAULT_STATE = {
  speed: 260,
  distance: 30,
  trackStatus: "ok",
  temperature: 25,
  pressure: 30,
  crisis: 10,
  switches: {},
  emergencyBrake: false,
  comms: "ok"
};

const MAX_SPEED = 350;
const MAX_VALUE = 100;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function generateRoomId() {
  return `room-${Math.random().toString(36).slice(2, 8)}`;
}

function generateCode() {
  return String(randomInt(1000, 10000));
}

function createState() {
  return {
    ...DEFAULT_STATE,
    switches: {}
  };
}

function syncTrackStatus(state) {
  if (state.crisis < 40) {
    state.trackStatus = "ok";
  } else if (state.crisis < 70) {
    state.trackStatus = "warning";
  } else {
    state.trackStatus = "critical";
  }
}

function applyDegradation(state) {
  state.temperature = clamp(state.temperature + 1, 0, MAX_VALUE);
  state.pressure = clamp(state.pressure + 1, 0, MAX_VALUE);
  state.crisis = clamp(state.crisis + 1, 0, MAX_VALUE);

  if (state.emergencyBrake) {
    state.speed = clamp(state.speed - 5, 0, MAX_SPEED);
  }

  syncTrackStatus(state);
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  ensureRoom(roomId) {
    const id = roomId || generateRoomId();
    if (!this.rooms.has(id)) {
      this.rooms.set(id, this._createRoom(id));
    }
    return this.rooms.get(id);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  listRooms() {
    return Array.from(this.rooms.values()).map((room) => ({
      roomId: room.id,
      users: this.getRoomUsers(room.id),
      state: room.state,
      updatedAt: room.updatedAt
    }));
  }

  getRoomUsers(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { monitor: null, technician: null };
    }
    return {
      monitor: room.users.monitor ? room.users.monitor.name : null,
      technician: room.users.technician ? room.users.technician.name : null
    };
  }

  getUserSocketId(roomId, role) {
    const room = this.getRoom(roomId);
    if (!room) {
      return null;
    }
    const user = room.users[role];
    return user ? user.socketId : null;
  }

  assignUser(roomId, role, socketId, name) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { ok: false, error: "Room no existe" };
    }
    const current = room.users[role];
    if (current && current.socketId !== socketId) {
      return { ok: false, error: `${role} ya esta ocupado` };
    }
    room.users[role] = {
      socketId,
      name: name || role
    };
    room.updatedAt = new Date().toISOString();
    return { ok: true, room };
  }

  removeUser(roomId, role, socketId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return;
    }
    const current = room.users[role];
    if (current && current.socketId === socketId) {
      room.users[role] = null;
      room.updatedAt = new Date().toISOString();
    }
  }

  isRoomEmpty(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return true;
    }
    return !room.users.monitor && !room.users.technician;
  }

  destroyRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return;
    }
    if (room.intervalId) {
      clearInterval(room.intervalId);
    }
    this.rooms.delete(roomId);
  }

  startDegradation(roomId, onTick) {
    const room = this.getRoom(roomId);
    if (!room || room.intervalId) {
      return;
    }
    room.intervalId = setInterval(() => {
      applyDegradation(room.state);
      room.updatedAt = new Date().toISOString();
      if (typeof onTick === "function") {
        onTick(room);
      }
    }, 1000);
  }

  stopDegradation(roomId) {
    const room = this.getRoom(roomId);
    if (!room || !room.intervalId) {
      return;
    }
    clearInterval(room.intervalId);
    room.intervalId = null;
  }

  updateState(roomId, partial) {
    const room = this.getRoom(roomId);
    if (!room) {
      return null;
    }
    const state = room.state;
    const next = partial || {};

    if (Number.isFinite(Number(next.speed))) {
      state.speed = clamp(Number(next.speed), 0, MAX_SPEED);
    }
    if (Number.isFinite(Number(next.distance))) {
      state.distance = clamp(Number(next.distance), 0, MAX_VALUE);
    }
    if (Number.isFinite(Number(next.temperature))) {
      state.temperature = clamp(Number(next.temperature), 0, MAX_VALUE);
    }
    if (Number.isFinite(Number(next.pressure))) {
      state.pressure = clamp(Number(next.pressure), 0, MAX_VALUE);
    }
    if (Number.isFinite(Number(next.crisis))) {
      state.crisis = clamp(Number(next.crisis), 0, MAX_VALUE);
    }

    if (typeof next.trackStatus === "string") {
      const status = next.trackStatus.toLowerCase();
      if (["ok", "warning", "critical"].includes(status)) {
        state.trackStatus = status;
      }
    } else if (Number.isFinite(Number(next.crisis))) {
      syncTrackStatus(state);
    }

    room.updatedAt = new Date().toISOString();
    return room;
  }

  applyAction(roomId, actionType, data) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { ok: false, error: "Room no existe" };
    }
    const state = room.state;
    const payload = data || {};

    switch (actionType) {
      case "switch": {
        const switchId = payload.switchId;
        if (!switchId) {
          return { ok: false, error: "switchId es obligatorio" };
        }
        const position = payload.position === "diverted" ? "diverted" : "straight";
        state.switches[switchId] = position;
        break;
      }
      case "emergency-brake": {
        state.emergencyBrake = Boolean(payload.active);
        if (state.emergencyBrake) {
          state.speed = clamp(state.speed - 30, 0, MAX_SPEED);
        }
        break;
      }
      case "comm": {
        const status = String(payload.status || "").toLowerCase();
        if (!["ok", "degraded", "down"].includes(status)) {
          return { ok: false, error: "status invalido" };
        }
        state.comms = status;
        break;
      }
      case "resolve": {
        const temperatureDelta = Number.isFinite(Number(payload.temperatureDelta))
          ? Number(payload.temperatureDelta)
          : 10;
        const pressureDelta = Number.isFinite(Number(payload.pressureDelta))
          ? Number(payload.pressureDelta)
          : 10;
        const crisisDelta = Number.isFinite(Number(payload.crisisDelta))
          ? Number(payload.crisisDelta)
          : 10;

        state.temperature = clamp(state.temperature - temperatureDelta, 0, MAX_VALUE);
        state.pressure = clamp(state.pressure - pressureDelta, 0, MAX_VALUE);
        state.crisis = clamp(state.crisis - crisisDelta, 0, MAX_VALUE);
        syncTrackStatus(state);
        break;
      }
      default:
        return { ok: false, error: "actionType invalido" };
    }

    room.updatedAt = new Date().toISOString();
    return { ok: true, room };
  }

  validateCode(roomId, code) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { ok: false, error: "Room no existe" };
    }
    if (String(code) !== room.code) {
      return { ok: false, error: "Codigo invalido" };
    }
    return { ok: true };
  }

  rotateCode(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return null;
    }
    room.code = generateCode();
    room.updatedAt = new Date().toISOString();
    return room.code;
  }

  resetRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return null;
    }
    room.state = createState();
    room.code = generateCode();
    room.updatedAt = new Date().toISOString();
    return room;
  }

  _createRoom(id) {
    const now = new Date().toISOString();
    return {
      id,
      state: createState(),
      code: generateCode(),
      users: {
        monitor: null,
        technician: null
      },
      intervalId: null,
      createdAt: now,
      updatedAt: now
    };
  }
}

module.exports = { RoomManager };
