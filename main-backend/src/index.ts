import { serve } from "bun";
import { app } from "./app";

const server = serve({
  fetch: app.fetch,
  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
