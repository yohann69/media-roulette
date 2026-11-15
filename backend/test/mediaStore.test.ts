import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as mediaStore from "../src/mediaStore.js";

describe("mediaStore.sweepOlderThan", () => {
  it("removes old room folders but never the upload temp folder", () => {
    const dir = mediaStore.roomDir("123456");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "a.bin"), "x");

    mediaStore.sweepOlderThan(60 * 60_000);
    expect(fs.existsSync(dir)).toBe(true);

    mediaStore.sweepOlderThan(-1000);
    expect(fs.existsSync(dir)).toBe(false);
    expect(fs.existsSync(mediaStore.TMP_DIR)).toBe(true);
  });
});
