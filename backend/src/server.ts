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

  // Invite link (shared from the lobby): opens the app on the join screen with the PIN filled in.
  app.get("/j/:pin", (req, res) => {
    const pin = String(req.params.pin);
    if (!/^\d{6}$/.test(pin)) {
      res.status(404).send("Not found");
      return;
    }
    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.send(invitePage(pin));
  });

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

/** A tiny page that hands the PIN to the app. `pin` is always 6 digits. */
function invitePage(pin: string): string {
  const deepLink = `mediaroulette://join?pin=${pin}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Join Media Roulette game ${pin}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
  main{max-width:360px}
  h1{font-size:22px;margin:0 0 8px}
  .pin{font-size:56px;font-weight:800;letter-spacing:4px;color:#f97316;margin:16px 0}
  a.button{display:block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;font-size:18px;padding:16px;border-radius:16px;margin:24px 0 16px}
  p{color:#9ca3af;font-size:15px;line-height:1.5}
</style>
</head>
<body>
<main>
  <h1>You're invited to a Media Roulette game</h1>
  <div class="pin">${pin}</div>
  <a class="button" href="${deepLink}">Open Media Roulette</a>
  <p>Don't have the app yet? Install Media Roulette, then tap <b>Join Game</b> and enter this PIN.</p>
</main>
<script>setTimeout(function(){location.href=${JSON.stringify(deepLink)}},300)</script>
</body>
</html>`;
}

// Started directly (npm start / npm run dev): listen on PORT.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 6969;
  createAppServer().httpServer.listen(port, () => {
    console.log(`🚀 Media Roulette Backend Server running on port ${port}`);
  });
}
