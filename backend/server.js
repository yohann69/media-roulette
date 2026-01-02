const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
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

// Setup uploads directory
const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.ensureDirSync(UPLOADS_DIR);

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create a sub-directory for the game pin if provided in headers/body
        // But for simplicity, we'll store all in uploads and manage paths in GameManager
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Serve uploaded files statically
app.use("/uploads", express.static(UPLOADS_DIR));

const gameManager = new GameManager();
const roundStartTimes = new Map();

app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "PhotoRoulette Backend Server" });
});

// Upload endpoint
app.post("/upload", upload.single("media"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    
    // Return the filename so frontend can send it via socket
    res.json({ 
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype
    });
});

// Setup socket handlers
setupSocket(io, gameManager, roundStartTimes);

const PORT = process.env.PORT || 6969;

server.listen(PORT, () => {
    console.log(`🚀 PhotoRoulette Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for connections`);
});

// Cleanup function to remove old files (optional, but good for long running server)
// For now, we'll rely on game-end cleanup
