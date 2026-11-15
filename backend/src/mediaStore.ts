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
  maxImageBytes: 4 * 1024 * 1024,
  maxVideoBytes: 20 * 1024 * 1024,
  maxFilesPerPlayer: 60,
};

const FILENAME_PATTERN = /^[a-f0-9]{32}\.(jpg|png|webp|mp4|mov)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

fs.mkdirSync(TMP_DIR, { recursive: true });

/** Detects the real file type from its first bytes. Returns null when unsupported. */
type DetectedType = { ext: string; kind: "photo" | "video" };

function detectType(filePath: string): DetectedType | null {
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(16);
  try {
    fs.readSync(fd, header, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }

  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return { ext: "jpg", kind: "photo" };
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", kind: "photo" };
  }
  if (header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP") {
    return { ext: "webp", kind: "photo" };
  }
  if (header.toString("ascii", 4, 8) === "ftyp") {
    const brand = header.toString("ascii", 8, 12);
    return brand === "qt  " ? { ext: "mov", kind: "video" } : { ext: "mp4", kind: "video" };
  }
  return null;
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
  let type: DetectedType | null;
  try {
    type = detectType(tmpPath);
  } catch {
    type = null;
  }
  if (!type) {
    safeUnlink(tmpPath);
    throw new HttpError(415, "Unsupported file type");
  }

  const size = fs.statSync(tmpPath).size;
  const maxBytes = type.kind === "video" ? LIMITS.maxVideoBytes : LIMITS.maxImageBytes;
  if (size > maxBytes) {
    safeUnlink(tmpPath);
    throw new HttpError(413, "File too large");
  }

  const filename = `${crypto.randomBytes(16).toString("hex")}.${type.ext}`;
  fs.mkdirSync(roomDir(pin), { recursive: true });
  fs.renameSync(tmpPath, path.join(roomDir(pin), filename));
  return { filename, kind: type.kind, size };
}

/** Absolute path of a room file, or null if the name isn't one we generated. */
export function resolveFile(pin: string, filename: string) {
  if (!/^\d{6}$/.test(pin) || !FILENAME_PATTERN.test(filename)) return null;
  const filePath = path.join(roomDir(pin), filename);
  return fs.existsSync(filePath) ? filePath : null;
}

export function contentTypeFor(filename: string) {
  return CONTENT_TYPES[path.extname(filename).slice(1)] || "application/octet-stream";
}

export function deleteFile(pin: string, filename: string) {
  if (!/^\d{6}$/.test(pin) || !FILENAME_PATTERN.test(filename)) return;
  safeUnlink(path.join(roomDir(pin), filename));
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
