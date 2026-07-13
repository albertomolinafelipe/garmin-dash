import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: proxy /api to the FastAPI server. The target is configurable so the same
// config works both natively (localhost) and in Docker (the `backend` service).
// Build: static assets go to dist/, which the Dockerfile copies into the python
// image as web_dist/.
const apiTarget = process.env.API_PROXY_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 so the dev server is reachable from the host
    port: 5173,
    proxy: {
      "/api": apiTarget,
    },
  },
});
