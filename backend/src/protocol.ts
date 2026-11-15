import { z } from "zod";

/**
 * Schemas for every event a client may send. Payloads that don't match are
 * dropped before reaching game logic.
 */

export const MAX_NAME_LENGTH = 16;

const pin = z.string().regex(/^\d{6}$/);
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
  })
  .partial();

export const schemas = {
  "create-game": z.object({ hostName: playerName, settings: settingsSchema.optional() }),
  "join-game": z.object({ pin, playerName }),
  "resume-session": z.object({ pin, playerId: z.string().min(1).max(64), resumeToken: z.string().min(1).max(128) }),
  "leave-game": z.object({ pin: pin.optional() }).optional(),
  "set-player-state": z.object({ pin, state: z.enum(["selecting", "compressing", "uploading", "ready"]) }),
  "set-media-pool": z.object({
    pin,
    mediaPool: z
      .array(
        z.object({
          id: z.string().max(256).optional(),
          filename: z.string().max(64),
          mediaType: z.enum(["photo", "video"]),
        })
      )
      .max(100),
    playAgain: z.boolean().optional(),
  }),
  "prepare-game": z.object({ pin, updatedSettings: settingsSchema.optional() }),
  "sync-complete": z.object({ pin }),
  "start-game": z.object({ pin }),
  "submit-guess": z.object({
    pin,
    targetUser: z.string().min(1).max(64),
    /** Time between the client receiving the round and the media becoming visible. */
    displayDelayMs: z.number().min(0).max(60_000).optional(),
  }),
  "continue-game": z.object({ pin }),
  "show-media-again": z.object({ pin }),
  "hide-media-again": z.object({ pin }),
  "play-again": z.object({ pin }),
} as const;

export type ClientEvent = keyof typeof schemas;
export type Payload<E extends ClientEvent> = z.infer<(typeof schemas)[E]>;
