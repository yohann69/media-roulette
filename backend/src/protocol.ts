import { z } from "zod";

/**
 * Schemas for every event a client may send. Payloads that don't match are
 * dropped before reaching game logic.
 */

export const MAX_NAME_LENGTH = 16;
export const MAX_CAPTION_LENGTH = 80;

const pin = z.string().regex(/^\d{6}$/);
/** 32-byte X25519 public key, base64. */
const publicKey = z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
const playerName = z
  .string()
  .transform((s) => s.trim().slice(0, MAX_NAME_LENGTH))
  .pipe(z.string().min(1))
  .catch("Player");

export const settingsSchema = z
  .object({
    rounds: z.number().int().min(1).max(100).catch(10),
    timer: z.number().int().min(3).max(30).catch(5),
    mode: z.enum(["Photo", "Video", "Mix"]).catch("Photo"),
    playVideoWithSound: z.boolean().optional().catch(true),
    blindMode: z.boolean().optional().catch(false),
    timeMachine: z.boolean().optional().catch(false),
    slowReveal: z.boolean().optional().catch(false),
    captionThis: z.boolean().optional().catch(false),
    storyTime: z.boolean().optional().catch(false),
  })
  .partial();

/** A plausible year a photo was taken. */
const year = z.number().int().min(1900).max(2100);

export const schemas = {
  "create-game": z.object({ hostName: playerName, settings: settingsSchema.optional(), publicKey: publicKey.optional() }),
  "join-game": z.object({ pin, playerName, publicKey: publicKey.optional() }),
  "resume-session": z.object({ pin, playerId: z.string().min(1).max(64), resumeToken: z.string().min(1).max(128) }),
  "leave-game": z.object({ pin: pin.optional() }).optional(),
  "set-player-state": z.object({ pin, state: z.enum(["selecting", "compressing", "uploading", "ready"]) }),
  "set-media-pool": z.object({
    pin,
    mediaPool: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          mediaType: z.enum(["photo", "video"]),
          /** Only sent in Time Machine games. Kept on the server until the reveal. */
          year: year.optional().catch(undefined),
        })
      )
      .max(100),
    playAgain: z.boolean().optional(),
  }),
  /** The owner uploaded (encrypted) the media the server asked for. */
  "uploads-complete": z.object({
    pin,
    items: z.array(z.object({ id: z.string().min(1).max(64), filename: z.string().max(64) })).max(100),
  }),
  /** A player holding the room key seals it for another player. Opaque to the server. */
  "share-room-key": z.object({ pin, to: z.string().min(1).max(64), sealed: z.string().min(16).max(200) }),
  "prepare-game": z.object({ pin, updatedSettings: settingsSchema.optional() }),
  "sync-complete": z.object({ pin }),
  "start-game": z.object({ pin }),
  "submit-guess": z.object({
    pin,
    /** Who took it. Optional so a Time Machine year can be sent on its own. */
    targetUser: z.string().min(1).max(64).optional(),
    year: year.optional(),
    /** Time between the client receiving the round and the media becoming visible. */
    displayDelayMs: z.number().min(0).max(60_000).optional(),
  }),
  "continue-game": z.object({ pin }),
  /** The owner hides their own media during its round: the round is dropped. */
  "skip-media": z.object({ pin }),
  "show-media-again": z.object({ pin }),
  "hide-media-again": z.object({ pin }),
  "play-again": z.object({ pin }),
  /** The host removes a player from the lobby. */
  "kick-player": z.object({ pin, playerId: z.string().min(1).max(64) }),
  /** Host, in the lobby: turn the party extras on or off. */
  "update-extras": z.object({ pin, captionThis: z.boolean().optional(), storyTime: z.boolean().optional() }),
  "submit-caption": z.object({
    pin,
    text: z
      .string()
      .transform((s) => s.replace(/\s+/g, " ").trim().slice(0, MAX_CAPTION_LENGTH))
      .pipe(z.string().min(1)),
  }),
  "vote-caption": z.object({ pin, captionId: z.string().min(1).max(16) }),
  /** Applause for the story being told (once per player). */
  applaud: z.object({ pin }),
  /** The owner finished telling the story. */
  "end-story": z.object({ pin }),
} as const;

export type ClientEvent = keyof typeof schemas;
export type Payload<E extends ClientEvent> = z.infer<(typeof schemas)[E]>;
