import { describe, it, expect, afterEach } from "vitest";
import { startRectangleSelection, SELECTION_CANCELLED } from "../capture";

function overlay(): HTMLElement {
  return document.body.lastElementChild as HTMLElement;
}

function mouse(type: string, clientX: number, clientY: number) {
  overlay().dispatchEvent(
    new MouseEvent(type, { clientX, clientY, bubbles: true }),
  );
}

function drag(from: [number, number], to: [number, number]) {
  mouse("mousedown", ...from);
  mouse("mousemove", ...to);
  mouse("mouseup", ...to);
}

describe("startRectangleSelection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("resolves the dragged rectangle whichever way it was drawn", async () => {
    const selection = startRectangleSelection();
    drag([200, 150], [50, 30]);

    await expect(selection).resolves.toEqual({
      x: 50,
      y: 30,
      width: 150,
      height: 120,
    });
  });

  it("removes the overlay once the selection is made", async () => {
    const selection = startRectangleSelection();
    expect(document.body.children).toHaveLength(1);

    drag([0, 0], [100, 100]);
    await selection;

    expect(document.body.children).toHaveLength(0);
  });

  it("rejects a selection narrower than 10 pixels", async () => {
    const selection = startRectangleSelection();
    drag([0, 0], [9, 100]);

    await expect(selection).rejects.toThrow("Selection too small");
    expect(document.body.children).toHaveLength(0);
  });

  it("accepts a selection of exactly 10 by 10 pixels", async () => {
    const selection = startRectangleSelection();
    drag([0, 0], [10, 10]);

    await expect(selection).resolves.toMatchObject({ width: 10, height: 10 });
  });

  it("ignores mouse up without a preceding mouse down", async () => {
    const selection = startRectangleSelection();
    mouse("mouseup", 100, 100);
    expect(document.body.children).toHaveLength(1);

    drag([0, 0], [20, 20]);
    await expect(selection).resolves.toMatchObject({ width: 20 });
  });

  it("cancels on Escape and removes the overlay", async () => {
    const selection = startRectangleSelection();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    await expect(selection).rejects.toThrow(SELECTION_CANCELLED);
    expect(document.body.children).toHaveLength(0);
  });
});
