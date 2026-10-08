import { readFileSync, readdirSync } from "fs";
import { basename, join, resolve } from "path";
import type { AudioSourceType, AudioTrackType } from "@beatsync/shared";

// ── Flag & Config ──────────────────────────────────────────────
export const IS_DEMO_MODE = process.env.DEMO === "1";
export const DEMO_ROOM_ID = "000000";

const AUDIO_DIR = resolve(process.env.DEMO_AUDIO_DIR ?? "./demo-audio");
export const ADMIN_SECRET = process.env.DEMO_ADMIN_SECRET ?? "beatsync";
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".webm"]);

// ── Audio files and multitrack groups (scanned once at startup) ─
const audioFilePaths: string[] = IS_DEMO_MODE
  ? (() => {
      try {
        const paths: string[] = [];
        for (const entry of readdirSync(AUDIO_DIR, { withFileTypes: true })) {
          if (entry.isFile()) {
            paths.push(entry.name);
          } else if (entry.isDirectory()) {
            for (const child of readdirSync(join(AUDIO_DIR, entry.name), { withFileTypes: true })) {
              if (child.isFile()) paths.push(`${entry.name}/${child.name}`);
            }
          }
        }
        return paths.filter((filePath) => AUDIO_EXTENSIONS.has(filePath.slice(filePath.lastIndexOf(".")).toLowerCase()));
      } catch {
        console.error(`DEMO mode: failed to read audio directory: ${AUDIO_DIR}`);
        console.error(`Create the directory or set DEMO_AUDIO_DIR to an existing path.`);
        process.exit(1);
      }
    })()
  : [];

export const AUDIO_DIR_PATH = AUDIO_DIR;
export const AUDIO_FILENAMES = audioFilePaths;
const toDemoAudioUrl = (filePath: string) =>
  `/audio/${filePath.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;

const filesByDirectory = new Map<string, string[]>();
for (const filePath of audioFilePaths) {
  const directory = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";
  const directoryFiles = filesByDirectory.get(directory) ?? [];
  directoryFiles.push(filePath);
  filesByDirectory.set(directory, directoryFiles);
}

export const DEMO_AUDIO_SOURCES: AudioSourceType[] = [];
for (const [directory, files] of filesByDirectory) {
  if (directory && files.length > 1) {
    const tracks: AudioTrackType[] = files.map((filePath) => ({
      name: basename(filePath).replace(/\.[^/.]+$/, ""),
      url: toDemoAudioUrl(filePath),
    }));
    DEMO_AUDIO_SOURCES.push({
      name: basename(directory),
      url: tracks[0].url,
      tracks,
    });
  } else {
    for (const filePath of files) {
      DEMO_AUDIO_SOURCES.push({ url: toDemoAudioUrl(filePath) });
    }
  }
}

// ── In-memory audio cache (loaded once at startup) ─────────────
interface CachedAudioFile {
  bytes: Buffer;
  type: string;
}

export const AUDIO_FILE_CACHE = new Map<string, CachedAudioFile>();

if (IS_DEMO_MODE) {
  console.log(`🎤 Demo mode enabled — serving ${AUDIO_FILENAMES.length} files from ${AUDIO_DIR}`);
  let totalBytes = 0;
  for (const filename of audioFilePaths) {
    const filePath = resolve(AUDIO_DIR, filename);
    const bytes = readFileSync(filePath);
    const type = Bun.file(filePath).type;
    AUDIO_FILE_CACHE.set(filename, { bytes, type });
    totalBytes += bytes.byteLength;
    console.log(`   📁 ${filename} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB)`);
  }
  console.log(`   💾 Total cached: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
}

// ── Admin secret auth ──────────────────────────────────────────
export function isValidAdminSecret(secret: string | null): boolean {
  return ADMIN_SECRET !== "" && secret === ADMIN_SECRET;
}
