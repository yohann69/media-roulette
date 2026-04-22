/**
 * Google Drive backup worker.
 *
 * Uploads copies of player media to a shared Drive folder in the background.
 * Designed to be completely transparent to the game flow:
 *   - enqueueBackup() returns immediately (fire-and-forget)
 *   - Uploads are streamed from disk (no RAM buffering for large videos)
 *   - A bounded worker pool drains the queue with exponential-backoff retries
 *   - Gracefully no-ops when credentials are missing, so nothing breaks locally
 *
 * Required environment (or sensible defaults):
 *   GOOGLE_DRIVE_FOLDER_ID           - target folder id (default: configured below)
 *   GOOGLE_DRIVE_CREDENTIALS_PATH    - path to service-account JSON key file
 *                                      (default: ./credentials/google-drive-key.json)
 *   GOOGLE_DRIVE_BACKUP_CONCURRENCY  - parallel uploads (default: 5)
 */

const path = require("path");
const fs = require("fs");

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

let driveClient = null;
let enabled = false;

try {
  if (fs.existsSync(credentialsPath)) {
    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    driveClient = google.drive({ version: "v3", auth });
    enabled = true;
    console.log(`[driveBackup] Enabled. Folder=${folderId} concurrency=${concurrency}`);
  } else {
    console.warn(`[driveBackup] Disabled: no credentials at ${credentialsPath}. Uploads will be skipped.`);
  }
} catch (err) {
  console.warn(`[driveBackup] Disabled: failed to initialize (${err.message}). Uploads will be skipped.`);
}

const queue = [];
let activeWorkers = 0;

function isEnabled() {
  return enabled;
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
  const driveName = buildDriveName(job.username, job.localPath);
  const res = await driveClient.files.create({
    requestBody: {
      name: driveName,
      parents: [folderId],
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

module.exports = { enqueueBackup, isEnabled };
