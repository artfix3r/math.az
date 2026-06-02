# Migration Notes: SQLite → PostgreSQL + Vercel Serverless

## Files Changed

| File | Change |
|------|--------|
| `shared/schema.ts` | Replaced `drizzle-orm/sqlite-core` import with `drizzle-orm/pg-core`. Replaced `sqliteTable` → `pgTable` on all 9 tables. Replaced `integer("id").primaryKey({ autoIncrement: true })` → `serial("id").primaryKey()` on all PKs. All other column definitions (`integer`, `text`) are unchanged — pg-core exports the same names. Drizzle-zod insert schemas and all inferred types are untouched. |
| `server/storage.ts` | Replaced `better-sqlite3` + `drizzle-orm/better-sqlite3` with `postgres` driver + `drizzle-orm/postgres-js`. Connection reads from `process.env.DATABASE_URL` (throws if unset). Added `prepare: false` for pgbouncer/transaction-pooling safety. Rewrote the SQLite `sqlite.exec(...)` block as a PG DDL string executed via `client.unsafe(...)` inside an exported `ready` promise (IIFE). Added `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for the three columns added after initial schema (`max_attempts`, `auto_submitted`, `attempt_number`). Removed the SQLite-specific `ensureColumn`/`PRAGMA table_info` helper. Converted every query terminator: `.get()` → `rows[0]` pattern, `.all()` → plain `await`, `.run()` → plain `await`. All methods were already `async`; only `await` calls needed adding. |
| `package.json` | Added `"postgres": "^3.4.5"` to dependencies. Removed `"better-sqlite3"` from dependencies and `"@types/better-sqlite3"` from devDependencies. |
| `script/build.ts` | Added `"postgres"` to the esbuild bundle allowlist so the driver is inlined into the server bundle. |
| `drizzle.config.ts` | Changed `dialect: "sqlite"` → `dialect: "postgresql"`. Changed `dbCredentials.url` from `"./data.db"` → `process.env.DATABASE_URL \|\| ""`. |
| `server/index.ts` | Changed `const app = express()` → `export const app = express()`. Added `export { ready } from "./storage"` re-export. Guarded `httpServer.listen(...)` behind `if (!process.env.VERCEL)` with `await ready` before listening. |
| `api/index.ts` *(new)* | Vercel serverless function entry point. Imports `app` and `ready` from `../server/index`, awaits `ready`, then passes `(req, res)` to the Express app. |
| `vercel.json` *(new)* | Vercel config: `buildCommand: "npm run build"`, `outputDirectory: "dist/public"`, serverless function at `api/index.ts` with `maxDuration: 30`, and a rewrite rule routing `/api/(.*)` → `/api/index`. |

## Environment Variable Requirements

`DATABASE_URL` **must be set** in every runtime environment:

- **Local development**: add `DATABASE_URL=postgres://...` to `.env`
- **Vercel**: add `DATABASE_URL` in the Vercel project → Settings → Environment Variables
- **Other hosts (Render, Railway, etc.)**: set as a service environment variable

If `DATABASE_URL` is not set, the server will throw `Error: DATABASE_URL is required` at startup and refuse to start.

## Known Limitations

### Vercel 4.5 MB Request Body Limit

The Express app accepts bodies up to 60 MB (`express.json({ limit: "60mb" })`) to support material uploads as base64 data URIs. However, **Vercel serverless functions enforce a hard 4.5 MB request body limit** that cannot be overridden in application code. Large file uploads (PDFs, videos, images > ~3.3 MB before base64 encoding overhead) will be rejected by Vercel's infrastructure before they reach the Express handler. This is a Vercel platform constraint, not a code issue. Options to mitigate on Vercel:

1. Upload files directly to object storage (S3, Supabase Storage, Cloudflare R2) from the client, and store only the URL in the DB.
2. Use Vercel's Edge Middleware or a non-serverless host for large-upload routes.

## TypeScript Check

`npx tsc --noEmit` passes with **zero errors** after the migration.

## What Was NOT Changed

- `server/routes.ts` — untouched; all route logic unchanged
- `client/` — frontend code entirely untouched
- Column names and table names — identical to the SQLite schema (snake_case)
- Integer columns that stored booleans/timestamps (0/1, epoch-ms) — kept as `integer` in PG, not converted to `boolean`/`timestamp`
- Drizzle-zod insert schemas and all inferred TypeScript types — unchanged
- `IStorage` interface — unchanged
