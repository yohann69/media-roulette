import express from "express";
import http from "node:http";
import { pathToFileURL } from "node:url";
import multer from "multer";
import { Server } from "socket.io";
import { GameServer, type GameServerOptions } from "./gameServer.js";
import * as mediaStore from "./mediaStore.js";
import { KeyedRateLimiter } from "./rateLimit.js";

export interface AppServer {
  httpServer: http.Server;
  io: Server;
  game: GameServer;
  close: () => Promise<void>;
}

export function createAppServer(options: GameServerOptions = {}): AppServer {
  const app = express();
  app.disable("x-powered-by");
  // Behind Railway's proxy: use the client's address for rate limiting.
  app.set("trust proxy", 1);

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    // Detect dead connections (phone locked, network lost) within ~15 s instead of ~45 s.
    pingInterval: 10_000,
    pingTimeout: 5_000,
  });
  const game = new GameServer(io, options);
  const { registry } = game;
  const httpLimiter = new KeyedRateLimiter(120, 4); // per IP

  // Rooms only live in memory, so files from a previous run can never be played again.
  mediaStore.clearAll();

  const upload = multer({
    dest: mediaStore.TMP_DIR,
    limits: { fileSize: mediaStore.LIMITS.maxFileBytes, files: 1, fields: 5 },
  });

  const requireToken: express.RequestHandler = (req, res, next) => {
    if (!httpLimiter.take(req.ip ?? "unknown")) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    const ctx = registry.resolveUploadToken(req.get("x-upload-token"));
    if (!ctx) {
      res.status(401).json({ error: "Invalid or expired upload token" });
      return;
    }
    res.locals.ctx = ctx;
    next();
  };

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", message: "Media Roulette Backend Server" });
  });

  // Media upload: one prepared (compressed, then end-to-end encrypted) photo or video clip per request.
  app.post("/upload", requireToken, (req, res) => {
    const { room, player } = res.locals.ctx as ReturnType<typeof registry.resolveUploadToken> & object;
    if (player.uploadedFiles.size >= mediaStore.LIMITS.maxFilesPerPlayer) {
      res.status(429).json({ error: "Too many files" });
      return;
    }

    upload.single("media")(req, res, (err: unknown) => {
      if (err) {
        const status = (err as { code?: string }).code === "LIMIT_FILE_SIZE" ? 413 : 400;
        res.status(status).json({ error: (err as Error).message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      try {
        const { filename } = mediaStore.acceptUpload(req.file.path, room.pin);
        player.uploadedFiles.add(filename);
        room.lastActivityTime = Date.now();
        res.json({ filename });
      } catch (error) {
        const status = error instanceof mediaStore.HttpError ? error.status : 500;
        res.status(status).json({ error: (error as Error).message });
      }
    });
  });

  // Media download, only for players of the same room.
  app.get("/media/:pin/:filename", requireToken, (req, res) => {
    const { room } = res.locals.ctx as ReturnType<typeof registry.resolveUploadToken> & object;
    const pin = String(req.params.pin);
    const filename = String(req.params.filename);
    if (room.pin !== pin) {
      res.status(403).json({ error: "Not a member of this game" });
      return;
    }
    const filePath = mediaStore.resolveFile(pin, filename);
    if (!filePath) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.set({
      "Content-Type": mediaStore.contentTypeFor(filename),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment",
    });
    res.sendFile(filePath);
  });

  return {
    httpServer,
    io,
    game,
    close: async () => {
      game.close();
      await io.close();
    },
  };
}

// Started directly (npm start / npm run dev): listen on PORT.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 6969;
  createAppServer().httpServer.listen(port, () => {
    console.log(`🚀 Media Roulette Backend Server running on port ${port}`);
  });
}
