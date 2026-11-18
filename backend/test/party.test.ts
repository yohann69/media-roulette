import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { arrives, TestEnv, waitFor, type Session } from "./helpers.js";

let env: TestEnv;

beforeEach(async () => {
  env = new TestEnv();
  await env.start({ reconnectGraceMs: 500, captionWriteMs: 1500, captionVoteMs: 1500 });
});

afterEach(async () => {
  await env.stop();
});

async function setup(rounds: number) {
  const host = await env.create("Host", { rounds, timer: 3, mode: "Photo", captionMode: true });
  const p2 = await env.join(host.pin, "P2");
  await env.setPool(host, 2);
  await env.setPool(p2, 2);
  return { host, p2 };
}

/** Both players write, then vote for the other's caption. Resolves with the results. */
async function captionRound(host: Session, p2: Session, texts: [string, string]) {
  const hostVote = waitFor<any>(host.socket, "caption-vote-start");
  const p2Vote = waitFor<any>(p2.socket, "caption-vote-start");
  host.socket.emit("submit-caption", { pin: host.pin, text: texts[0] });
  p2.socket.emit("submit-caption", { pin: p2.pin, text: texts[1] });
  const [hv, pv] = await Promise.all([hostVote, p2Vote]);
  const results = waitFor<any>(host.socket, "caption-results");
  host.socket.emit("vote-caption", { pin: host.pin, captionId: hv.captions.find((c: any) => !c.mine).id });
  p2.socket.emit("vote-caption", { pin: p2.pin, captionId: pv.captions.find((c: any) => !c.mine).id });
  return { hv, results: await results };
}

describe("Caption mode", () => {
  it("skips the guessing: each round is a caption, an anonymous vote, and results", async () => {
    const { host, p2 } = await setup(2);
    const round = await env.startGame(host, [host, p2]);
    expect(round.captionEndsInMs).toBeGreaterThan(0);

    // Guesses don't exist in this mode.
    host.socket.emit("submit-guess", { pin: host.pin, targetUser: host.playerId });
    expect(await arrives(host.socket, "round-result", 200)).toBe(false);

    const { hv, results } = await captionRound(host, p2, ["  When   the wifi drops  ", "Monday mood"]);
    expect(JSON.stringify(hv)).not.toContain(host.playerId); // anonymous while voting
    expect(hv.captions.find((c: any) => c.mine).text).toBe("When the wifi drops");
    expect(results.results.map((r: any) => [r.authorName, r.votes, r.points])).toEqual(
      expect.arrayContaining([
        ["Host", 1, 100],
        ["P2", 1, 100],
      ])
    );
  });

  it("lets only the host move on, and ends with the best caption", async () => {
    const { host, p2 } = await setup(2);
    await env.startGame(host, [host, p2]);
    await captionRound(host, p2, ["One", "Two"]);

    p2.socket.emit("continue-game", { pin: p2.pin });
    expect(await arrives(host.socket, "new-round", 300)).toBe(false);
    const next = waitFor<any>(host.socket, "new-round");
    host.socket.emit("continue-game", { pin: host.pin });
    expect((await next).round).toBe(2);

    await captionRound(host, p2, ["Three", "Four"]);
    const finished = waitFor<any>(host.socket, "game-finished");
    host.socket.emit("continue-game", { pin: host.pin });
    const final = await finished;
    expect(final.stats.bestCaption).toEqual(expect.objectContaining({ votes: 1 }));
    expect(final.leaderboard.every((e: any) => e.totalScore === 200)).toBe(true);
  });

  it("goes to the results when the writing time runs out with a single caption", async () => {
    const { host, p2 } = await setup(1);
    await env.startGame(host, [host, p2]);
    host.socket.emit("submit-caption", { pin: host.pin, text: "Only me" });
    const res = await waitFor<any>(p2.socket, "caption-results", 3000);
    expect(res.results).toEqual([expect.objectContaining({ authorName: "Host", text: "Only me", votes: 0 })]);
  });
});

describe("Slow Reveal mode", () => {
  it("pixelates every photo round", async () => {
    const host = await env.create("Host", { rounds: 2, timer: 3, slowReveal: true });
    const p2 = await env.join(host.pin, "P2");
    await env.setPool(host, 2);
    await env.setPool(p2, 2);
    const round = await env.startGame(host, [host, p2]);
    expect(round.twist).toBe("slowReveal");
  });
});
