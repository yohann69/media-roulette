/**
 * Google Drive backup worker.
 *
 * Uploads copies of player media to a shared Drive folder in the background.
 * Layout in Drive:
 *   <root folder>/<sanitized-username>/<username>-<date>-<suffix>.<ext>
 *   Per-user subfolders are created lazily (find-or-create, cached in-memory).
 *
 * Designed to be completely transparent to the game flow:
 *   - enqueueBackup() returns immediately (fire-and-forget)
 *   - Uploads are streamed from disk (no RAM buffering for large videos)
 *   - A bounded worker pool drains the queue with exponential-backoff retries
 *   - Gracefully no-ops when credentials are missing, so nothing breaks locally
 *
 * Required environment (or sensible defaults):
 *   GOOGLE_DRIVE_FOLDER_ID           - target folder id (default: configured below)
 *   GOOGLE_DRIVE_CREDENTIALS_JSON    - raw JSON string of the service-account key
 *                                      (preferred on PaaS like Railway where you
 *                                      can't ship files, only env vars)
 *   GOOGLE_DRIVE_CREDENTIALS_BASE64  - same JSON but base64-encoded, if your host
 *                                      mangles multi-line values
 *   GOOGLE_DRIVE_CREDENTIALS_PATH    - path to service-account JSON key file
 *                                      (default: ./credentials/google-drive-key.json)
 *                                      used as a fallback when no env JSON is set
 *   GOOGLE_DRIVE_BACKUP_CONCURRENCY  - parallel uploads (default: 5)
 */

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

// googleapis is loaded lazily (only when credentials are configured).
const require = createRequire(import.meta.url);
const __dirname = import.meta.dirname;

const DEFAULT_FOLDER_ID = "1vTdcp3lecvI6BzJY63Xe5eERWWS6bHLa";
const DEFAULT_CREDENTIALS_PATH = path.join(__dirname, "..", "credentials", "google-drive-key.json");
const DEFAULT_CONCURRENCY = 5;
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 1000;

const EXT_TO_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
};

const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID;
const credentialsPath = process.env.GOOGLE_DRIVE_CREDENTIALS_PATH || DEFAULT_CREDENTIALS_PATH;
const concurrency = parseInt(process.env.GOOGLE_DRIVE_BACKUP_CONCURRENCY || "", 10) || DEFAULT_CONCURRENCY;

// Resolve credentials in this order:
//   1. GOOGLE_DRIVE_CREDENTIALS_JSON   (raw JSON string — Railway / Heroku style)
//   2. GOOGLE_DRIVE_CREDENTIALS_BASE64 (base64-encoded JSON, in case the raw
//      form gets mangled by the host's env UI)
//   3. credentials file on disk        (local dev)
function loadCredentials() {
  const raw = process.env.GOOGLE_DRIVE_CREDENTIALS_JSON;
  if (raw) {
    return { source: "env:JSON", credentials: JSON.parse(raw) };
  }
  const b64 = process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64;
  if (b64) {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    return { source: "env:BASE64", credentials: JSON.parse(decoded) };
  }
  if (fs.existsSync(credentialsPath)) {
    return { source: `file:${credentialsPath}`, keyFile: credentialsPath };
  }
  return null;
}

let driveClient = null;
let enabled = false;

try {
  const creds = loadCredentials();
  if (creds) {
    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      ...(creds.credentials ? { credentials: creds.credentials } : {}),
      ...(creds.keyFile ? { keyFile: creds.keyFile } : {}),
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    driveClient = google.drive({ version: "v3", auth });
    enabled = true;
    console.log(`[driveBackup] Enabled (source=${creds.source}). Folder=${folderId} concurrency=${concurrency}`);
  } else {
    console.warn("[driveBackup] Disabled: no credentials found (set GOOGLE_DRIVE_CREDENTIALS_JSON env var or place key file). Uploads will be skipped.");
  }
} catch (err) {
  console.warn(`[driveBackup] Disabled: failed to initialize (${err.message}). Uploads will be skipped.`);
}

