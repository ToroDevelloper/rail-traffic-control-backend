const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const swaggerUi = require("swagger-ui-express");

const swaggerDocument = require("./swagger");
const createRoutes = require("./routes");
const { RoomManager } = require("./roomManager");

const PORT = process.env.PORT || 3000;

const app = express();
const roomManager = new RoomManager();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api", createRoutes(roomManager));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/docs-json", (req, res) => {
  res.json(swaggerDocument);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

function normalizeRole(role) {
  const text = String(role || "").toLowerCase();
  if (text === "tecnico") {
    return "technician";
  }
  return text;
}

function respondAck(ack, payload) {
  if (typeof ack === "function") {
    ack(payload);
  }
}

io.on("connection", (socket) => {
  socket.on("join-room", (payload, ack) => {
    const data = payload || {};
    const roomId = data.roomId;
    const role = normalizeRole(data.role);
    const name = data.name;

    if (!roomId || !role) {
      const error = "roomId y role son obligatorios";
      respondAck(ack, { ok: false, error });
      socket.emit("room-error", { error });
      return;
    }

    if (!["monitor", "technician"].includes(role)) {
      const error = "role invalido (usa monitor o technician)";
      respondAck(ack, { ok: false, error });
      socket.emit("room-error", { error });
      return;
    }

    const room = roomManager.ensureRoom(roomId);
    const result = roomManager.assignUser(roomId, role, socket.id, name);
    if (!result.ok) {
      respondAck(ack, result);
      socket.emit("room-error", { error: result.error });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = role;

    roomManager.startDegradation(roomId, (updatedRoom) => {
      io.to(roomId).emit("state-updated", {
        roomId,
        state: updatedRoom.state,
        updatedAt: updatedRoom.updatedAt
      });
    });

    const users = roomManager.getRoomUsers(roomId);
    io.to(roomId).emit("room-users", users);

    const response = {
      ok: true,
      roomId,
      role,
      state: room.state,
      users
    };

    if (role === "monitor") {
      response.code = room.code;
      socket.emit("code-challenge", { roomId, code: room.code });
    } else {
      const monitorSocketId = roomManager.getUserSocketId(roomId, "monitor");
      if (monitorSocketId) {
        io.to(monitorSocketId).emit("code-challenge", { roomId, code: room.code });
      }
    }

    socket.emit("room-joined", response);
    respondAck(ack, response);
  });

  socket.on("update-state", (payload, ack) => {
    const data = payload || {};
    const roomId = data.roomId || socket.data.roomId;

    if (!roomId) {
      const error = "No hay room activa";
      respondAck(ack, { ok: false, error });
      return;
    }

    if (socket.data.role && socket.data.role !== "monitor") {
      const error = "Solo el monitor puede actualizar el estado";
      respondAck(ack, { ok: false, error });
      return;
    }

    const room = roomManager.updateState(roomId, data.state || data.data || {});
    if (!room) {
      const error = "Room no existe";
      respondAck(ack, { ok: false, error });
      return;
    }

    io.to(roomId).emit("state-updated", {
      roomId,
      state: room.state,
      updatedAt: room.updatedAt
    });

    respondAck(ack, { ok: true, state: room.state });
  });

  socket.on("action", (payload, ack) => {
    const data = payload || {};
    const roomId = data.roomId || socket.data.roomId;

    if (!roomId) {
      const error = "No hay room activa";
      respondAck(ack, { ok: false, error });
      return;
    }

    if (socket.data.role && socket.data.role !== "technician") {
      const error = "Solo el tecnico puede ejecutar acciones";
      respondAck(ack, { ok: false, error });
      return;
    }

    const validation = roomManager.validateCode(roomId, data.code);
    if (!validation.ok) {
      respondAck(ack, validation);
      socket.emit("action-result", validation);
      return;
    }

    const actionResult = roomManager.applyAction(roomId, data.actionType, data.data);
    if (!actionResult.ok) {
      respondAck(ack, actionResult);
      socket.emit("action-result", actionResult);
      return;
    }

    const newCode = roomManager.rotateCode(roomId);
    const room = actionResult.room;

    io.to(roomId).emit("state-updated", {
      roomId,
      state: room.state,
      updatedAt: room.updatedAt
    });

    io.to(roomId).emit("action-result", {
      ok: true,
      actionType: data.actionType,
      state: room.state
    });

    const monitorSocketId = roomManager.getUserSocketId(roomId, "monitor");
    if (monitorSocketId && newCode) {
      io.to(monitorSocketId).emit("code-challenge", { roomId, code: newCode });
    }

    respondAck(ack, { ok: true });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const role = socket.data.role;

    if (!roomId || !role) {
      return;
    }

    roomManager.removeUser(roomId, role, socket.id);

    if (roomManager.isRoomEmpty(roomId)) {
      roomManager.destroyRoom(roomId);
      return;
    }

    io.to(roomId).emit("room-users", roomManager.getRoomUsers(roomId));
  });
});

server.listen(PORT, () => {
  console.log(`[server] escuchando en http://localhost:${PORT}`);
});
