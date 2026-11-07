import { defineConfig } from "vite";

// BASE_PATH is set by the GitHub Pages workflow ("/PokeClasseur/"); locally the app runs at "/".
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },   // shown in the app, to check which version is running
  build: { target: "es2020", sourcemap: true },
  test: { environment: "jsdom" }
});
