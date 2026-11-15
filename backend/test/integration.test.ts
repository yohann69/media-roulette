import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "node:crypto";
import { arrives, FAKE_ENCRYPTED, sleep, TestEnv, waitFor, waitForMatch } from "./helpers.js";

const PUBLIC_ROOM_KEYS = ["gameState", "pin", "players", "settings"];

let env: TestEnv;

beforeEach(async () => {
  env = new TestEnv();
  await env.start({ reconnectGraceMs: 500 });
});

afterEach(async () => {
  await env.stop();
});

describe("no answer leaks", () => {
  it("never sends media owners before the round result", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const roomUpdate = waitFor<any>(host.socket, "room-update");
    await env.setPool(host, 2);
    expect(Object.keys(await roomUpdate).sort()).toEqual(PUBLIC_ROOM_KEYS);
    await env.setPool(p2, 2);

    const sync = waitFor<any>(p2.socket, "sync-media");
    const round = await env.startGame(host, [host, p2]);
    const syncData = await sync;

    expect(syncData.media.every((m: object) => Object.keys(m).sort().join() === "filename,index,mediaType")).toBe(true);
    expect(round).not.toHaveProperty("actualOwnerId");
    expect(round.mediaData.id).toMatch(/^media-\d+$/);

    const result = waitFor<any>(host.socket, "round-result");
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
    p2.socket.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId });
    expect(typeof (await result).actualOwnerId).toBe("string");
  });
});

describe("uploads", () => {
  it("only accepts end-to-end encrypted media, within size limits", async () => {
    const host = await env.create();
    expect((await env.upload(null)).status).toBe(401);
    expect((await env.upload(host.uploadToken, Buffer.from("<html><script>alert(1)</script></html>"))).status).toBe(415);
    const plainJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(256)]);
    expect((await env.upload(host.uploadToken, plainJpeg)).status).toBe(415);
    expect((await env.upload(host.uploadToken, Buffer.concat([FAKE_ENCRYPTED, Buffer.alloc(21 * 1024 * 1024)]))).status).toBe(413);
    expect((await env.upload(host.uploadToken)).status).toBe(200);
  });

  it("only serves media to players of the same room", async () => {
    const host = await env.create();
    const other = await env.create("Other");
    const file = (await env.upload(host.uploadToken)).body.filename;

    expect((await fetch(`${env.url}/uploads/${file}`)).status).toBe(404);
    expect((await fetch(`${env.url}/media/${host.pin}/${file}`)).status).toBe(401);
    const cross = await fetch(`${env.url}/media/${host.pin}/${file}`, { headers: { "x-upload-token": other.uploadToken } });
    expect(cross.status).toBe(403);
    const ok = await fetch(`${env.url}/media/${host.pin}/${file}`, { headers: { "x-upload-token": host.uploadToken } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("content-type")).toContain("application/octet-stream");
  });

  it("ignores files a player didn't upload themselves", async () => {
    const host = await env.create("Host", { rounds: 10, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    const hostFiles = await env.setPool(host, 1);
    await env.setPool(p2, 1, { respondToUploads: false });
    // P2 answers its upload request by claiming the host's file.
    p2.socket.on("upload-request", async ({ items }: { items: string[] }) => {
      await sleep(100);
      p2.socket.emit("uploads-complete", { pin: p2.pin, items: [{ id: items[0], filename: hostFiles[0] }] });
    });
    const sync = waitFor<any>(host.socket, "sync-media");
    host.socket.emit("prepare-game", { pin: host.pin });
    expect((await sync).count).toBe(1);
  });

  it("deletes a player's media when they leave", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const file = (await env.upload(p2.uploadToken)).body.filename;
    p2.socket.emit("leave-game", { pin: p2.pin });
    await sleep(200);
    const res = await fetch(`${env.url}/media/${host.pin}/${file}`, { headers: { "x-upload-token": host.uploadToken } });
    expect(res.status).toBe(404);
  });
});

