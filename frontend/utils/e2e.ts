import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { getRandomBytes } from "expo-crypto";

/**
 * End-to-end encryption for game media.
 *
 * Every room has a random 256-bit room key, created by the host's phone. Media is
 * encrypted with it before upload, so the server only ever stores ciphertext.
 * The room key travels between phones sealed to each player's X25519 public key:
 * the server relays it but can't read it.
 *
 * Limitation: the server distributes the public keys, so a malicious server could
 * substitute its own (an active attack). It protects against a passive or
 * compromised server: stored files, logs, backups or an operator browsing uploads.
 */

const FILE_MAGIC = new Uint8Array([0x4d, 0x52, 0x45, 0x31]); // "MRE1"
const NONCE_LENGTH = 24;
const textEncoder = new TextEncoder();
const FILE_AAD = textEncoder.encode("media-roulette:file:v1");
const SEAL_INFO = textEncoder.encode("media-roulette:room-key:v1");

export interface KeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  const secretKey = getRandomBytes(32);
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

export function generateRoomKey(): Uint8Array {
  return getRandomBytes(32);
}

function sharedKey(mySecret: Uint8Array, theirPublic: Uint8Array): Uint8Array {
  return hkdf(sha256, x25519.getSharedSecret(mySecret, theirPublic), undefined, SEAL_INFO, 32);
}

/** Seals the room key for one recipient. Returns base64 (nonce ‖ ciphertext). */
export function sealRoomKey(roomKey: Uint8Array, recipientPublic: Uint8Array, mySecret: Uint8Array): string {
  const nonce = getRandomBytes(NONCE_LENGTH);
  const sealed = xchacha20poly1305(sharedKey(mySecret, recipientPublic), nonce).encrypt(roomKey);
  return toBase64(concat(nonce, sealed));
}

/** Opens a room key sealed by `senderPublic`. Throws if it was tampered with. */
export function openRoomKey(sealedBase64: string, senderPublic: Uint8Array, mySecret: Uint8Array): Uint8Array {
  const data = fromBase64(sealedBase64);
  const nonce = data.subarray(0, NONCE_LENGTH);
  return xchacha20poly1305(sharedKey(mySecret, senderPublic), nonce).decrypt(data.subarray(NONCE_LENGTH));
}

/** Encrypts a media file: "MRE1" ‖ nonce ‖ ciphertext (authenticated). */
export function encryptMedia(plain: Uint8Array, roomKey: Uint8Array): Uint8Array {
  const nonce = getRandomBytes(NONCE_LENGTH);
  const cipher = xchacha20poly1305(roomKey, nonce, FILE_AAD).encrypt(plain);
  return concat(FILE_MAGIC, nonce, cipher);
}

/** Decrypts a media file produced by `encryptMedia`. Throws if it was tampered with. */
export function decryptMedia(data: Uint8Array, roomKey: Uint8Array): Uint8Array {
  for (let i = 0; i < FILE_MAGIC.length; i++) {
    if (data[i] !== FILE_MAGIC[i]) throw new Error("Not an encrypted media file");
  }
  const nonce = data.subarray(FILE_MAGIC.length, FILE_MAGIC.length + NONCE_LENGTH);
  return xchacha20poly1305(roomKey, nonce, FILE_AAD).decrypt(data.subarray(FILE_MAGIC.length + NONCE_LENGTH));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    const value = B64.indexOf(char);
    if (value === -1) throw new Error("Invalid base64");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}
