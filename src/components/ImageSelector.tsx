import React, { useState } from "react";
import { IconButton, Tooltip, CircularProgress } from "@mui/material";
import { PhotoCamera } from "@mui/icons-material";
import { useScreenCapture } from "../hooks/useScreenCapture";
import { ImageData } from "../types";

interface ImageSelectorProps {
  onImageCapture?: (image: ImageData) => void;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({ onImageCapture }) => {
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
      console.error("Image capture failed:", err);
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
