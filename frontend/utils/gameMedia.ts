import { Directory, File, Paths } from "expo-file-system";
import { decryptMedia, encryptMedia } from "./e2e";

/**
 * Where game media lives on the phone:
 * - `prepared/`: your own compressed media, ready to be shared if chosen for the game.
 * - `game_<pin>/`: decrypted media from other players, for the current game only.
 * Both are deleted when the game ends, when you leave, and at app start.
 */

const PREPARED = "prepared";

function directory(name: string): Directory {
  const dir = new Directory(Paths.cache, name);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

const extensionFor = (mediaType: "photo" | "video") => (mediaType === "video" ? "mp4" : "jpg");

/** Moves a freshly compressed file into the prepared folder. Returns its new URI. */
export function storePrepared(sourceUri: string, id: string, mediaType: "photo" | "video"): string {
  const destination = new File(directory(PREPARED), `${id}.${extensionFor(mediaType)}`);
  if (destination.exists) destination.delete();
  new File(sourceUri).moveSync(destination);
  return destination.uri;
}

export function clearPrepared() {
  deleteDirectory(PREPARED);
}

export function gameDirectory(pin: string): Directory {
  return directory(`game_${pin}`);
}

export function clearGameMedia(pin: string) {
  deleteDirectory(`game_${pin}`);
}

/** Removes every game and prepared folder (e.g. left over after the app was killed). */
export function clearAllGameMedia() {
  for (const entry of Paths.cache.list()) {
    if (entry instanceof Directory && (entry.name.startsWith("game_") || entry.name === PREPARED || entry.name === "upload_tmp")) {
      entry.delete();
    }
  }
}

function deleteDirectory(name: string) {
  try {
    const dir = new Directory(Paths.cache, name);
    if (dir.exists) dir.delete();
  } catch (error) {
    console.warn(`Could not delete ${name}:`, error);
  }
}

/** Encrypts a prepared file with the room key into a temporary file for upload. */
export async function encryptForUpload(uri: string, roomKey: Uint8Array, name: string): Promise<File> {
  const plain = await new File(uri).bytes();
  const encrypted = new File(directory("upload_tmp"), `${name}.bin`);
  if (encrypted.exists) encrypted.delete();
  encrypted.create();
  await encrypted.write(encryptMedia(plain, roomKey));
  return encrypted;
}

/** Downloads an encrypted game file and writes its decrypted content. Returns the playable URI. */
export async function downloadAndDecrypt(options: {
  url: string;
  token: string;
  roomKey: Uint8Array;
  pin: string;
  index: number;
  mediaType: "photo" | "video";
}): Promise<string> {
  const dir = gameDirectory(options.pin);
  const encrypted = await File.downloadFileAsync(options.url, new File(dir, `${options.index}.bin`), {
    headers: { "x-upload-token": options.token },
    idempotent: true,
  });
  try {
    const plain = decryptMedia(await encrypted.bytes(), options.roomKey);
    const output = new File(dir, `${options.index}.${extensionFor(options.mediaType)}`);
    if (output.exists) output.delete();
    output.create();
    await output.write(plain);
    return output.uri;
  } finally {
    encrypted.delete();
  }
}
