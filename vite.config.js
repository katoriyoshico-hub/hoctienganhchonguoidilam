import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    {
      name: "release-marker",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "app-version.json",
          source: JSON.stringify({ version }),
        });
      },
    },
  ],
  server: { host: "0.0.0.0", proxy: { "/api": "http://127.0.0.1:3001" } },
  preview: { host: "0.0.0.0", proxy: { "/api": "http://127.0.0.1:3001" } },
});
