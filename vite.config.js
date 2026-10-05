import { defineConfig } from "vite";

// BASE_PATH is set by the GitHub Pages workflow ("/PokeClasseur/"); locally the app runs at "/".
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  build: { target: "es2020", sourcemap: true },
  test: { environment: "jsdom" }
});
