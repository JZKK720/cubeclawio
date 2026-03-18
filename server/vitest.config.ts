import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "strip-shebang",
      transform(code: string, id: string) {
        if ((id.endsWith(".mjs") || id.endsWith(".js")) && code.startsWith("#!")) {
          return code.replace(/^#![^\n]*\n/, "");
        }
      },
    },
  ],
  test: {
    environment: "node",
  },
});
