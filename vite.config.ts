import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";

function generateManifest() {
  const manifest = readJsonFile("src/manifest.json");
  const pkg = readJsonFile("package.json");
  return {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    ...manifest,
  };
}

const target = process.env.TARGET_BROWSER || "chrome";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: `dist/${target}`,
  },
  plugins: [
    react(),
    webExtension({
      browser: target,
      manifest: generateManifest,
      additionalInputs: [
        "src/sidepanel/index.html",
        "src/content/content.ts",
        "src/background/background.ts",
      ],
    }),
  ],
});
