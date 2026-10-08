import { IS_DEMO_MODE } from "@/demo";
import { deleteObject, extractKeyFromUrl } from "@/lib/r2";
import { sendBroadcast } from "@/utils/responses";
import { requireCanMutate } from "@/websocket/middlewares";
import type { HandlerFunction } from "@/websocket/types";
import type { ExtractWSRequestFrom } from "@beatsync/shared";

export const handleDeleteAudioSources: HandlerFunction<ExtractWSRequestFrom["DELETE_AUDIO_SOURCES"]> = async ({
  ws,
  message,
  server,
}) => {
  const { room } = requireCanMutate(ws);

  // Get current URLs to validate the request
  const currentUrls = new Set(room.getAudioSources().map((s) => s.url));

  // Only process URLs that actually exist in the room
  const urlsToDelete = message.urls.filter((url) => currentUrls.has(url));

  if (urlsToDelete.length === 0) {
    return; // nothing to do, silent idempotency
  }

  // In demo mode, skip R2 deletion — just remove from room state
  if (IS_DEMO_MODE) {
    const { updated } = room.removeAudioSources(urlsToDelete);
    sendBroadcast({
      server,
      roomId: ws.data.roomId,
      message: {
        type: "ROOM_EVENT",
        event: { type: "SET_AUDIO_SOURCES", sources: updated },
      },
    });
    return;
  }

  // First, attempt to delete room-specific files from R2 storage
  // Track which URLs were successfully deleted from R2
  const successfullyDeletedUrls = new Set<string>();
  const roomPrefix = `/room-${ws.data.roomId}/`;

  const sourcesToDelete = room.getAudioSources().filter((source) => urlsToDelete.includes(source.url));
  const r2DeletionPromises = sourcesToDelete.map(async (source) => {
    const fileUrls = source.tracks?.map((track) => track.url) ?? [source.url];
    const results = await Promise.all(
      fileUrls.map(async (url) => {
        if (!url.includes(roomPrefix)) return true;
        try {
          const key = extractKeyFromUrl(url);
          if (!key) throw new Error(`Failed to extract key from URL: ${url}`);
          await deleteObject(key);
          console.log(`🗑️ Deleted R2 object: ${key}`);
          return true;
        } catch (error) {
          console.error(`Failed to delete R2 object for URL ${url}:`, error);
          return false;
        }
      })
    );
    if (results.every(Boolean)) successfullyDeletedUrls.add(source.url);
    else console.error(`Could not delete every file in audio source ${source.url}; keeping it in the queue`);
  });

  // Wait for all R2 deletion attempts to complete
  await Promise.all(r2DeletionPromises);

  // Only remove successfully deleted URLs from the room's queue
  const urlsToRemove = Array.from(successfullyDeletedUrls);

  if (urlsToRemove.length === 0) {
    console.log("No URLs were successfully deleted from R2, keeping all in queue");
    return;
  }

  // Remove only the successfully deleted sources from room state
  const { updated } = room.removeAudioSources(urlsToRemove);

  // Broadcast updated queue to all clients
  sendBroadcast({
    server,
    roomId: ws.data.roomId,
    message: {
      type: "ROOM_EVENT",
      event: { type: "SET_AUDIO_SOURCES", sources: updated },
    },
  });
};
