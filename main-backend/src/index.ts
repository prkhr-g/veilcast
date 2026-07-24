import { serve } from "bun";
import { detectionEngine } from "../../detection-core/src/index";
import index from "../../ex-frontend/src/index.html";

const server = serve({
  routes: {
    "/*": index,

    "/api/hello": {
      async GET() {
        return Response.json({ message: "Hello, world!", method: "GET" });
      },
      async PUT() {
        return Response.json({ message: "Hello, world!", method: "PUT" });
      },
    },

    "/api/hello/:name": async req => {
      return Response.json({ message: `Hello, ${req.params.name}!` });
    },

    "/api/scan": {
      async POST(req) {
        try {
          const body = await req.json();
          const detections = detectionEngine.scan(body);
          return Response.json({ detections });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Invalid scan request" }, { status: 400 });
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);