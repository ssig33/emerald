import React from "react";
import { IconButton, Tooltip, CircularProgress } from "@mui/material";
import { PhotoCamera } from "@mui/icons-material";
import { useScreenCapture } from "../hooks/useScreenCapture";
import { SELECTION_CANCELLED } from "../content/capture";
import { ImageData } from "../types";

interface ImageSelectorProps {
  onImageCapture?: (image: ImageData) => void;
  onError?: (message: string) => void;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  onImageCapture,
  onError,
}) => {
  const { captureScreen, isCapturing } = useScreenCapture();

  const handleImageCapture = async () => {
    try {
      const dataUrl = await captureScreen();

      const imageData: ImageData = {
        dataUrl,
        timestamp: Date.now(),
      };

      onImageCapture?.(imageData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Capture failed";
      if (message !== SELECTION_CANCELLED) {
        onError?.(message);
      }
    }
  };

  const isLoading = isCapturing;

  return (
    <Tooltip title={isLoading ? "Capturing..." : "Screen Capture"}>
      <span>
        <IconButton
          onClick={handleImageCapture}
          disabled={isLoading}
          size="small"
        >
          {isLoading ? (
            <CircularProgress size={20} data-testid="CircularProgress" />
          ) : (
            <PhotoCamera />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default ImageSelector;