describe("media stays on the phone until it's chosen", () => {
  it("asks owners to upload only the media picked for the game", async () => {
    const host = await env.create("Host", { rounds: 3, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    const requested: string[][] = [];
    for (const s of [host, p2]) s.socket.on("upload-request", ({ items }: { items: string[] }) => requested.push(items));
    await env.setPool(host, 5);
    await env.setPool(p2, 5);
    const first = await env.startGame(host, [host, p2]);
    expect(requested.flat()).toHaveLength(3);
    expect(first.totalRounds).toBe(3);
  });

  it("starts without the media of a player who doesn't upload in time", async () => {
    await env.stop();
    env = new TestEnv();
    await env.start({ reconnectGraceMs: 500, collectTimeoutMs: 500 });
    const host = await env.create("Host", { rounds: 10, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2, { respondToUploads: false });
    const sync = waitFor<any>(p2.socket, "sync-media", 3000);
    host.socket.emit("prepare-game", { pin: host.pin });
    expect((await sync).count).toBe(2);
  });
});

describe("end-to-end encrypted room key", () => {
  const info = new TextEncoder().encode("media-roulette:room-key:v1");
  const sharedKey = (secret: Uint8Array, pub: Uint8Array) => hkdf(sha256, x25519.getSharedSecret(secret, pub), undefined, info, 32);
  const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

  it("relays the sealed room key from the host to a new player, without being able to read it", async () => {
    const hostSecret = new Uint8Array(randomBytes(32));
    const guestSecret = new Uint8Array(randomBytes(32));
    const hostPublic = b64(x25519.getPublicKey(hostSecret));
    const guestPublic = b64(x25519.getPublicKey(guestSecret));
    const roomKey = new Uint8Array(randomBytes(32));

    const hostSocket = await env.connect();
    hostSocket.emit("create-game", { hostName: "Host", publicKey: hostPublic });
    const created = await waitFor<any>(hostSocket, "game-created");
    expect(created.room.players[0]).toMatchObject({ hasRoomKey: true, publicKey: hostPublic });

    // The host's phone answers key requests by sealing the room key for the requester.
    hostSocket.on("key-request", ({ playerId, publicKey }: { playerId: string; publicKey: string }) => {
      const nonce = new Uint8Array(randomBytes(24));
      const sealed = xchacha20poly1305(sharedKey(hostSecret, new Uint8Array(Buffer.from(publicKey, "base64"))), nonce).encrypt(roomKey);
      hostSocket.emit("share-room-key", { pin: created.pin, to: playerId, sealed: b64(Buffer.concat([nonce, sealed])) });
    });

    const guestSocket = await env.connect();
    const roomKeyMessage = waitFor<any>(guestSocket, "room-key");
    guestSocket.emit("join-game", { pin: created.pin, playerName: "Guest", publicKey: guestPublic });
    const { from, sealed } = await roomKeyMessage;
    expect(from).toBe(created.playerId);

    const data = new Uint8Array(Buffer.from(sealed, "base64"));
    const opened = xchacha20poly1305(sharedKey(guestSecret, new Uint8Array(Buffer.from(hostPublic, "base64"))), data.subarray(0, 24)).decrypt(data.subarray(24));
    expect(Buffer.from(opened).equals(Buffer.from(roomKey))).toBe(true);

    const update = await waitForMatch<any>(hostSocket, "room-update", (r) => r.players.every((p: any) => p.hasRoomKey));
    expect(update.players).toHaveLength(2);
  });

  it("only lets players who hold the key share it", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const p3 = await env.join(host.pin, "P3");
    p2.socket.emit("share-room-key", { pin: p2.pin, to: p3.playerId, sealed: "A".repeat(96) });
    expect(await arrives(p3.socket, "room-key", 500)).toBe(false);
  });
});

describe("authorization and abuse", () => {
  it("ignores events from sockets that aren't in the room", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    await env.startGame(host, [host, p2]);

    const outsider = await env.connect();
    outsider.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
    outsider.emit("continue-game", { pin: host.pin });
    expect(await arrives(host.socket, "round-result", 600)).toBe(false);
  });

  it("rate-limits join attempts per address", async () => {
    const socket = await env.connect();
    const messages: string[] = [];
    const allAnswered = new Promise<void>((resolve) => {
      socket.on("join-error", (e: { message: string }) => {
        messages.push(e.message);
        if (messages.length === 15) resolve();
      });
    });
    for (let i = 0; i < 15; i++) socket.emit("join-game", { pin: String(100000 + i), playerName: "x" });
    await allAnswered;
    expect(messages.filter((m) => m.includes("Too many")).length).toBeGreaterThanOrEqual(5);
  });

  it("makes duplicate names unique and trims long ones", async () => {
    const host = await env.create("Alexandra-the-Great-Of-Names");
    const p2 = await env.join(host.pin, "Alex");
    const p3 = env.join(host.pin, "alex");
    const update = await waitFor<any>(p2.socket, "room-update");
    await p3;
    const names = (await waitFor<any>(host.socket, "room-update").catch(() => update)).players.map((p: any) => p.name);
    expect(names[0].length).toBeLessThanOrEqual(16);
    expect(names).toContain("alex 2");
  });
});

describe("fair timing", () => {
  it("measures answer time on the server and ignores client timestamps", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    await env.startGame(host, [host, p2]);

    await sleep(400);
    const result = waitFor<any>(host.socket, "round-result");
    // A forged timestamp claiming an instant answer must have no effect.
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId, timestamp: 0 });
    p2.socket.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId, timestamp: Date.now() - 60_000 });
    const { results } = await result;
    for (const r of results) {
      expect(r.timeTaken).toBeGreaterThanOrEqual(0);
      expect(r.timeTaken).toBeLessThan(1000);
    }
  });

  it("rejects guesses sent after the round's time is up", async () => {
    const host = await env.create("Host", { rounds: 5, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 1);
    await env.setPool(p2, 1);
    await env.startGame(host, [host, p2]);
    await sleep(3500); // past 3 s + tolerance, before the server's grace timer closes the round
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
    const ack = await waitFor<any>(host.socket, "guess-received");
    expect(ack).toMatchObject({ success: false, message: "Too late" });
  });

  it("ends the round on the server's timer, without any client help", async () => {
    const host = await env.create("Host", { rounds: 5, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 1);
    await env.setPool(p2, 1);
    await env.startGame(host, [host, p2]);
    const result = await waitFor<any>(host.socket, "round-result", 6000);
    expect(result.results.every((r: any) => r.tooSlow)).toBe(true);
  });
});

