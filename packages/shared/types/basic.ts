import { z } from "zod";
import { CHAT_CONSTANTS } from "../constants";

export const GRID = {
  SIZE: 100,
  ORIGIN_X: 50,
  ORIGIN_Y: 50,
  CLIENT_RADIUS: 25,
} as const;

export const PositionSchema = z.object({
  x: z.number().min(0).max(GRID.SIZE),
  y: z.number().min(0).max(GRID.SIZE),
});
export type PositionType = z.infer<typeof PositionSchema>;

export const AudioTrackSchema = z.object({
  name: z.string(),
  url: z.string(),
});
export type AudioTrackType = z.infer<typeof AudioTrackSchema>;

export const AudioSourceSchema = z
  .object({
    url: z.string(),
    name: z.string().optional(),
    tracks: z.array(AudioTrackSchema).min(2).optional(),
  })
  .superRefine((source, context) => {
    if (!source.tracks) return;
    if (source.tracks[0].url !== source.url) {
      context.addIssue({
        code: "custom",
        message: "A multitrack source URL must match its first track",
        path: ["url"],
      });
    }
    if (new Set(source.tracks.map((track) => track.url)).size !== source.tracks.length) {
      context.addIssue({
        code: "custom",
        message: "Multitrack file URLs must be unique",
        path: ["tracks"],
      });
    }
  });
export type AudioSourceType = z.infer<typeof AudioSourceSchema>;

export const ChatMessageSchema = z.object({
  id: z.number(),
  clientId: z.string(),
  username: z.string(),
  text: z.string().max(CHAT_CONSTANTS.MAX_MESSAGE_LENGTH),
  timestamp: z.number(),
  countryCode: z.string().optional(),
  isCreator: z.boolean().default(false),
});
export type ChatMessageType = z.infer<typeof ChatMessageSchema>;
