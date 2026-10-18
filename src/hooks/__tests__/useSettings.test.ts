import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { activeApiKey, useSettings } from "../useSettings";
import { chromeMock, emitStorageChange } from "../../test/mocks/chrome";

describe("useSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chromeMock.storage.local.get).mockResolvedValue({});
    vi.mocked(chromeMock.storage.local.set).mockResolvedValue(undefined);
  });

  const waitLoaded = async (result: { current: { loading: boolean } }) => {
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  };

  it("falls back to the defaults when nothing is stored", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.apiKeys).toEqual([
      {
        id: "default",
        label: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
      },
    ]);
    expect(result.current.settings.activeApiKeyId).toBe("default");
    expect(result.current.settings.systemPrompt).toContain("Emerald");
    expect(result.current.settings.s3Region).toBe("us-east-1");
    expect(result.current.settings.model).toBe("gpt-6-luna");
    expect(result.current.settings.reasoningEffort).toBe("max");
    expect(result.current.settings.modelSelectorOpen).toBe(false);
  });

  it("restores the stored model and reasoning effort", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { model: "gpt-6.1-sol", reasoningEffort: "medium" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.model).toBe("gpt-6.1-sol");
    expect(result.current.settings.reasoningEffort).toBe("medium");
  });

  it("falls back to the defaults for unknown stored values", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { model: "gpt-6-unknown", reasoningEffort: "ludicrous" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.model).toBe("gpt-6-luna");
    expect(result.current.settings.reasoningEffort).toBe("max");
  });

  it("moves an effort the stored model rejects to its lightest effort", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { model: "gpt-6.1-sol", reasoningEffort: "none" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.model).toBe("gpt-6.1-sol");
    expect(result.current.settings.reasoningEffort).toBe("low");
  });

  it("adjusts the reasoning effort when the new model rejects it", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.updateReasoningEffort("none");
    });
    await act(async () => {
      await result.current.updateModel("gpt-6-astra");
    });

    expect(result.current.settings.model).toBe("gpt-6-astra");
    expect(result.current.settings.reasoningEffort).toBe("low");
    expect(chromeMock.storage.local.set).toHaveBeenLastCalledWith({
      settings: expect.objectContaining({
        model: "gpt-6-astra",
        reasoningEffort: "low",
      }),
    });
  });

  it("persists the model and the reasoning effort", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.updateModel("gpt-6-astra");
    });
    await act(async () => {
      await result.current.updateReasoningEffort("high");
    });

    expect(result.current.settings.model).toBe("gpt-6-astra");
    expect(result.current.settings.reasoningEffort).toBe("high");
    expect(chromeMock.storage.local.set).toHaveBeenLastCalledWith({
      settings: expect.objectContaining({
        model: "gpt-6-astra",
        reasoningEffort: "high",
      }),
    });
  });

  it("persists the model selector expanded state", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.updateModelSelectorOpen(true);
    });

    expect(result.current.settings.modelSelectorOpen).toBe(true);
    expect(chromeMock.storage.local.set).toHaveBeenLastCalledWith({
      settings: expect.objectContaining({ modelSelectorOpen: true }),
    });
  });

  it("restores the stored model selector expanded state", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { modelSelectorOpen: true },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.modelSelectorOpen).toBe(true);
  });

  it("picks up settings written elsewhere", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    act(() => {
      emitStorageChange({
        settings: { newValue: { model: "gpt-6.1-sol" } },
      });
    });

    expect(result.current.settings.model).toBe("gpt-6.1-sol");
    expect(result.current.settings.s3Region).toBe("us-east-1");
  });

  it("ignores changes from other storage areas", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    act(() => {
      emitStorageChange(
        { settings: { newValue: { model: "gpt-6.1-sol" } } },
        "session",
      );
    });

    expect(result.current.settings.model).toBe("gpt-6-luna");
  });

  it("merges stored settings over the defaults", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { s3Bucket: "my-bucket" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.s3Bucket).toBe("my-bucket");
    expect(result.current.settings.s3Region).toBe("us-east-1");
  });

  it("turns a single stored OpenAI key into the key list", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { openaiApiKey: "sk-stored" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.apiKeys).toEqual([
      {
        id: "default",
        label: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-stored",
      },
    ]);
    expect(activeApiKey(result.current.settings).apiKey).toBe("sk-stored");
    expect(result.current.settings).not.toHaveProperty("openaiApiKey");
  });

  const twoKeys = [
    {
      id: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-openai",
    },
    {
      id: "other",
      label: "Other",
      baseUrl: "https://example.com/v1",
      apiKey: "other-key",
    },
  ];

  it("restores the stored keys and the active one", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { apiKeys: twoKeys, activeApiKeyId: "other" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.apiKeys).toEqual(twoKeys);
    expect(activeApiKey(result.current.settings).baseUrl).toBe(
      "https://example.com/v1",
    );
  });

  it("falls back to the first key when the active one is gone", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { apiKeys: twoKeys, activeApiKeyId: "deleted" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.activeApiKeyId).toBe("openai");
  });

  it("switches and persists the active key", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { apiKeys: twoKeys, activeApiKeyId: "openai" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.selectApiKey("other");
    });

    expect(activeApiKey(result.current.settings).apiKey).toBe("other-key");
    expect(chromeMock.storage.local.set).toHaveBeenLastCalledWith({
      settings: expect.objectContaining({ activeApiKeyId: "other" }),
    });
  });

  it("ignores a switch to a key that does not exist", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.selectApiKey("missing");
    });

    expect(result.current.settings.activeApiKeyId).toBe("default");
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  it("updates the system prompt", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.updateSystemPrompt("Be terse.");
    });

    expect(result.current.settings.systemPrompt).toBe("Be terse.");
  });
});
