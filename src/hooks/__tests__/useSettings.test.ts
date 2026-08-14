import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettings } from "../useSettings";
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

    expect(result.current.settings.openaiApiKey).toBe("");
    expect(result.current.settings.systemPrompt).toContain("Emerald");
    expect(result.current.settings.s3Region).toBe("us-east-1");
    expect(result.current.settings.model).toBe("gpt-5.6-luna");
    expect(result.current.settings.reasoningEffort).toBe("max");
    expect(result.current.settings.modelSelectorOpen).toBe(false);
  });

  it("restores the stored model and reasoning effort", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { model: "gpt-5.6-sol", reasoningEffort: "medium" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.model).toBe("gpt-5.6-sol");
    expect(result.current.settings.reasoningEffort).toBe("medium");
  });

  it("falls back to the defaults for unknown stored values", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { model: "gpt-4o", reasoningEffort: "ludicrous" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.model).toBe("gpt-5.6-luna");
    expect(result.current.settings.reasoningEffort).toBe("max");
  });

  it("persists the model and the reasoning effort", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.updateModel("gpt-5.6-terra");
    });
    await act(async () => {
      await result.current.updateReasoningEffort("high");
    });

    expect(result.current.settings.model).toBe("gpt-5.6-terra");
    expect(result.current.settings.reasoningEffort).toBe("high");
    expect(chromeMock.storage.local.set).toHaveBeenLastCalledWith({
      settings: expect.objectContaining({
        model: "gpt-5.6-terra",
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
        settings: { newValue: { model: "gpt-5.6-sol" } },
      });
    });

    expect(result.current.settings.model).toBe("gpt-5.6-sol");
    expect(result.current.settings.s3Region).toBe("us-east-1");
  });

  it("ignores changes from other storage areas", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    act(() => {
      emitStorageChange(
        { settings: { newValue: { model: "gpt-5.6-sol" } } },
        "session",
      );
    });

    expect(result.current.settings.model).toBe("gpt-5.6-luna");
  });

  it("merges stored settings over the defaults", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValueOnce({
      settings: { openaiApiKey: "sk-stored", s3Bucket: "my-bucket" },
    });

    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    expect(result.current.settings.openaiApiKey).toBe("sk-stored");
    expect(result.current.settings.s3Bucket).toBe("my-bucket");
    expect(result.current.settings.s3Region).toBe("us-east-1");
  });

  it("persists updated settings to storage", async () => {
    const { result } = renderHook(() => useSettings());
    await waitLoaded(result);

    await act(async () => {
      await result.current.updateApiKey("sk-new");
    });

    expect(result.current.settings.openaiApiKey).toBe("sk-new");
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      settings: expect.objectContaining({ openaiApiKey: "sk-new" }),
    });
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
