import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Temporary, per-room storage for game media.
 *
 * Files live in uploads/<pin>/ only for the duration of a game. They are only
 * accepted with a valid per-player upload token, must really be an image or a
 * video (checked from their content, not from what the client claims), and are
 * only served back to members of the same room.
 */

// Overridable for tests; defaults to backend/uploads (next to src/ and dist/).
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(import.meta.dirname, "..", "uploads");
export const TMP_DIR = path.join(UPLOADS_DIR, "_tmp");

export const LIMITS = {
  /** Encrypted photos are ~0.2–0.7 MB and video clips ~1.5–3 MB. */
  maxFileBytes: 20 * 1024 * 1024,
  maxFilesPerPlayer: 60,
};

const FILENAME_PATTERN = /^[a-f0-9]{32}\.bin$/;


export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

fs.mkdirSync(TMP_DIR, { recursive: true });

/**
 * Media is end-to-end encrypted by the players' phones: the server only accepts
 * files in that format ("MRE1" header) and can't read their content.
 */
const ENCRYPTED_MAGIC = Buffer.from("MRE1", "ascii");

function isEncryptedMedia(filePath: string): boolean {
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(4);
  try {
    fs.readSync(fd, header, 0, 4, 0);
  } finally {
    fs.closeSync(fd);
  }
  return header.equals(ENCRYPTED_MAGIC);
}

export function roomDir(pin: string) {
  return path.join(UPLOADS_DIR, pin);
}

function safeUnlink(filePath: string) {
  fs.rm(filePath, { force: true }, () => {});
}

/**
 * Validates a file multer wrote to the temp folder and moves it into the room
 * folder under a random name. Throws an Error with a `status` on rejection.
 */
export function acceptUpload(tmpPath: string, pin: string) {
  let valid = false;
  try {
    valid = isEncryptedMedia(tmpPath);
  } catch {
    valid = false;
  }
  if (!valid) {
    safeUnlink(tmpPath);
    throw new HttpError(415, "Only end-to-end encrypted media is accepted");
  }

  const size = fs.statSync(tmpPath).size;
  if (size > LIMITS.maxFileBytes) {
    safeUnlink(tmpPath);
    throw new HttpError(413, "File too large");
  }

  const filename = `${crypto.randomBytes(16).toString("hex")}.bin`;
  fs.mkdirSync(roomDir(pin), { recursive: true });
  fs.renameSync(tmpPath, path.join(roomDir(pin), filename));
  return { filename, size };
}

/** Absolute path of a room file, or null if the name isn't one we generated. */
export function resolveFile(pin: string, filename: string) {
  if (!/^\d{6}$/.test(pin) || !FILENAME_PATTERN.test(filename)) return null;
  const filePath = path.join(roomDir(pin), filename);
  return fs.existsSync(filePath) ? filePath : null;
}

export function contentTypeFor(_filename: string) {
  return "application/octet-stream";
}

export function deleteFile(pin: string, filename: string) {
  if (!/^\d{6}$/.test(pin) || !FILENAME_PATTERN.test(filename)) return;
  safeUnlink(path.join(roomDir(pin), filename));
}

/**
 * Backstop: deletes room folders older than `maxAgeMs`, whatever their state.
 * Normal cleanup happens when games end or players leave.
 */
export function sweepOlderThan(maxAgeMs: number) {
  const cutoff = Date.now() - maxAgeMs;
  for (const entry of fs.readdirSync(UPLOADS_DIR)) {
    if (entry === "_tmp") continue; // multer's working folder
    const dir = path.join(UPLOADS_DIR, entry);
    try {
      if (fs.statSync(dir).birthtimeMs < cutoff) fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Already gone
    }
  }
}

export function deleteRoom(pin: string) {
  if (!/^\d{6}$/.test(pin)) return;
  fs.rm(roomDir(pin), { recursive: true, force: true }, () => {});
}

/** Removes every room folder and temp file, e.g. left over from a previous run. */
export function clearAll() {
  for (const entry of fs.readdirSync(UPLOADS_DIR)) {
    if (entry === "_tmp") continue;
    fs.rmSync(path.join(UPLOADS_DIR, entry), { recursive: true, force: true });
  }
  for (const entry of fs.readdirSync(TMP_DIR)) {
    fs.rmSync(path.join(TMP_DIR, entry), { recursive: true, force: true });
  }
}
