import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Spokane Tech Jobs.
 *
 * `@kit` points at src/kit — the design-system base this app was built on,
 * vendored in rather than imported from the prototype workspace it started in.
 * It is the app's own code now; the alias survives because the alternative was
 * rewriting the import in every file to say nothing new.
 */
export default defineConfig({
  server: { port: 5184, strictPort: true },
  resolve: {
    alias: { "@kit": resolve(import.meta.dirname, "src/kit") },
  },
  plugins: [tailwindcss(), react()],
  build: { sourcemap: true },
});
