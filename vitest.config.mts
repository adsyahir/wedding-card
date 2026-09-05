import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Some server-only modules (see src/lib/crypto.ts) import the
    // `server-only` marker package, whose default export throws at runtime
    // unless resolved via the "react-server" package-export condition
    // (which Next.js's server bundler sets). Vitest doesn't set that
    // condition by default, so we add it here — this makes `server-only`
    // resolve to its no-op stub for tests, matching how it behaves inside
    // Next.js's server compilation. Vitest runs test files through Vite's
    // SSR module resolution, which reads `resolve.conditions` (not a
    // separate `ssr.conditions`), so setting it here is sufficient.
    conditions: ["react-server"],
  },
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
