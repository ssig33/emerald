console.log("Emerald background script loaded");

const SIDEPANEL_PATH = "src/sidepanel/index.html";
const EMERALD_GROUPS_KEY = "emerald/groups";
const TAB_GROUP_ID_NONE = -1;

async function getEmeraldGroups(): Promise<number[]> {
  const result = await chrome.storage.session.get(EMERALD_GROUPS_KEY);
  return (result[EMERALD_GROUPS_KEY] as number[] | undefined) || [];
}

async function isEmeraldGroup(groupId: number): Promise<boolean> {
  if (groupId === TAB_GROUP_ID_NONE) return false;
  const groups = await getEmeraldGroups();
  return groups.includes(groupId);
}

async function addEmeraldGroup(groupId: number): Promise<void> {
  const groups = await getEmeraldGroups();
  if (!groups.includes(groupId)) {
    await chrome.storage.session.set({
      [EMERALD_GROUPS_KEY]: [...groups, groupId],
    });
  }
}

async function removeEmeraldGroup(groupId: number): Promise<void> {
  const groups = await getEmeraldGroups();
  await chrome.storage.session.set({
    [EMERALD_GROUPS_KEY]: groups.filter((id) => id !== groupId),
  });
}

// Enable the side panel for every tab currently in the given group.
async function enablePanelForGroup(groupId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ groupId });
  await Promise.all(
    tabs.map((tab) =>
      tab.id !== undefined
        ? chrome.sidePanel.setOptions({
            tabId: tab.id,
            enabled: true,
            path: SIDEPANEL_PATH,
          })
        : Promise.resolve(),
    ),
  );
}

// Side panel logic is Chrome-only. Firefox uses sidebar_action natively.
if (chrome.sidePanel) {
  // Hide the side panel globally by default; only Emerald-group tabs enable it.
  const disableGlobally = () => {
    chrome.sidePanel.setOptions({ enabled: false }).catch((error) => {
      console.error("Failed to disable side panel globally:", error);
    });
  };
  chrome.runtime.onInstalled.addListener(disableGlobally);
  chrome.runtime.onStartup.addListener(disableGlobally);
  disableGlobally();

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) return;

    let groupId = tab.groupId ?? TAB_GROUP_ID_NONE;
    if (!(await isEmeraldGroup(groupId))) {
      groupId = await chrome.tabs.group({ tabIds: [tab.id] });
      await chrome.tabGroups.update(groupId, {
        title: "Emerald",
        color: "green",
      });
      await addEmeraldGroup(groupId);
    }

    await enablePanelForGroup(groupId);
    await chrome.sidePanel.open({ tabId: tab.id });
  });

  // Keep panel visibility in sync as tabs are activated or groups change.
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId);
    if (await isEmeraldGroup(tab.groupId ?? TAB_GROUP_ID_NONE)) {
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: true,
        path: SIDEPANEL_PATH,
      });
    }
  });

  chrome.tabGroups.onUpdated.addListener(async (group) => {
    if (await isEmeraldGroup(group.id)) {
      await enablePanelForGroup(group.id);
    }
  });

  // Discard the conversation when an Emerald group is dissolved.
  chrome.tabGroups.onRemoved.addListener(async (group) => {
    if (await isEmeraldGroup(group.id)) {
      await removeEmeraldGroup(group.id);
      await chrome.storage.session.remove(`group_${group.id}`);
    }
  });
}

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

    default:
      sendResponse({ error: "Unknown action" });
  }

  return false;
});
