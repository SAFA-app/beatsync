import { extractFileNameFromUrl } from "@/lib/utils";
import { useGlobalStore } from "@/store/global";
import { useEffect } from "react";

export const useDocumentTitle = () => {
  const isPlaying = useGlobalStore((state) => state.isPlaying);
  const selectedAudioUrl = useGlobalStore((state) => state.selectedAudioUrl);
  const selectedTrackBySource = useGlobalStore((state) => state.selectedTrackBySource);
  const getSelectedTrack = useGlobalStore((state) => state.getSelectedTrack);

  useEffect(() => {
    const track = getSelectedTrack();
    if (isPlaying && track) {
      const selectedTrack = track.source.tracks?.find(
        (item) => item.url === selectedTrackBySource[track.source.url]
      );
      document.title =
        selectedTrack?.name || track.source.name || extractFileNameFromUrl(track.source.url);
    } else {
      document.title = "Beatsync";
    }
  }, [isPlaying, selectedAudioUrl, selectedTrackBySource, getSelectedTrack]);
};
