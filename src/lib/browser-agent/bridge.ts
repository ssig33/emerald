/**
 * Side-panel half of the browser agent: locates the tab under control and
 * relays commands to the content script running inside it.
 */
import {
  BROWSER_AGENT_ACTION,
  BrowserAgentCommand,
  BrowserAgentResponse,
} from "./types";

const LOAD_POLL_INTERVAL_MS = 150;
const LOAD_TIMEOUT_MS = 15000;
/** Time given to a click before the resulting navigation is looked at. */
const NAVIGATION_SETTLE_MS = 400;
/** chrome.windows.WINDOW_ID_CURRENT, without depending on the windows API. */
const WINDOW_ID_CURRENT = -2;

export interface TabState {
  id: number;
  windowId: number;
  url: string;
  title: string;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function getActiveTab(): Promise<TabState> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return tabState(tab.id, tab);
}

/** Resolves once the tab finished loading, or when the timeout elapses. */
export async function waitForTabLoad(tabId: number): Promise<TabState> {
  const deadline = Date.now() + LOAD_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") {
      return tabState(tabId, tab);
    }
    await delay(LOAD_POLL_INTERVAL_MS);
  }

  return tabState(tabId, await chrome.tabs.get(tabId));
}

function tabState(tabId: number, tab: chrome.tabs.Tab): TabState {
  return {
    id: tabId,
    windowId: tab.windowId ?? WINDOW_ID_CURRENT,
    url: tab.url ?? "",
    title: tab.title ?? "",
  };
}

/**
 * A click can tear the page down before the content script answers. That is a
 * successful navigation rather than a failure, so the disconnect is reported
 * as such instead of surfacing a raw messaging error.
 */
function isDisconnectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Receiving end does not exist") ||
    message.includes("message port closed") ||
    message.includes("message channel closed")
  );
}

export class ContentScriptUnavailableError extends Error {
  constructor() {
    super(
      "The page cannot be driven: no content script is running in the active tab. " +
        "Browser-internal pages (chrome://, about:, the extension gallery) are off limits; " +
        "for a normal page, reload it and try again.",
    );
    this.name = "ContentScriptUnavailableError";
  }
}

/** Sends one command and unwraps the content script's answer. */
export async function sendBrowserCommand(
  tabId: number,
  command: BrowserAgentCommand,
): Promise<string> {
  let response: BrowserAgentResponse | undefined;

  try {
    response = (await chrome.tabs.sendMessage(tabId, {
      action: BROWSER_AGENT_ACTION,
      command,
    })) as BrowserAgentResponse | undefined;
  } catch (error) {
    if (isDisconnectError(error)) {
      throw new ContentScriptUnavailableError();
    }
    throw error;
  }

  if (!response) {
    throw new ContentScriptUnavailableError();
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.result;
}

/**
 * Runs a command that may navigate away. The content script is told to answer
 * before the navigation starts; if it disappears first, the tab state is read
 * back from the tabs API instead.
 */
export async function sendNavigatingCommand(
  tabId: number,
  command: BrowserAgentCommand,
): Promise<string> {
  const before = await getActiveTab();
  let result: string;

  try {
    result = await sendBrowserCommand(tabId, command);
  } catch (error) {
    if (!(error instanceof ContentScriptUnavailableError)) throw error;
    result = "Command triggered an immediate navigation.";
  }

  await delay(NAVIGATION_SETTLE_MS);
  const after = await waitForTabLoad(tabId);

  if (after.url !== before.url) {
    return `${result}\nNavigated to ${after.url} (${after.title}).`;
  }

  return `${result}\nStill on ${after.url}.`;
}

export async function navigateTab(
  tabId: number,
  url: string,
): Promise<TabState> {
  await chrome.tabs.update(tabId, { url });
  await delay(NAVIGATION_SETTLE_MS);
  return waitForTabLoad(tabId);
}