const queue = [];
let activeWorkers = 0;

// Per-user folder id cache. `folderCreationInFlight` dedupes concurrent
// lookups so a burst of uploads for the same user never creates duplicates.
const userFolderIdCache = new Map();
const folderCreationInFlight = new Map();

function isEnabled() {
  return enabled;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function getOrCreateUserFolder(sanitizedUsername) {
  const cached = userFolderIdCache.get(sanitizedUsername);
  if (cached) return cached;

  const inFlight = folderCreationInFlight.get(sanitizedUsername);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const escapedName = sanitizedUsername.replace(/'/g, "\\'");
      const q = `name='${escapedName}' and mimeType='${FOLDER_MIME}' and '${folderId}' in parents and trashed=false`;
      const list = await driveClient.files.list({
        q,
        fields: "files(id, name)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (list.data.files && list.data.files.length > 0) {
        const id = list.data.files[0].id;
        userFolderIdCache.set(sanitizedUsername, id);
        return id;
      }
      const created = await driveClient.files.create({
        requestBody: {
          name: sanitizedUsername,
          mimeType: FOLDER_MIME,
          parents: [folderId],
        },
        fields: "id",
        supportsAllDrives: true,
      });
      const id = created.data.id;
      userFolderIdCache.set(sanitizedUsername, id);
      console.log(`[driveBackup] Created user folder "${sanitizedUsername}" (id=${id})`);
      return id;
    } finally {
      folderCreationInFlight.delete(sanitizedUsername);
    }
  })();

  folderCreationInFlight.set(sanitizedUsername, promise);
  return promise;
}

function sanitizeUsername(name) {
  return String(name || "anon").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 48) || "anon";
}

function formatDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

function buildDriveName(username, originalFilename) {
  const ext = path.extname(originalFilename || "").toLowerCase() || "";
  const suffix = Math.floor(Math.random() * 1e4).toString().padStart(4, "0");
  return `${sanitizeUsername(username)}-${formatDate()}-${suffix}${ext}`;
}

function mimeFor(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadOnce(job) {
  const sanitized = sanitizeUsername(job.username);
  const parentId = await getOrCreateUserFolder(sanitized);
  const driveName = buildDriveName(job.username, job.localPath);
  const res = await driveClient.files.create({
    requestBody: {
      name: driveName,
      parents: [parentId],
    },
    media: {
      mimeType: mimeFor(job.localPath),
      body: fs.createReadStream(job.localPath),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id;
}

async function processJob(job) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const id = await uploadOnce(job);
      console.log(`[driveBackup] Uploaded ${path.basename(job.localPath)} as ${job.username} (id=${id})`);
      return;
    } catch (err) {
      const status = err?.code || err?.response?.status;
      const retriable = status === 429 || (typeof status === "number" && status >= 500);
      if (!retriable || attempt === MAX_RETRIES) {
        console.error(`[driveBackup] Failed to upload ${job.localPath} after ${attempt + 1} attempt(s): ${err.message}`);
        return;
      }
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[driveBackup] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms (status=${status})`);
      await sleep(delay);
    }
  }
}

async function workerLoop() {
  activeWorkers++;
  try {
    while (queue.length > 0) {
      const job = queue.shift();
      await processJob(job);
    }
  } finally {
    activeWorkers--;
  }
}

function enqueueBackup({ localPath, username, originalFilename }) {
  if (!enabled) return;
  if (!localPath || !fs.existsSync(localPath)) {
    console.warn(`[driveBackup] Skipped: file not found (${localPath})`);
    return;
  }
  queue.push({
    localPath,
    username,
    originalFilename: originalFilename || path.basename(localPath),
  });
  while (activeWorkers < concurrency && queue.length > 0) {
    workerLoop();
  }
}

export { enqueueBackup, isEnabled };
