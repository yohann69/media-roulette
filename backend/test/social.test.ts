import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { arrives, sleep, TestEnv, waitFor, waitForMatch, type Session } from "./helpers.js";

let env: TestEnv;

beforeEach(async () => {
  env = new TestEnv();
  await env.start({ reconnectGraceMs: 500 });
});

afterEach(async () => {
  await env.stop();
});

/** Both players answer every round with the host, until the game ends. */
async function playToTheEnd(host: Session, p2: Session) {
  const finished = waitFor<any>(host.socket, "game-finished", 5000);
  const answer = (s: Session) =>
    s.socket.on("new-round", () => s.socket.emit("submit-guess", { pin: s.pin, targetUser: host.playerId }));
  const advance = (s: Session) => s.socket.on("round-result", () => s.socket.emit("continue-game", { pin: s.pin }));
  [host, p2].forEach((s) => {
    answer(s);
    advance(s);
  });
  host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
  p2.socket.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId });
  const result = await finished;
  [host, p2].forEach((s) => {
    s.socket.off("new-round");
    s.socket.off("round-result");
  });
  return result;
}

describe("lobby: host can remove a player", () => {
  it("kicks a player from the lobby, and only the host can", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const p3 = await env.join(host.pin, "P3");

    // A non-host can't kick.
    p2.socket.emit("kick-player", { pin: p2.pin, playerId: p3.playerId });
    expect(await arrives(p3.socket, "kicked", 300)).toBe(false);

    const kicked = waitFor(p3.socket, "kicked");
    const left = waitForMatch<any>(host.socket, "player-left", (d) => d.playerId === p3.playerId);
    host.socket.emit("kick-player", { pin: host.pin, playerId: p3.playerId });
    await kicked;
    expect((await left).players.map((p: any) => p.name)).toEqual(["Host", "P2"]);
  });

  it("can't kick during a game", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    await env.startGame(host, [host, p2]);
    host.socket.emit("kick-player", { pin: host.pin, playerId: p2.playerId });
    expect(await arrives(p2.socket, "kicked", 300)).toBe(false);
  });
});

describe("reactions", () => {
  it("relays reactions to the room, rate-limited per player", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const received: any[] = [];
    p2.socket.on("reaction", (r) => received.push(r));

    host.socket.emit("send-reaction", { pin: host.pin, emoji: "😂" });
    host.socket.emit("send-reaction", { pin: host.pin, emoji: "💣" }); // not an allowed emoji
    for (let i = 0; i < 10; i++) host.socket.emit("send-reaction", { pin: host.pin, emoji: "🔥" });
    await sleep(200);

    expect(received[0]).toEqual({ playerId: host.playerId, emoji: "😂" });
    expect(received.length).toBe(4); // burst allowance
    expect(received.every((r) => r.emoji !== "💣")).toBe(true);
  });
});

describe("rematch and series", () => {
  it("keeps the room, players, settings and host, and adds up a series", async () => {
    const host = await env.create("Host", { rounds: 2, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    await env.startGame(host, [host, p2]);
    const final = await playToTheEnd(host, p2);
    expect(final.stats.masterOfDisguise).toBeDefined();

    // P2 asks for the rematch: the host stays host.
    const again = waitFor<any>(host.socket, "play-again-initiated");
    const room = waitForMatch<any>(host.socket, "room-update", (r) => r.gameState === "lobby");
    p2.socket.emit("play-again", { pin: p2.pin });
    expect((await again).newHostId).toBe(host.playerId);
    const lobby = await room;
    expect(lobby.gamesPlayed).toBe(1);
    expect(lobby.settings.rounds).toBe(2);
    const hostEntry = lobby.players.find((p: any) => p.id === host.playerId);
    expect(hostEntry.isHost).toBe(true);
    expect(hostEntry.score).toBe(0);
    const totals = lobby.players.map((p: any) => p.seriesScore);
    expect(totals.some((t: number) => t > 0)).toBe(true);
    expect(lobby.players.reduce((n: number, p: any) => n + p.seriesWins, 0)).toBeGreaterThanOrEqual(1);
  });
});

describe("Time Machine", () => {
  it("keeps the year secret until the reveal, then scores how close each guess was", async () => {
    const host = await env.create("Host", { rounds: 2, timer: 3, mode: "Photo", timeMachine: true });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 1, { years: [2019] });
    await env.setPool(p2, 1, { years: [2019] });

    const sync = waitFor<any>(p2.socket, "sync-media");
    const round = await env.startGame(host, [host, p2]);
    expect(JSON.stringify(await sync)).not.toContain("2019");
    expect(round.yearRange).toEqual({ min: 2019, max: Math.max(2019, new Date().getFullYear()) });
    expect(JSON.stringify(round)).not.toContain('"year"');

    // A "who" guess alone doesn't end the round: the year is still missing.
    const result = waitFor<any>(host.socket, "round-result");
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
    p2.socket.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId });
    expect(await arrives(host.socket, "round-result", 300)).toBe(false);
    host.socket.emit("submit-guess", { pin: host.pin, year: 2019 });
    p2.socket.emit("submit-guess", { pin: p2.pin, year: 2021 });

    const data = await result;
    expect(data.actualYear).toBe(2019);
    const hostResult = data.results.find((r: any) => r.playerId === host.playerId);
    const p2Result = data.results.find((r: any) => r.playerId === p2.playerId);
    expect([hostResult.yearGuess, hostResult.yearBonus]).toEqual([2019, 300]);
    expect([p2Result.yearGuess, p2Result.yearBonus]).toEqual([2021, 100]);
  });

  it("ignores years outside Time Machine games", async () => {
    const host = await env.create("Host", { rounds: 1, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 1, { years: [2019] });
    await env.setPool(p2, 1, { years: [2019] });
    const round = await env.startGame(host, [host, p2]);
    expect(round.yearRange).toBeNull();
    const result = waitFor<any>(host.socket, "round-result");
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId, year: 2019 });
    p2.socket.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId });
    const data = await result;
    expect(data.actualYear).toBeNull();
    expect(data.results.every((r: any) => r.yearBonus === 0)).toBe(true);
  });
});

describe("Slow Reveal", () => {
  it("marks every fourth photo round as a slow reveal", async () => {
    const host = await env.create("Host", { rounds: 4, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    const twists: (string | null)[] = [];
    host.socket.on("new-round", (r) => twists.push(r.twist));
    await env.startGame(host, [host, p2]); // round 1 is recorded by the listener
    await playToTheEnd(host, p2);
    expect(twists).toEqual([null, null, null, "slowReveal"]);
  });
});

describe("invite links", () => {
  it("serves a join page for a PIN, and nothing else", async () => {
    const page = await fetch(`${env.url}/j/123456`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("mediaroulette://join?pin=123456");
    expect(page.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect((await fetch(`${env.url}/j/12345a`)).status).toBe(404);
  });
});
