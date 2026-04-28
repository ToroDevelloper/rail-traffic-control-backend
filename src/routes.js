const express = require("express");

function createRoutes(roomManager) {
  const router = express.Router();

  router.get("/rooms", (req, res) => {
    res.json({ rooms: roomManager.listRooms() });
  });

  router.post("/rooms", (req, res) => {
    const body = req.body || {};
    const room = roomManager.ensureRoom(body.roomId);
    res.status(201).json({
      roomId: room.id,
      state: room.state,
      code: room.code,
      createdAt: room.createdAt
    });
  });

  router.get("/rooms/:roomId", (req, res) => {
    const room = roomManager.getRoom(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: "Room no existe" });
    }
    return res.json({
      roomId: room.id,
      state: room.state,
      users: roomManager.getRoomUsers(room.id),
      updatedAt: room.updatedAt
    });
  });

  router.post("/rooms/:roomId/reset", (req, res) => {
    const room = roomManager.resetRoom(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: "Room no existe" });
    }
    return res.json({
      roomId: room.id,
      state: room.state,
      code: room.code
    });
  });

  return router;
}

module.exports = createRoutes;
