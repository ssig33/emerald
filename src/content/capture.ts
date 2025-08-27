import { SelectionRect } from "../types";

export const initScreenCapture = () => {
  console.log("Screen capture functionality initialized");
};

export const startRectangleSelection = (): Promise<SelectionRect> => {
  return new Promise((resolve, reject) => {
    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let overlay: HTMLDivElement;
    let selectionBox: HTMLDivElement;

    // Create overlay (fullscreen semi-transparent)
    overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999999;
      cursor: crosshair;
      user-select: none;
    `;

    // Create selection box
    selectionBox = document.createElement("div");
    selectionBox.style.cssText = `
      position: absolute;
      border: 2px dashed #0066ff;
      background: rgba(0, 102, 255, 0.1);
      display: none;
      pointer-events: none;
    `;

    overlay.appendChild(selectionBox);
    document.body.appendChild(overlay);

    const cleanup = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      document.removeEventListener("keydown", escHandler);
    };

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        reject(new Error("Selection cancelled"));
      }
    };

    overlay.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.display = "block";
      selectionBox.style.left = startX + "px";
      selectionBox.style.top = startY + "px";
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
    });

    overlay.addEventListener("mousemove", (e) => {
      if (!isSelecting) return;

      const width = Math.abs(e.clientX - startX);
      const height = Math.abs(e.clientY - startY);
      const left = Math.min(e.clientX, startX);
      const top = Math.min(e.clientY, startY);

      selectionBox.style.left = left + "px";
      selectionBox.style.top = top + "px";
      selectionBox.style.width = width + "px";
      selectionBox.style.height = height + "px";
    });

    overlay.addEventListener("mouseup", (e) => {
      if (!isSelecting) return;

      const rect: SelectionRect = {
        x: Math.min(e.clientX, startX),
        y: Math.min(e.clientY, startY),
        width: Math.abs(e.clientX - startX),
        height: Math.abs(e.clientY - startY),
      };

      cleanup();

      if (rect.width < 10 || rect.height < 10) {
        reject(new Error("Selection too small (minimum 10x10 pixels)"));
      } else {
        resolve(rect);
      }
    });

    document.addEventListener("keydown", escHandler);
  });
};
