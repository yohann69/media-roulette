const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");
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

// Upload endpoint with optional video trimming
app.post("/upload", upload.single("media"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    
    let finalFilename = req.file.filename;
    let finalPath = `/uploads/${req.file.filename}`;
    
    // If it's a video and trimming parameters are provided, trim it server-side
    const isVideo = req.file.mimetype.startsWith("video/");
    const maxDuration = req.body.maxDuration ? parseFloat(req.body.maxDuration) : null;
    
    if (isVideo && maxDuration) {
        try {
            // Server-side video trimming (fallback if client-side failed)
            const inputPath = req.file.path;
            const trimmedFilename = `trimmed_${req.file.filename}`;
            const outputPath = path.join(UPLOADS_DIR, trimmedFilename);
            
            console.log(`Trimming video server-side: ${req.file.filename} to ${maxDuration}s`);
            
            // Use fluent-ffmpeg to trim video
            await new Promise((resolve, reject) => {
                const ffmpegProcess = ffmpeg(inputPath)
                    .setDuration(maxDuration) // Trim to max duration
                    .output(outputPath)
                    .on("start", (commandLine) => {
                        console.log(`FFmpeg command: ${commandLine}`);
                    })
                    .on("end", () => {
                        // Check if trimmed file was created
                        if (fs.existsSync(outputPath)) {
                            const originalSize = fs.statSync(inputPath).size;
                            const trimmedSize = fs.statSync(outputPath).size;
                            // Delete original and use trimmed version
                            fs.unlinkSync(inputPath);
                            finalFilename = trimmedFilename;
                            finalPath = `/uploads/${trimmedFilename}`;
                            console.log(`Video trimmed server-side: ${req.file.filename} -> ${trimmedFilename} (${maxDuration}s, ${(originalSize/1024/1024).toFixed(2)}MB -> ${(trimmedSize/1024/1024).toFixed(2)}MB)`);
                        } else {
                            console.warn("Trimmed video file was not created");
                        }
                        resolve();
                    })
                    .on("error", (err) => {
                        // FFmpeg not available or failed - use original
                        console.warn("Server-side video trimming failed:", err.message);
                        console.warn("Using original video file");
                        resolve(); // Don't reject - continue with original file
                    })
                    .on("stderr", (stderrLine) => {
                        // Log ffmpeg stderr for debugging
                        if (stderrLine.includes("error") || stderrLine.includes("Error")) {
                            console.warn("FFmpeg stderr:", stderrLine);
                        }
                    });
                
                // Set timeout for video processing (30 seconds)
                setTimeout(() => {
                    ffmpegProcess.kill('SIGKILL');
                    console.warn("Video trimming timed out");
                    resolve();
                }, 30000);
                
                ffmpegProcess.run();
            });
        } catch (error) {
            console.warn("Error in server-side video trimming:", error);
            // Continue with original file
        }
    }
    
    // Return the filename so frontend can send it via socket
    res.json({ 
        filename: finalFilename,
        path: finalPath,
        mimetype: req.file.mimetype
    });
});

// Setup socket handlers
setupSocket(io, gameManager, roundStartTimes);

// Inactivity checker: Clean up abandoned games after 15 minutes of inactivity
const INACTIVITY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const INACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

setInterval(async () => {
    const inactiveRooms = gameManager.getInactiveRooms(INACTIVITY_THRESHOLD_MS);
    
    for (const { pin, room } of inactiveRooms) {
        console.log(`[Inactivity Checker] Game ${pin} has been inactive for more than 15 minutes. Cleaning up...`);
        
        // Disconnect all players in the room
        const socketsInRoom = await io.in(pin).fetchSockets();
        socketsInRoom.forEach(socket => {
            socket.emit("game-abandoned", { message: "Game was inactive for too long and has been closed" });
            socket.leave(pin);
        });
        
        // Clean up room files
        gameManager.cleanupRoomFiles(pin);
        
        // Remove from roundStartTimes
        roundStartTimes.delete(pin);
        
        // Delete the room
        gameManager.rooms.delete(pin);
        
        console.log(`[Inactivity Checker] Game ${pin} cleaned up and removed`);
    }
}, INACTIVITY_CHECK_INTERVAL_MS);

const PORT = process.env.PORT || 6969;

server.listen(PORT, () => {
    console.log(`🚀 PhotoRoulette Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for connections`);
    console.log(`⏰ Inactivity checker running (15 minute threshold)`);
});

// Cleanup function to remove old files (optional, but good for long running server)
// For now, we'll rely on game-end cleanup
