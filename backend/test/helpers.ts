import type { AddressInfo } from "node:net";
import { io as ioClient, type Socket } from "socket.io-client";
import { createAppServer, type AppServer } from "../src/server.js";
import type { GameServerOptions } from "../src/gameServer.js";

/** An "end-to-end encrypted" media file as phones produce it: "MRE1" header + opaque bytes. */
export const FAKE_ENCRYPTED = Buffer.concat([Buffer.from("MRE1", "ascii"), Buffer.alloc(256, 7)]);

export interface Session {
  socket: Socket;
  pin: string;
  playerId: string;
  resumeToken: string;
  uploadToken: string;
}

export class TestEnv {
  app!: AppServer;
  url!: string;
  private sockets: Socket[] = [];

  async start(options: GameServerOptions = {}) {
    this.app = createAppServer({ latencyIntervalMs: 60_000, firstRoundDelayMs: 50, ...options });
    await new Promise<void>((resolve) => this.app.httpServer.listen(0, resolve));
    this.url = `http://localhost:${(this.app.httpServer.address() as AddressInfo).port}`;
  }

  async stop() {
    this.sockets.forEach((s) => s.close());
    await this.app.close();
  }

  async connect(): Promise<Socket> {
    const socket = ioClient(this.url, { transports: ["websocket"], forceNew: true, reconnection: false });
    this.sockets.push(socket);
    await waitFor(socket, "connect");
    return socket;
  }

  async create(name = "Host", settings: Record<string, unknown> = { rounds: 10, timer: 3 }): Promise<Session> {
    const socket = await this.connect();
    socket.emit("create-game", { hostName: name, settings });
    const data = await waitFor<any>(socket, "game-created");
    return { socket, ...pick(data) };
  }

  async join(pin: string, name: string): Promise<Session> {
    const socket = await this.connect();
    socket.emit("join-game", { pin, playerName: name });
    const data = await waitFor<any>(socket, "joined-game");
    return { socket, ...pick(data) };
  }

  async upload(token: string | null, body: Buffer = FAKE_ENCRYPTED, type = "application/octet-stream") {
    const form = new FormData();
    form.append("media", new Blob([body], { type }), "file");
    const res = await fetch(`${this.url}/upload`, {
      method: "POST",
      body: form,
      headers: token ? { "x-upload-token": token } : {},
    });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  }

  /**
   * Confirms `count` prepared media for a player (ids only), and answers the
   * server's upload requests the way a phone does: upload, then "uploads-complete".
   * Returns the filenames uploaded so far (filled in as requests arrive).
   */
  async setPool(session: Session, count: number, { respondToUploads = true } = {}): Promise<string[]> {
    const uploaded: string[] = [];
    if (respondToUploads) {
      session.socket.on("upload-request", async ({ items }: { items: string[] }) => {
        const done = [];
        for (const id of items) {
          const { body } = await this.upload(session.uploadToken);
          uploaded.push(body.filename);
          done.push({ id, filename: body.filename });
        }
        session.socket.emit("uploads-complete", { pin: session.pin, items: done });
      });
    }
    session.socket.emit("set-media-pool", {
      pin: session.pin,
      mediaPool: Array.from({ length: count }, (_, i) => ({ id: `m${i}`, mediaType: "photo" })),
    });
    await waitFor(session.socket, "media-pool-set");
    return uploaded;
  }

  /** Host prepares, every player confirms the download, and the first round starts. */
  async startGame(host: Session, players: Session[]) {
    const rounds = players.map((p) => waitFor<any>(p.socket, "new-round"));
    for (const p of players) p.socket.once("sync-media", () => p.socket.emit("sync-complete", { pin: p.pin }));
    host.socket.emit("prepare-game", { pin: host.pin });
    const [first] = await Promise.all(rounds);
    return first;
  }
}

function pick(data: any) {
  return { pin: data.pin, playerId: data.playerId, resumeToken: data.resumeToken, uploadToken: data.uploadToken };
}

export function waitFor<T = unknown>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/** Waits for an occurrence of `event` whose payload satisfies `predicate`. */
export function waitForMatch<T = any>(socket: Socket, event: string, predicate: (data: T) => boolean, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (data: T) => {
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for matching "${event}"`));
    }, timeoutMs);
    socket.on(event, handler);
  });
}

/** Resolves true if the event arrives within `ms`, false otherwise. */
export function arrives(socket: Socket, event: string, ms = 800): Promise<boolean> {
  return waitFor(socket, event, ms).then(
    () => true,
    () => false
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
