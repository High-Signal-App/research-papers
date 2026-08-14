import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://papers.highsignal.app",
  output: "static",
  build: {
    // Cloudflare Pages serves `route.html` directly at `/route`. Directory
    // output adds a 308 hop to `/route/` for every non-home sitemap URL.
    format: "file",
    inlineStylesheets: "always",
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    css: {
      transformer: "lightningcss",
    },
    build: {
      cssMinify: "lightningcss",
    },
  },
});
