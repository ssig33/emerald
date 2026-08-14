import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ModelSelector from "../ModelSelector";
import { chromeMock } from "../../test/mocks/chrome";

describe("ModelSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chromeMock.storage.local.get).mockResolvedValue({});
    vi.mocked(chromeMock.storage.local.set).mockResolvedValue(undefined);
  });

  const openSelect = async (name: string) => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name }));
    return user;
  };

  it("shows the stored selection", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValue({
      settings: { model: "gpt-5.6-terra", reasoningEffort: "low" },
    });

    render(<ModelSelector />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent(
        "Terra",
      );
    });
    expect(
      screen.getByRole("combobox", { name: "Reasoning" }),
    ).toHaveTextContent("low");
  });

  it("offers Sol, Terra and Luna", async () => {
    render(<ModelSelector />);
    await waitFor(() =>
      expect(chromeMock.storage.local.get).toHaveBeenCalled(),
    );

    await openSelect("Model");

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Sol", "Terra", "Luna"]);
  });

  it("persists a model change", async () => {
    render(<ModelSelector />);
    await waitFor(() =>
      expect(chromeMock.storage.local.get).toHaveBeenCalled(),
    );

    const user = await openSelect("Model");
    await user.click(screen.getByRole("option", { name: "Sol" }));

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({ model: "gpt-5.6-sol" }),
      });
    });
  });

  it("persists a reasoning effort change", async () => {
    render(<ModelSelector />);
    await waitFor(() =>
      expect(chromeMock.storage.local.get).toHaveBeenCalled(),
    );

    const user = await openSelect("Reasoning");
    await user.click(screen.getByRole("option", { name: "medium" }));

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({ reasoningEffort: "medium" }),
      });
    });
  });
});
