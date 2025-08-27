import { extractTextFromPage } from "../utils/textExtractor";
import { startRectangleSelection } from "./capture";

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("Content script received message:", request);

  switch (request.action) {
    case "getPageInfo":
      sendResponse({
        url: window.location.href,
        title: document.title,
      });
      break;

    case "extractText":
      try {
        const text = extractTextFromPage();
        console.log("Extracted text:", text);
        sendResponse({ text });
      } catch (error) {
        console.error("Text extraction error:", error);
        sendResponse({
          error:
            error instanceof Error ? error.message : "Text extraction failed",
        });
      }
      break;

    case "startCapture":
      console.log("Screen capture requested");
      sendResponse({ success: true });
      break;

    case "startImageCapture":
      (async () => {
        try {
          const selection = await startRectangleSelection();

          // Send message to background script synchronously
          const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                action: "captureAndCrop",
                selection,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(response);
                }
              },
            );
          });

          sendResponse(response);
        } catch (error) {
          sendResponse({
            error:
              error instanceof Error ? error.message : "Image capture failed",
          });
        }
      })();
      return true;

    case "processImage":
      (async () => {
        try {
          const { dataUrl, selection } = request;
          const { x, y, width, height } = selection;

          // Crop image using Canvas API
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                sendResponse({ error: "Canvas context not available" });
                return;
              }

              canvas.width = width;
              canvas.height = height;

              // Consider device pixel ratio
              const dpr = window.devicePixelRatio || 1;
              ctx.drawImage(
                img,
                x * dpr,
                y * dpr,
                width * dpr,
                height * dpr,
                0,
                0,
                width,
                height,
              );

              // Output in JPG format (80% quality)
              const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
              sendResponse({ dataUrl: croppedDataUrl });
            } catch (error) {
              sendResponse({
                error:
                  error instanceof Error
                    ? error.message
                    : "Image processing failed",
              });
            }
          };

          img.onerror = () => {
            sendResponse({ error: "Failed to load captured image" });
          };

          img.src = dataUrl;
        } catch (error) {
          sendResponse({
            error:
              error instanceof Error
                ? error.message
                : "Image processing failed",
          });
        }
      })();
      return true;

    default:
      sendResponse({ error: "Unknown action" });
  }

  return true;
});

console.log("Robotaro content script loaded");
