import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/v-ball/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "ES2020",
  },
});
