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

describe("rematch: each player decides", () => {
  it("lets the first player start a new room as host; others join if they want, keeping their series", async () => {
    const host = await env.create("Host", { rounds: 2, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    const p3 = await env.join(host.pin, "P3");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    await env.setPool(p3, 2);
    const p3Finished = waitFor<any>(p3.socket, "game-finished", 5000);
    p3.socket.on("new-round", () => p3.socket.emit("submit-guess", { pin: p3.pin, targetUser: host.playerId }));
    p3.socket.on("round-result", () => p3.socket.emit("continue-game", { pin: p3.pin }));
    await env.startGame(host, [host, p2, p3]);
    await playToTheEnd(host, p2);
    await p3Finished;

    // P2 asks first: P2 hosts the rematch, in a new room with the same settings.
    const available = waitFor<any>(host.socket, "rematch-available");
    p2.socket.emit("rematch", { pin: p2.pin });
    const p2Entry = await waitFor<any>(p2.socket, "rematch-entered");
    expect(p2Entry.created).toBe(true);
    expect(p2Entry.pin).not.toBe(host.pin);
    expect(p2Entry.room.settings.rounds).toBe(2);
    expect(p2Entry.room.gamesPlayed).toBe(1);
    expect(p2Entry.room.players).toEqual([expect.objectContaining({ name: "P2", isHost: true })]);
    expect((await available).hostName).toBe("P2");

    // The host joins it as a regular player; P3 doesn't.
    host.socket.emit("rematch", { pin: host.pin });
    const hostEntry = await waitFor<any>(host.socket, "rematch-entered");
    expect(hostEntry.created).toBe(false);
    expect(hostEntry.pin).toBe(p2Entry.pin);
    const names = hostEntry.room.players.map((p: any) => [p.name, p.isHost]);
    expect(names).toEqual([
      ["P2", true],
      ["Host", false],
    ]);
    const series = hostEntry.room.players.reduce((n: number, p: any) => n + p.seriesWins, 0);
    expect(series).toBeGreaterThanOrEqual(1);
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
  it("never pixelates photos outside Slow Reveal mode", async () => {
    const host = await env.create("Host", { rounds: 4, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    const twists: (string | null)[] = [];
    host.socket.on("new-round", (r) => twists.push(r.twist));
    await env.startGame(host, [host, p2]); // round 1 is recorded by the listener
    await playToTheEnd(host, p2);
    expect(twists).toEqual([null, null, null, null]);
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

describe("show again", () => {
  /** Plays round 1 to its result; returns the owner and the other player. */
  async function toResults(rounds = 2) {
    const host = await env.create("Host", { rounds, timer: 3 });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    const result = waitFor<any>(host.socket, "round-result");
    await env.startGame(host, [host, p2]);
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
    p2.socket.emit("submit-guess", { pin: p2.pin, targetUser: host.playerId });
    const r = await result;
    const [owner, other] = r.actualOwnerId === host.playerId ? [host, p2] : [p2, host];
    return { owner, other };
  }

  it("shows the photo to everyone only while the owner holds the button", async () => {
    const { owner, other } = await toResults();
    other.socket.emit("show-media-again", { pin: other.pin }); // not the owner: ignored
    expect(await arrives(other.socket, "show-media-again", 200)).toBe(false);

    const shown = waitFor(other.socket, "show-media-again");
    owner.socket.emit("show-media-again", { pin: owner.pin });
    await shown;
    const hidden = waitFor(other.socket, "hide-media-again");
    owner.socket.emit("hide-media-again", { pin: owner.pin });
    await hidden;
  });

  it("hides it when the game moves on, even if the release was lost", async () => {
    const { owner, other } = await toResults();
    const shown = waitFor(other.socket, "show-media-again");
    owner.socket.emit("show-media-again", { pin: owner.pin });
    await shown;
    const hidden = waitFor(other.socket, "hide-media-again");
    owner.socket.emit("continue-game", { pin: owner.pin });
    await hidden;
  });

  it("hides it when the owner disconnects", async () => {
    const { owner, other } = await toResults();
    const shown = waitFor(other.socket, "show-media-again");
    owner.socket.emit("show-media-again", { pin: owner.pin });
    await shown;
    const hidden = waitFor(other.socket, "hide-media-again");
    owner.socket.disconnect();
    await hidden;
  });
});
