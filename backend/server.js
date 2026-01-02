const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const GameManager = require("./GameManager");
const setupSocket = require("./socketHandlers");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

app.use(cors());
app.use(express.json());

const gameManager = new GameManager();

// Store round start times per room
const roundStartTimes = new Map();

app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "PhotoRoulette Backend Server" });
});

// Setup socket handlers
setupSocket(io, gameManager, roundStartTimes);

const PORT = process.env.PORT || 6969;

server.listen(PORT, () => {
    console.log(`🚀 PhotoRoulette Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for connections`);
});
