import { vi } from "vitest";

interface StorageArea {
  get: (
    key?: string | string[] | Record<string, any>,
  ) => Promise<Record<string, any>>;
  set: (items: Record<string, any>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}

interface Tab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  currentWindow?: boolean;
  groupId?: number;
}

interface RuntimeMessage {
  type?: string;
  action?: string;
  [key: string]: any;
}

interface ChromeMock {
  storage: {
    local: StorageArea;
    session: StorageArea;
  };
  tabs: {
    query: (queryInfo: {
      active?: boolean;
      currentWindow?: boolean;
    }) => Promise<Tab[]>;
    captureVisibleTab: (
      windowId?: number,
      options?: any,
      callback?: (dataUrl: string) => void,
    ) => void;
    sendMessage: (
      tabId: number,
      message: any,
      callback?: (response: any) => void,
    ) => Promise<any>;
  };
  runtime: {
    onMessage: {
      addListener: (
        callback: (
          message: RuntimeMessage,
          sender: any,
          sendResponse: (response: any) => void,
        ) => boolean | void,
      ) => void;
    };
    sendMessage: (message: any) => Promise<any>;
    lastError: { message: string } | null;
  };
  action: {
    onClicked: {
      addListener: (callback: (tab: Tab) => void) => void;
    };
  };
  sidePanel: {
    open: (options: { tabId?: number }) => Promise<void>;
  };
}

const mockStorage: Record<string, any> = {};
const mockSessionStorage: Record<string, any> = {};

const createStorageArea = (store: Record<string, any>): StorageArea => ({
  get: vi.fn().mockImplementation(async (key) => {
    if (typeof key === "string") {
      return { [key]: store[key] };
    } else if (Array.isArray(key)) {
      const result: Record<string, any> = {};
      key.forEach((k) => {
        if (k in store) {
          result[k] = store[k];
        }
      });
      return result;
    } else if (key === undefined) {
      return { ...store };
    }
    return {};
  }),
  set: vi.fn().mockImplementation(async (items) => {
    Object.assign(store, items);
  }),
  remove: vi.fn().mockImplementation(async (keys) => {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    keysArray.forEach((key) => {
      delete store[key];
    });
  }),
  clear: vi.fn().mockImplementation(async () => {
    Object.keys(store).forEach((key) => {
      delete store[key];
    });
  }),
});

const mockTabs: Tab[] = [
  {
    id: 1,
    url: "https://example.com",
    title: "Example",
    active: true,
    currentWindow: true,
    groupId: -1,
  },
];

const mockRuntime = {
  onMessage: {
    addListener: vi.fn(),
  },
  sendMessage: vi.fn().mockResolvedValue({}),
  lastError: null,
};

const chromeMock: ChromeMock = {
  storage: {
    local: createStorageArea(mockStorage),
    session: createStorageArea(mockSessionStorage),
  },
  tabs: {
    query: vi.fn().mockResolvedValue(mockTabs),
    captureVisibleTab: vi
      .fn()
      .mockImplementation((windowId, options, callback) => {
        const dataUrl =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
        if (typeof options === "function") {
          options(dataUrl);
        } else if (callback) {
          callback(dataUrl);
        }
      }),
    sendMessage: vi.fn().mockResolvedValue({ text: "" }),
  },
  runtime: mockRuntime,
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
  },
};

(globalThis as any).chrome = chromeMock;

export { chromeMock };
export default chromeMock;
