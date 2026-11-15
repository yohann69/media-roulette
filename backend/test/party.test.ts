import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { arrives, TestEnv, waitFor, waitForMatch, type Session } from "./helpers.js";

let env: TestEnv;

beforeEach(async () => {
  env = new TestEnv();
  await env.start({ reconnectGraceMs: 500, captionWriteMs: 1500, captionVoteMs: 1500, storyMs: 1500, storyEndPauseMs: 50 });
});

afterEach(async () => {
  await env.stop();
});

async function setup(settings: Record<string, unknown>) {
  const host = await env.create("Host", { timer: 3, ...settings });
  const p2 = await env.join(host.pin, "P2");
  await env.setPool(host, 3);
  await env.setPool(p2, 3);
  return { host, p2 };
}

/**
 * Plays rounds (everyone answers, the owner continues) and resolves with the
 * result of round `stopAt`, without continuing past it.
 */
async function playUntilResultOf(stopAt: number, players: Session[]) {
  return new Promise<any>((resolve) => {
    let round = 0;
    for (const s of players) {
      s.socket.on("new-round", (r: any) => {
        round = r.round;
        s.socket.emit("submit-guess", { pin: s.pin, targetUser: players[0].playerId });
      });
      s.socket.on("round-result", (res: any) => {
        if (round >= stopAt) {
          if (s === players[0]) resolve(res);
          return;
        }
        if (res.actualOwnerId === s.playerId) s.socket.emit("continue-game", { pin: s.pin });
      });
    }
  }).finally(() => players.forEach((s) => s.socket.off("new-round").off("round-result")));
}

const ownerOf = (result: any, players: Session[]) => players.find((p) => p.playerId === result.actualOwnerId)!;

describe("party extras settings", () => {
  it("lets only the host turn extras on in the lobby", async () => {
    const host = await env.create();
    const p2 = await env.join(host.pin, "P2");
    const changed = waitForMatch<any>(host.socket, "room-update", (r) => r.settings.captionThis === true, 300).then(
      () => true,
      () => false
    );
    p2.socket.emit("update-extras", { pin: p2.pin, captionThis: true });
    expect(await changed).toBe(false);
    const update = waitForMatch<any>(host.socket, "room-update", (r) => r.settings.captionThis === true);
    host.socket.emit("update-extras", { pin: host.pin, captionThis: true, storyTime: true });
    expect((await update).settings.storyTime).toBe(true);
  });
});

describe("Caption This", () => {
  it("collects captions, runs an anonymous vote, and scores the votes", async () => {
    const { host, p2 } = await setup({ rounds: 3, captionThis: true });
    const players = [host, p2];
    const done = playUntilResultOf(3, players);
    await env.startGame(host, players);
    const result3 = await done;

    const captionStart = waitFor<any>(p2.socket, "caption-start");
    ownerOf(result3, players).socket.emit("continue-game", { pin: host.pin });
    expect((await captionStart).round).toBe(3);

    const hostVote = waitFor<any>(host.socket, "caption-vote-start");
    const p2Vote = waitFor<any>(p2.socket, "caption-vote-start");
    host.socket.emit("submit-caption", { pin: host.pin, text: "  When   the wifi drops  " });
    p2.socket.emit("submit-caption", { pin: p2.pin, text: "Monday mood" });
    const [hv, pv] = await Promise.all([hostVote, p2Vote]);
    expect(hv.captions).toHaveLength(2);
    expect(JSON.stringify(hv)).not.toContain(host.playerId); // anonymous
    expect(hv.captions.find((c: any) => c.mine).text).toBe("When the wifi drops");

    const results = waitFor<any>(host.socket, "caption-results");
    const own = hv.captions.find((c: any) => c.mine);
    host.socket.emit("vote-caption", { pin: host.pin, captionId: own.id }); // own caption: ignored
    host.socket.emit("vote-caption", { pin: host.pin, captionId: hv.captions.find((c: any) => !c.mine).id });
    p2.socket.emit("vote-caption", { pin: p2.pin, captionId: pv.captions.find((c: any) => !c.mine).id });
    const res = await results;
    expect(res.results.map((r: any) => [r.authorName, r.votes, r.points])).toEqual(
      expect.arrayContaining([
        ["Host", 1, 100],
        ["P2", 1, 100],
      ])
    );

    const finished = waitFor<any>(host.socket, "game-finished");
    ownerOf(result3, players).socket.emit("continue-game", { pin: host.pin });
    await finished;
  });

  it("moves to the vote when the writing time runs out", async () => {
    const { host, p2 } = await setup({ rounds: 3, captionThis: true });
    const players = [host, p2];
    const done = playUntilResultOf(3, players);
    await env.startGame(host, players);
    const result3 = await done;
    ownerOf(result3, players).socket.emit("continue-game", { pin: host.pin });
    host.socket.emit("submit-caption", { pin: host.pin, text: "Only me" });
    // A single caption: nothing to vote on, results come straight after the timer.
    const res = await waitFor<any>(p2.socket, "caption-results", 3000);
    expect(res.results).toEqual([expect.objectContaining({ authorName: "Host", text: "Only me", votes: 0 })]);
  });
});

describe("Story Time", () => {
  it("gives the owner the floor and counts each applause once", async () => {
    const { host, p2 } = await setup({ rounds: 3, storyTime: true });
    const players = [host, p2];
    const done = playUntilResultOf(3, players);
    await env.startGame(host, players);
    const result3 = await done;
    const owner = ownerOf(result3, players);
    const listener = players.find((p) => p !== owner)!;

    const start = waitFor<any>(listener.socket, "story-start");
    owner.socket.emit("continue-game", { pin: owner.pin });
    expect((await start).ownerId).toBe(owner.playerId);

    const clap = waitForMatch<any>(owner.socket, "applause", (a) => a.count === 1);
    listener.socket.emit("applaud", { pin: listener.pin });
    listener.socket.emit("applaud", { pin: listener.pin });
    owner.socket.emit("applaud", { pin: owner.pin }); // owners can't applaud themselves
    await clap;

    const ended = waitFor<any>(listener.socket, "story-ended");
    listener.socket.emit("end-story", { pin: listener.pin }); // only the owner can end it
    expect(await arrives(listener.socket, "story-ended", 200)).toBe(false);
    owner.socket.emit("end-story", { pin: owner.pin });
    const story = await ended;
    expect([story.applause, story.points]).toEqual([1, 50]);
    await waitFor(host.socket, "game-finished");
  });
});

describe("extras off", () => {
  it("goes straight to the next round", async () => {
    const { host, p2 } = await setup({ rounds: 4 });
    const players = [host, p2];
    const done = playUntilResultOf(3, players);
    await env.startGame(host, players);
    const result3 = await done;
    const next = waitFor<any>(host.socket, "new-round");
    ownerOf(result3, players).socket.emit("continue-game", { pin: host.pin });
    expect((await next).round).toBe(4);
  });
});

describe("Slow Reveal mode", () => {
  it("slow-reveals every photo round", async () => {
    const { host, p2 } = await setup({ rounds: 2, slowReveal: true });
    const players = [host, p2];
    const twists: (string | null)[] = [];
    host.socket.on("new-round", (r: any) => twists.push(r.twist));
    const done = playUntilResultOf(2, players);
    await env.startGame(host, players);
    await done;
    expect(twists).toEqual(["slowReveal", "slowReveal"]);
  });
});
