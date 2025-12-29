import path from "node:path";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["@electric-sql/pglite", "drizzle-orm"],
    },
  },
  resolve: {
    alias: {
      "@/main": path.resolve(__dirname, "./src/main"),
    },
  },
});
