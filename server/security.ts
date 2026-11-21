import type { Express, Request, Response, NextFunction } from "express";

/**
 * Security headers. The same policy is set in vercel.json for files Vercel
 * serves directly (the page and its assets); this covers the API and any
 * non-Vercel host.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Google sign-in script; WebAssembly for the photo text reader.
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client",
  // Inline styles come from React, KaTeX and the formula editor.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

export function securityHeaders(app: Express) {
  app.disable("x-powered-by");
  // The Vite dev server injects inline scripts for hot reload, so the content
  // policy is only sent outside development.
  const dev = process.env.NODE_ENV === "development";
  app.use((_req: Request, res: Response, next: NextFunction) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      if (dev && k === "Content-Security-Policy") continue;
      res.setHeader(k, v);
    }
    next();
  });
}
