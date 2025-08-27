import { useState, useCallback } from "react";
import { CapturedImage } from "../types";

export const useScreenCapture = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(
    null,
  );

  const captureScreen = useCallback(async (): Promise<string> => {
    setIsCapturing(true);

    try {
      // Get active tab
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]?.id) {
        throw new Error("No active tab found");
      }

      // Request content script to start rectangular selection
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "startImageCapture",
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const capturedData = {
        dataUrl: response.dataUrl,
        timestamp: Date.now(),
      };

      setCapturedImage(capturedData);
      return response.dataUrl;
    } catch (error) {
      console.error("Screen capture failed:", error);
      throw error;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const clearCapture = useCallback(() => {
    setCapturedImage(null);
  }, []);

  return {
    captureScreen,
    isCapturing,
    capturedImage,
    clearCapture,
  };
};
