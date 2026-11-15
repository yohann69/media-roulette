import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 20_000,
    // Integration tests share one temporary uploads folder.
    fileParallelism: false,
    env: {
      UPLOADS_DIR: path.join(os.tmpdir(), "media-roulette-test-uploads"),
    },
  },
});
