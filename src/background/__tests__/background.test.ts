import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { chromeMock } from "../../test/mocks/chrome";

type Listener = (...args: any[]) => any;

/**
 * The listeners the background script registers, so tests can fire browser
 * events at it.
 */
interface Listeners {
  actionClicked: Listener;
  tabActivated: Listener;
  groupRemoved: Listener;
  message: Listener;
}

const SIDEPANEL_PATH = "src/sidepanel/index.html";

let listeners: Listeners;
let tabsById: Record<number, { id: number; groupId: number }>;
let nextGroupId: number;
let fakeChrome: any;

function capture(name: keyof Listeners) {
  return {
    addListener: vi.fn((listener: Listener) => {
      listeners[name] = listener;
    }),
  };
}

async function loadBackground() {
  vi.resetModules();
  await import("../background");
}

/** Resolve once every pending listener promise chain has settled. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  await chromeMock.storage.session.clear();
  listeners = {} as Listeners;
  tabsById = {};
  nextGroupId = 100;
  fakeChrome = {
    ...chromeMock,
    runtime: { onMessage: capture("message"), lastError: null },
    action: { onClicked: capture("actionClicked") },
    sidePanel: {
      open: vi.fn().mockResolvedValue(undefined),
      setOptions: vi.fn().mockResolvedValue(undefined),
    },
    tabs: {
      ...chromeMock.tabs,
      onActivated: capture("tabActivated"),
      get: vi.fn(async (tabId: number) => tabsById[tabId]),
      query: vi.fn().mockResolvedValue([]),
      group: vi.fn(async ({ tabIds }: { tabIds: number[] }) => {
        const groupId = nextGroupId++;
        tabIds.forEach((id) => (tabsById[id] = { id, groupId }));
        return groupId;
      }),
      captureVisibleTab: vi.fn(),
      sendMessage: vi.fn(),
    },
    tabGroups: {
      update: vi.fn().mockResolvedValue({}),
      onUpdated: { addListener: vi.fn() },
      onRemoved: capture("groupRemoved"),
    },
  };
  vi.stubGlobal("chrome", fakeChrome);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await loadBackground();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function click(tab: { id: number; groupId: number }) {
  tabsById[tab.id] = tab;
  listeners.actionClicked({ ...tab, windowId: 1 });
  return flush();
}

describe("toolbar button", () => {
  it("opens the panel and puts an ungrouped tab into an Emerald group", async () => {
    await click({ id: 1, groupId: -1 });

    expect(fakeChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 1 });
    expect(fakeChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1] });
    expect(fakeChrome.tabGroups.update).toHaveBeenCalledWith(100, {
      title: "Emerald",
      color: "green",
    });
  });

  it("reuses the Emerald group the tab is already in", async () => {
    await click({ id: 1, groupId: -1 });
    await click({ id: 1, groupId: 100 });

    expect(fakeChrome.tabs.group).toHaveBeenCalledTimes(1);
  });

  it("makes a new Emerald group for a tab in some other group", async () => {
    await click({ id: 1, groupId: 7 });

    expect(fakeChrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1] });
  });

  it("falls back to opening the panel for the window", async () => {
    fakeChrome.sidePanel.open
      .mockRejectedValueOnce(new Error("no gesture"))
      .mockResolvedValueOnce(undefined);

    await click({ id: 1, groupId: -1 });

    expect(fakeChrome.sidePanel.open).toHaveBeenLastCalledWith({
      windowId: 1,
    });
  });
});

describe("switching tabs", () => {
  async function activate(tabId: number) {
    await listeners.tabActivated({ tabId });
    return fakeChrome.sidePanel.setOptions.mock.lastCall[0];
  }

  it("shows the panel on a tab in an Emerald group", async () => {
    await click({ id: 1, groupId: -1 });

    expect(await activate(1)).toEqual({
      tabId: 1,
      enabled: true,
      path: SIDEPANEL_PATH,
    });
  });

  it("hides the panel on a tab outside Emerald groups", async () => {
    await click({ id: 1, groupId: -1 });
    tabsById[2] = { id: 2, groupId: 7 };

    expect(await activate(2)).toMatchObject({ tabId: 2, enabled: false });
  });
});

describe("closing a group", () => {
  it("discards the conversation of an Emerald group", async () => {
    await click({ id: 1, groupId: -1 });
    await chromeMock.storage.session.set({ group_100: { messages: [] } });

    await listeners.groupRemoved({ id: 100 });

    const stored = await chromeMock.storage.session.get("group_100");
    expect(stored.group_100).toBeUndefined();
  });

  it("forgets the group so a reused ID is not treated as Emerald", async () => {
    await click({ id: 1, groupId: -1 });
    await listeners.groupRemoved({ id: 100 });
    tabsById[2] = { id: 2, groupId: 100 };

    await listeners.tabActivated({ tabId: 2 });

    expect(fakeChrome.sidePanel.setOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ tabId: 2, enabled: false }),
    );
  });

  it("leaves the storage of other groups alone", async () => {
    await chromeMock.storage.session.set({ group_7: { messages: [] } });

    await listeners.groupRemoved({ id: 7 });

    const stored = await chromeMock.storage.session.get("group_7");
    expect(stored.group_7).toEqual({ messages: [] });
  });
});

describe("captureAndCrop message", () => {
  const selection = { x: 1, y: 2, width: 30, height: 40 };
  const sender = { tab: { id: 5, windowId: 9 } };

  beforeEach(() => {
    fakeChrome.tabs.captureVisibleTab.mockImplementation(
      (_windowId: number, _options: unknown, callback: Listener) =>
        callback("data:image/png;base64,AAAA"),
    );
  });

  /** Make the content script answer only after `failures` failed attempts. */
  function contentScriptAvailableAfter(failures: number) {
    let attempts = 0;
    fakeChrome.tabs.sendMessage.mockImplementation(
      (_tabId: number, _message: unknown, callback: Listener) => {
        attempts++;
        if (attempts <= failures) {
          fakeChrome.runtime.lastError = { message: "No receiver" };
          callback(undefined);
          fakeChrome.runtime.lastError = null;
        } else {
          callback({ dataUrl: "data:image/jpeg;base64,BBBB" });
        }
      },
    );
  }

  function send(message: object) {
    const sendResponse = vi.fn();
    const keepsChannelOpen = listeners.message(message, sender, sendResponse);
    return { sendResponse, keepsChannelOpen };
  }

  it("hands the screenshot to the tab's content script for cropping", () => {
    contentScriptAvailableAfter(0);

    const { sendResponse, keepsChannelOpen } = send({
      action: "captureAndCrop",
      selection,
    });

    expect(keepsChannelOpen).toBe(true);
    expect(fakeChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(
      9,
      { format: "png" },
      expect.any(Function),
    );
    expect(fakeChrome.tabs.sendMessage).toHaveBeenCalledWith(
      5,
      {
        action: "processImage",
        dataUrl: "data:image/png;base64,AAAA",
        selection,
      },
      expect.any(Function),
    );
    expect(sendResponse).toHaveBeenCalledWith({
      dataUrl: "data:image/jpeg;base64,BBBB",
    });
  });

  it("retries while the content script is not ready", () => {
    vi.useFakeTimers();
    try {
      contentScriptAvailableAfter(3);

      const { sendResponse } = send({ action: "captureAndCrop", selection });
      vi.runAllTimers();

      expect(fakeChrome.tabs.sendMessage).toHaveBeenCalledTimes(4);
      expect(sendResponse).toHaveBeenCalledWith({
        dataUrl: "data:image/jpeg;base64,BBBB",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up after three retries", () => {
    vi.useFakeTimers();
    try {
      contentScriptAvailableAfter(4);

      const { sendResponse } = send({ action: "captureAndCrop", selection });
      vi.runAllTimers();

      expect(fakeChrome.tabs.sendMessage).toHaveBeenCalledTimes(4);
      expect(sendResponse).toHaveBeenCalledWith({
        error: "Content script not available",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a failed screenshot", () => {
    fakeChrome.tabs.captureVisibleTab.mockImplementation(
      (_windowId: number, _options: unknown, callback: Listener) => {
        fakeChrome.runtime.lastError = { message: "Cannot capture" };
        callback(undefined);
        fakeChrome.runtime.lastError = null;
      },
    );

    const { sendResponse } = send({ action: "captureAndCrop", selection });

    expect(sendResponse).toHaveBeenCalledWith({ error: "Cannot capture" });
    expect(fakeChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
});

it("answers an unknown message with an error", () => {
  const sendResponse = vi.fn();
  listeners.message({ action: "nope" }, {}, sendResponse);

  expect(sendResponse).toHaveBeenCalledWith({ error: "Unknown action" });
});
