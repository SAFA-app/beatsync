import {
  DiscoverRoomsType,
  GetActiveRoomsType,
  GetDefaultAudioType,
  GetUploadUrlType,
  UploadCompleteResponseType,
  UploadCompleteType,
  UploadUrlResponseType,
} from "@beatsync/shared";
import axios from "axios";
import { getApiUrl } from "./urls";

const baseAxios = axios.create({
  get baseURL() {
    return getApiUrl();
  },
});

export const uploadAudioFile = async (data: { file: File; roomId: string }) => {
  try {
    const uploadedFile = await uploadFileToStorage(data.file, data.roomId);

    // Step 3: Notify server that upload completed successfully
    const uploadCompleteRequest: UploadCompleteType = {
      roomId: data.roomId,
      originalName: data.file.name,
      publicUrl: uploadedFile.publicUrl,
    };

    await baseAxios.post<UploadCompleteResponseType>("/upload/complete", uploadCompleteRequest);

    return {
      success: true,
      publicUrl: uploadedFile.publicUrl,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Failed to upload audio file");
    }
    throw error;
  }
};

export const uploadMultiTrack = async (data: { files: File[]; roomId: string }) => {
  try {
    if (data.files.length < 2) {
      throw new Error("A multitrack upload needs at least two audio files");
    }

    const uploadedFiles = await Promise.all(
      data.files.map((file) => uploadFileToStorage(file, data.roomId, `${crypto.randomUUID()}-${file.name}`))
    );
    const firstFileName = data.files[0].name;
    const originalName = firstFileName.replace(/\.[^/.]+$/, "");

    await baseAxios.post<UploadCompleteResponseType>("/upload/complete", {
      roomId: data.roomId,
      originalName,
      publicUrl: uploadedFiles[0].publicUrl,
      tracks: uploadedFiles.map(({ file, publicUrl }) => ({
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: publicUrl,
      })),
    } satisfies UploadCompleteType);

    return { success: true };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Failed to upload multitrack");
    }
    throw error;
  }
};

const uploadFileToStorage = async (file: File, roomId: string, storageFileName = file.name) => {
  const contentType =
    (file.type.startsWith("audio/") && file.type) ||
    ({
      ".aac": "audio/aac",
      ".flac": "audio/flac",
      ".m4a": "audio/mp4",
      ".mp3": "audio/mpeg",
      ".ogg": "audio/ogg",
      ".wav": "audio/wav",
      ".webm": "audio/webm",
    }[file.name.slice(file.name.lastIndexOf(".")).toLowerCase()] ??
      "audio/mpeg");
  const uploadUrlRequest: GetUploadUrlType = {
    roomId,
    fileName: storageFileName,
    contentType,
  };
  const { data } = await baseAxios.post<UploadUrlResponseType>("/upload/get-presigned-url", uploadUrlRequest);
  const uploadResponse = await fetch(data.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.statusText}`);
  }

  return { file, publicUrl: data.publicUrl };
};

export const fetchAudio = async (url: string) => {
  try {
    // Direct fetch from R2 public URL - zero server bandwidth
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    throw new Error(`Failed to fetch audio: ${error}`);
  }
};

export async function fetchDefaultAudioSources() {
  try {
    const response = await fetch(`${getApiUrl()}/default`);

    if (!response.ok) {
      console.error("Failed to fetch default audio sources:", response.status);
      return [];
    }

    const files: GetDefaultAudioType = await response.json();
    return files;
  } catch (error) {
    console.error("Error fetching default audio sources:", error);
    return [];
  }
}

export async function fetchActiveRooms() {
  const response = await fetch(`${getApiUrl()}/active-rooms`);
  const data: GetActiveRoomsType = await response.json();
  return data;
}

export async function fetchDiscoverRooms() {
  const response = await fetch(`${getApiUrl()}/discover`);
  const data: DiscoverRoomsType = await response.json();
  return data;
}
