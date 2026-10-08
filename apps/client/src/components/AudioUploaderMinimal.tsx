"use client";

import { uploadAudioFile, uploadMultiTrack } from "@/lib/api";
import { cn, trimFileName } from "@/lib/utils";
import { useCanMutate } from "@/store/global";
import { useRoomStore } from "@/store/room";
import { CloudUpload, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const AudioUploaderMinimal = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const canMutate = useCanMutate();
  const roomId = useRoomStore((state) => state.roomId);

  const isDisabled = !canMutate;

  const handleFileUpload = async (files: File[]) => {
    if (isDisabled) return;

    const isMultiTrack = files.length > 1;
    setFileName(isMultiTrack ? `${files.length} tracks` : files[0].name);

    try {
      setIsUploading(true);

      if (isMultiTrack) {
        await uploadMultiTrack({ files, roomId });
      } else {
        await uploadAudioFile({ file: files[0], roomId });
      }

      setTimeout(() => setFileName(null), 3000);
    } catch (err) {
      console.error("Error during upload:", err);
      toast.error(isMultiTrack ? "Failed to upload multitrack" : "Failed to upload audio file");
      setFileName(null);
    } finally {
      setIsUploading(false);
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.some((file) => !isAudioFile(file))) {
      toast.error("Please select audio files only");
      return;
    }
    handleFileUpload(files);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const onDropEvent = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;
    if (files.some((file) => !isAudioFile(file))) {
      toast.error("Please select audio files only");
      return;
    }

    handleFileUpload(files);
  };

  const isAudioFile = (file: File) =>
    file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i.test(file.name);

  return (
    <div
      className={cn(
        "border border-neutral-700/50 rounded-md mx-2 transition-all overflow-hidden",
        isDisabled ? "bg-neutral-800/20 opacity-50" : "bg-neutral-800/30 hover:bg-neutral-800/50",
        isDragging && !isDisabled ? "outline outline-primary-400 outline-dashed" : "outline-none"
      )}
      id="drop_zone"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnd={onDragLeave}
      onDrop={onDropEvent}
      title={isDisabled ? "Admin-only mode - only admins can upload" : undefined}
    >
      <label htmlFor="audio-upload" className={cn("block w-full", isDisabled ? "" : "cursor-pointer")}>
        <div className="p-3 flex items-center gap-3">
          <div
            className={cn(
              "p-1.5 rounded-md flex-shrink-0",
              isDisabled ? "bg-neutral-600 text-neutral-400" : "bg-primary-700 text-white"
            )}
          >
            {isUploading ? <CloudUpload className="h-4 w-4 animate-pulse" /> : <Plus className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">
              {isUploading ? "Uploading..." : fileName ? trimFileName(fileName) : "Upload audio or multitrack"}
            </div>
            {!isUploading && !fileName && (
              <div className={cn("text-xs truncate", isDisabled ? "text-neutral-500" : "text-neutral-400")}>
                {isDisabled ? "Must be an admin to upload" : "Add one file or select multiple tracks"}
              </div>
            )}
          </div>
        </div>
      </label>

      <input
        id="audio-upload"
        type="file"
        multiple
        accept="audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/ogg,audio/webm,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
        onChange={onInputChange}
        disabled={isUploading || isDisabled}
        className="hidden"
      />
    </div>
  );
};
