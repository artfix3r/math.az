import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { ensureSchema } from "./storage";
import { securityHeaders } from "./security";

export const app = express();
const httpServer = createServer(app);
securityHeaders(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    // Materials can be uploaded as base64 data URIs stored in the DB, so the
    // body can be several MB. Raise the limit well above the 100kb default.
    limit: "60mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "60mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Initialize the app (DB + routes + error handler + static/vite). Exported as a
// single promise so both the local listener and the Vercel serverless handler
// can await full readiness before serving requests.
// Make sure the database schema exists before any API request runs. If the
// database is unreachable, answer 503 (and retry on the next request) rather
// than crashing the process.
app.use("/api", async (_req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (e) {
    console.error("Database not ready:", e);
    res.status(503).json({ message: "The database is not reachable right now. Please try again in a minute.", code: "db_unavailable" });
  }
});

export const ready = (async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message, code: "generic" });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes.
  // On Vercel, static assets are served from the build output directory, so the
  // serverless function only needs the API routes — skip static/vite setup.
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }
  }
})();

// On Vercel, do not start an HTTP listener — Vercel's infrastructure handles that.
// ALWAYS serve the app on the port specified in the environment variable PORT.
// Other ports are firewalled. Default to 5000 if not specified.
if (!process.env.VERCEL) {
  ready.then(async () => {
    // Fail fast locally if the database is misconfigured.
    await ensureSchema();
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  });
}
