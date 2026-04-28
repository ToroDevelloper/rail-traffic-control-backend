const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Rail Traffic Control API",
    version: "1.0.0",
    description: "API REST para el backend de control ferroviario"
  },
  servers: [{
    url: "http://localhost:3000"
  }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    time: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/rooms": {
      get: {
        summary: "Lista de rooms",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    rooms: {
                      type: "array",
                      items: { "$ref": "#/components/schemas/RoomSummary" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: "Crear room",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/CreateRoomRequest" }
            }
          }
        },
        responses: {
          "201": {
            description: "Creado",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/CreateRoomResponse" }
              }
            }
          }
        }
      }
    },
    "/api/rooms/{roomId}": {
      get: {
        summary: "Detalle de room",
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/RoomDetail" }
              }
            }
          },
          "404": {
            description: "Room no existe"
          }
        }
      }
    },
    "/api/rooms/{roomId}/reset": {
      post: {
        summary: "Reset de room",
        parameters: [
          {
            name: "roomId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { "$ref": "#/components/schemas/CreateRoomResponse" }
              }
            }
          },
          "404": {
            description: "Room no existe"
          }
        }
      }
    }
  },
  components: {
    schemas: {
      RoomState: {
        type: "object",
        properties: {
          speed: { type: "number" },
          distance: { type: "number" },
          trackStatus: { type: "string" },
          temperature: { type: "number" },
          pressure: { type: "number" },
          crisis: { type: "number" },
          switches: { type: "object" },
          emergencyBrake: { type: "boolean" },
          comms: { type: "string" }
        }
      },
      RoomSummary: {
        type: "object",
        properties: {
          roomId: { type: "string" },
          users: {
            type: "object",
            properties: {
              monitor: { type: ["string", "null"] },
              technician: { type: ["string", "null"] }
            }
          },
          state: { "$ref": "#/components/schemas/RoomState" },
          updatedAt: { type: "string" }
        }
      },
      RoomDetail: {
        type: "object",
        properties: {
          roomId: { type: "string" },
          users: {
            type: "object",
            properties: {
              monitor: { type: ["string", "null"] },
              technician: { type: ["string", "null"] }
            }
          },
          state: { "$ref": "#/components/schemas/RoomState" },
          updatedAt: { type: "string" }
        }
      },
      CreateRoomRequest: {
        type: "object",
        properties: {
          roomId: { type: "string" }
        }
      },
      CreateRoomResponse: {
        type: "object",
        properties: {
          roomId: { type: "string" },
          state: { "$ref": "#/components/schemas/RoomState" },
          code: { type: "string" },
          createdAt: { type: "string" }
        }
      }
    }
  }
};

module.exports = swaggerDocument;