describe("game start", () => {
  it("leaves a short get-ready pause before the first round", async () => {
    await env.stop();
    env = new TestEnv();
    await env.start({ reconnectGraceMs: 500, firstRoundDelayMs: 1000 });
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 1);
    await env.setPool(p2, 1);
    const started = waitFor(host.socket, "game-started").then(() => Date.now());
    const round = waitFor(host.socket, "new-round").then(() => Date.now());
    await env.startGame(host, [host, p2]);
    expect((await round) - (await started)).toBeGreaterThanOrEqual(900);
  });
});

describe("owner can hide their own media", () => {
  it("drops the round without scoring or revealing the owner", async () => {
    const host = await env.create("Host", { rounds: 4, timer: 5 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    const first = await env.startGame(host, [host, p2]);

    // Only the owner can skip: try both, one of them is the owner.
    const skipped = waitFor<any>(host.socket, "round-skipped");
    const next = waitForMatch<any>(host.socket, "new-round", (r) => r.mediaData.index !== first.mediaData.index);
    for (const s of [host, p2]) s.socket.emit("skip-media", { pin: s.pin });
    expect(await skipped).toEqual({});
    const round = await next;
    expect(round.round).toBe(1);
    expect(round.totalRounds).toBe(3);
  });
});

describe("games never get stuck", () => {
  it("starts on its own once everyone has the media", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 1);
    await env.setPool(p2, 1);
    const round = await env.startGame(host, [host, p2]);
    expect(round.round).toBe(1);
  });

  it("starts when a player who was still downloading leaves", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const p3 = await env.join(host.pin, "P3");
    for (const s of [host, p2, p3]) await env.setPool(s, 1);

    const round = waitFor<any>(host.socket, "new-round");
    host.socket.once("sync-media", () => host.socket.emit("sync-complete", { pin: host.pin }));
    p2.socket.once("sync-media", () => p2.socket.emit("sync-complete", { pin: p2.pin }));
    host.socket.emit("prepare-game", { pin: host.pin });
    await sleep(200);
    p3.socket.emit("leave-game", { pin: p3.pin });
    expect((await round).round).toBe(1);
  });

  it("lets others continue when the media owner left on the results screen", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const p3 = await env.join(host.pin, "P3");
    for (const s of [host, p2, p3]) await env.setPool(s, 2);
    await env.startGame(host, [host, p2, p3]);

    const result = waitFor<any>(host.socket, "round-result");
    for (const s of [host, p2, p3]) s.socket.emit("submit-guess", { pin: s.pin, targetUser: s.playerId });
    const { actualOwnerId } = await result;

    const sessions = [host, p2, p3];
    const owner = sessions.find((s) => s.playerId === actualOwnerId)!;
    const others = sessions.filter((s) => s !== owner);
    owner.socket.emit("leave-game", { pin: owner.pin });
    await sleep(200);

    const next = waitFor<any>(others[0].socket, "new-round");
    others[0].socket.emit("continue-game", { pin: others[0].pin });
    const round = await next;
    expect(round.round).toBe(2);
    expect(round.options.map((o: any) => o.id)).not.toContain(owner.playerId);
  });

  it("never repeats media when there are more rounds than media", async () => {
    const host = await env.create("Host", { rounds: 10, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 1);
    const first = await env.startGame(host, [host, p2]);
    expect(first.totalRounds).toBe(3);

    const seen = [first.mediaData.index];
    for (let round = 1; round <= 3; round++) {
      const result = waitFor<any>(host.socket, "round-result");
      host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
      p2.socket.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId });
      const { actualOwnerId } = await result;
      const owner = actualOwnerId === host.playerId ? host : p2;
      const next = round < 3 ? waitFor<any>(host.socket, "new-round") : waitFor<any>(host.socket, "game-finished");
      owner.socket.emit("continue-game", { pin: owner.pin });
      const data = await next;
      if (round < 3) seen.push(data.mediaData.index);
    }
    expect(new Set(seen).size).toBe(3);
  });
});

