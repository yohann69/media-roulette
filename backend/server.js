const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const GameManager = require("./GameManager");
const setupSocket = require("./socketHandlers");
const mediaStore = require("./mediaStore");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

app.disable("x-powered-by");

const gameManager = new GameManager();
const roundStartTimes = new Map();

// Rooms only live in memory, so files from a previous run can never be played again.
mediaStore.clearAll();

const upload = multer({
    dest: mediaStore.TMP_DIR,
    limits: {
        fileSize: mediaStore.LIMITS.maxVideoBytes,
        files: 1,
        fields: 5,
    },
});

/** Resolves the upload token sent by the app, or answers 401. */
function requireUploadToken(req, res, next) {
    const auth = gameManager.resolveUploadToken(req.get("x-upload-token"));
    if (!auth) {
        return res.status(401).json({ error: "Invalid or expired upload token" });
    }
    req.auth = auth;
    next();
}

app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Media Roulette Backend Server" });
});

// Media upload: one prepared (already compressed) photo or video clip per request.
app.post("/upload", requireUploadToken, (req, res) => {
    const { pin, socketId } = req.auth;
    if (gameManager.uploadCount(pin, socketId) >= mediaStore.LIMITS.maxFilesPerPlayer) {
        return res.status(429).json({ error: "Too many files" });
    }

    upload.single("media")(req, res, (err) => {
        if (err) {
            const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            return res.status(status).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        try {
            const { filename, kind } = mediaStore.acceptUpload(req.file.path, pin);
            if (!gameManager.recordUpload(pin, socketId, filename)) {
                mediaStore.deleteFile(pin, filename);
                return res.status(429).json({ error: "Too many files" });
            }
            gameManager.updateActivity(pin);
            res.json({ filename, mediaType: kind });
        } catch (error) {
            res.status(error.status || 500).json({ error: error.message });
        }
    });
});

// Media download, only for players of the same room.
app.get("/media/:pin/:filename", requireUploadToken, (req, res) => {
    const { pin, filename } = req.params;
    if (req.auth.pin !== pin) {
        return res.status(403).json({ error: "Not a member of this game" });
    }
    const filePath = mediaStore.resolveFile(pin, filename);
    if (!filePath) {
        return res.status(404).json({ error: "Not found" });
    }
    res.set({
        "Content-Type": mediaStore.contentTypeFor(filename),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "attachment",
    });
    res.sendFile(filePath);
});

// Setup socket handlers
setupSocket(io, gameManager, roundStartTimes);

// Inactivity checker: Clean up abandoned games after 15 minutes of inactivity
const INACTIVITY_THRESHOLD_MS = 15 * 60 * 1000;
const INACTIVITY_CHECK_INTERVAL_MS = 60 * 1000;

setInterval(async () => {
    const inactiveRooms = gameManager.getInactiveRooms(INACTIVITY_THRESHOLD_MS);

    for (const { pin } of inactiveRooms) {
        console.log(`[Inactivity Checker] Game ${pin} has been inactive for more than 15 minutes. Cleaning up...`);

        const socketsInRoom = await io.in(pin).fetchSockets();
        socketsInRoom.forEach((socket) => {
            socket.emit("game-abandoned", { message: "Game was inactive for too long and has been closed" });
            socket.leave(pin);
        });

        roundStartTimes.delete(pin);
        gameManager.deleteRoom(pin);
    }
}, INACTIVITY_CHECK_INTERVAL_MS);

const PORT = process.env.PORT || 6969;

server.listen(PORT, () => {
    console.log(`🚀 Media Roulette Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for connections`);
    console.log(`⏰ Inactivity checker running (15 minute threshold)`);
});
