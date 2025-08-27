import browser from "webextension-polyfill";

console.log("Robotaro background script loaded");

browser.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed:", details);
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  switch (message.action) {
    case "captureScreen":
      if (sender.tab?.id) {
        chrome.tabs.captureVisibleTab(
          sender.tab.windowId,
          { format: "png" },
          (dataUrl) => {
            sendResponse({ dataUrl });
          },
        );
        return true;
      }
      break;

    case "captureAndCrop":
      if (sender.tab?.id && message.selection) {
        chrome.tabs.captureVisibleTab(
          sender.tab.windowId,
          { format: "png" },
          async (dataUrl) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
              return;
            }

            try {
              // Process image using offscreen document
              const { x, y, width, height } = message.selection;

              // Delegate image processing to content script (with retry functionality)
              const sendToContentScript = (retryCount = 0) => {
                chrome.tabs.sendMessage(
                  sender.tab!.id!,
                  {
                    action: "processImage",
                    dataUrl,
                    selection: { x, y, width, height },
                  },
                  (response: any) => {
                    if (chrome.runtime.lastError) {
                      if (retryCount < 3) {
                        // Wait 100ms and retry
                        setTimeout(
                          () => sendToContentScript(retryCount + 1),
                          100,
                        );
                      } else {
                        sendResponse({ error: "Content script not available" });
                      }
                    } else {
                      sendResponse(response);
                    }
                  },
                );
              };

              sendToContentScript();
            } catch (error) {
              sendResponse({
                error:
                  error instanceof Error
                    ? error.message
                    : "Image processing failed",
              });
            }
          },
        );
        return true;
      }
      break;

    case "getPageText":
      console.log("Background handling getPageText");
      console.log("Sender tab:", sender.tab);
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(
          sender.tab.id,
          { action: "extractText" },
          (response) => {
            sendResponse(response);
          },
        );
        return true;
      }
      break;

    default:
      sendResponse({ error: "Unknown action" });
  }

  return false;
});