describe("reconnection", () => {
  it("lets a player resume mid-round and replays the current round", async () => {
    const host = await env.create("Host", { rounds: 5, timer: 10 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    await env.startGame(host, [host, p2]);

    p2.socket.close();
    await sleep(100);
    const fresh = await env.connect();
    const resumed = waitFor<any>(fresh, "session-resumed");
    const replay = waitFor<any>(fresh, "new-round");
    fresh.emit("resume-session", { pin: p2.pin, playerId: p2.playerId, resumeToken: p2.resumeToken });
    expect((await resumed).playerId).toBe(p2.playerId);
    const round = await replay;
    expect(round.round).toBe(1);
    expect(round.remainingMs).toBeGreaterThan(0);
    expect(round.remainingMs).toBeLessThanOrEqual(10_000);

    // The resumed player can still play.
    const result = waitFor<any>(host.socket, "round-result");
    fresh.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId });
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
    const { results } = await result;
    expect(results.find((r: any) => r.playerId === p2.playerId).tooSlow).toBe(false);
  });

  it("doesn't end the round early while a player is briefly offline", async () => {
    await env.stop();
    env = new TestEnv();
    await env.start({ reconnectGraceMs: 5000 });
    const host = await env.create("Host", { rounds: 5, timer: 5 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 1);
    await env.setPool(p2, 1);
    await env.startGame(host, [host, p2]);

    p2.socket.close();
    await sleep(100);
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
    expect(await arrives(host.socket, "round-result", 600)).toBe(false);

    // P2 comes back in time and still gets to answer.
    const fresh = await env.connect();
    const replay = waitFor<any>(fresh, "new-round");
    fresh.emit("resume-session", { pin: p2.pin, playerId: p2.playerId, resumeToken: p2.resumeToken });
    await replay;
    const result = waitFor<any>(host.socket, "round-result");
    fresh.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId });
    const { results } = await result;
    expect(results.find((r: any) => r.playerId === p2.playerId).tooSlow).toBe(false);
  });

  it("refuses to resume with a wrong token", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    p2.socket.close();
    const fresh = await env.connect();
    fresh.emit("resume-session", { pin: p2.pin, playerId: p2.playerId, resumeToken: "not-the-token" });
    expect(await arrives(fresh, "resume-failed")).toBe(true);
  });

  it("removes a player who doesn't come back within the grace period", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const left = waitFor<any>(host.socket, "player-left", 2000);
    p2.socket.close();
    expect((await left).playerId).toBe(p2.playerId);
  });

  it("keeps the host while they are briefly offline, then promotes someone else", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const offlineUpdate = waitForMatch<any>(p2.socket, "room-update", (room) =>
      room.players.some((p: any) => p.id === host.playerId && !p.connected)
    );
    host.socket.close();
    const offline = (await offlineUpdate).players.find((p: any) => p.id === host.playerId);
    expect(offline).toMatchObject({ isHost: true, connected: false });

    const left = await waitFor<any>(p2.socket, "player-left", 2000);
    expect(left.players.find((p: any) => p.id === p2.playerId).isHost).toBe(true);
  });
});
