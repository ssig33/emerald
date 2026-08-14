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

  const toggleButton = () =>
    screen.getByRole("button", { name: /Luna|Sol|Terra/ });

  /** Render, wait for the stored settings, then expand the pickers. */
  const renderExpanded = async () => {
    render(<ModelSelector />);
    await waitFor(() =>
      expect(chromeMock.storage.local.get).toHaveBeenCalled(),
    );

    const user = userEvent.setup();
    await user.click(toggleButton());
    await screen.findByRole("combobox", { name: "Model" });
    return user;
  };

  const openSelect = async (
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) => {
    await user.click(screen.getByRole("combobox", { name }));
  };

  it("keeps the pickers collapsed by default", async () => {
    render(<ModelSelector />);
    await waitFor(() =>
      expect(chromeMock.storage.local.get).toHaveBeenCalled(),
    );

    expect(screen.queryByRole("combobox", { name: "Model" })).toBeNull();
    expect(toggleButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("summarises the current selection on the toggle", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValue({
      settings: { model: "gpt-5.6-terra", reasoningEffort: "low" },
    });

    render(<ModelSelector />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Terra/ })).toHaveTextContent(
        "Terra · low",
      );
    });
  });

  it("restores the stored expanded state", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValue({
      settings: { modelSelectorOpen: true },
    });

    render(<ModelSelector />);

    expect(
      await screen.findByRole("combobox", { name: "Model" }),
    ).toBeInTheDocument();
  });

  it("persists the expanded state on toggle", async () => {
    await renderExpanded();

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({ modelSelectorOpen: true }),
      });
    });
  });

  it("collapses again after a second click", async () => {
    const user = await renderExpanded();

    await user.click(toggleButton());

    await waitFor(() =>
      expect(screen.queryByRole("combobox", { name: "Model" })).toBeNull(),
    );
    expect(chromeMock.storage.local.set).toHaveBeenLastCalledWith({
      settings: expect.objectContaining({ modelSelectorOpen: false }),
    });
  });

  it("shows the stored selection", async () => {
    vi.mocked(chromeMock.storage.local.get).mockResolvedValue({
      settings: {
        model: "gpt-5.6-terra",
        reasoningEffort: "low",
        modelSelectorOpen: true,
      },
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
    const user = await renderExpanded();

    await openSelect(user, "Model");

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Sol", "Terra", "Luna"]);
  });

  it("persists a model change", async () => {
    const user = await renderExpanded();

    await openSelect(user, "Model");
    await user.click(screen.getByRole("option", { name: "Sol" }));

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({ model: "gpt-5.6-sol" }),
      });
    });
  });

  it("persists a reasoning effort change", async () => {
    const user = await renderExpanded();

    await openSelect(user, "Reasoning");
    await user.click(screen.getByRole("option", { name: "medium" }));

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
        settings: expect.objectContaining({ reasoningEffort: "medium" }),
      });
    });
  });
});
