# Task: Migrate math.az from SQLite (better-sqlite3) to PostgreSQL (postgres-js) + add Vercel serverless support

Project dir: `/home/user/workspace/mathaz`. This is an Express + Vite + React + Drizzle ORM webapp.
Goal: replace the SQLite storage layer with PostgreSQL so it can deploy durably on Vercel serverless. DO NOT change any frontend code, routes logic, or feature behavior. Only the persistence layer + config + a Vercel entry.

## Constraints (CRITICAL)
- The `IStorage` interface and `DatabaseStorage` method signatures must stay identical (all already return `Promise<...>`).
- Routes (`server/routes.ts`) only call `storage.*` — DO NOT touch routes.
- Keep column names (snake_case) and table names identical so data shape is unchanged.
- Use the `postgres` (postgres-js) driver + `drizzle-orm/postgres-js`.
- Connection string from `process.env.DATABASE_URL`. If unset, the app should still import without crashing at module load is NOT required — it's fine to throw if DATABASE_URL missing, BUT prefer: if missing, log a clear warning. Actually: throw a clear error `DATABASE_URL is required` at startup is acceptable.
- Boolean-ish and timestamp columns are stored as integers in SQLite (0/1 and epoch-ms). KEEP them as integer columns in Postgres too (use `integer`), to avoid touching routes/frontend. Do NOT convert to boolean or timestamp types.
- Auto-increment PKs: use `serial("id").primaryKey()` in pgTable.

## Step 1 — `shared/schema.ts`
- Change import from `drizzle-orm/sqlite-core` to `drizzle-orm/pg-core`.
- Replace `sqliteTable` → `pgTable`.
- `integer("id").primaryKey({ autoIncrement: true })` → `serial("id").primaryKey()`.
- All other `integer(...)` and `text(...)` columns: keep as `integer(...)` / `text(...)` from pg-core (same names, same .notNull()/.default()/.unique() chains). pg-core has both `integer` and `text` and `serial`.
- Keep ALL drizzle-zod insert schemas and types EXACTLY as-is (createInsertSchema works the same).
- Do not change any zod validation.

## Step 2 — `server/storage.ts`
- Replace driver imports:
  - remove `import { drizzle } from "drizzle-orm/better-sqlite3";` and `import Database from "better-sqlite3";`
  - add `import { drizzle } from "drizzle-orm/postgres-js";` and `import postgres from "postgres";`
- Connection:
  ```ts
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  // For serverless: disable prepared statements (pgbouncer/transaction pooling friendly)
  const client = postgres(connectionString, { prepare: false });
  export const db = drizzle(client);
  ```
- Auto-create tables: the SQLite `sqlite.exec(CREATE TABLE IF NOT EXISTS ...)` block must be rewritten as Postgres DDL run via the `client`. Convert each table:
  - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
  - `INTEGER` → `INTEGER`, `TEXT` → `TEXT` (Postgres supports both)
  - Keep `NOT NULL`, `DEFAULT '...'`, `DEFAULT 0`, `UNIQUE` as-is (all valid PG syntax).
  - Run them with: `await client.unsafe(\`...all CREATE TABLE IF NOT EXISTS statements...\`)`.
  - Because table creation is async and module-load is sync, wrap init in an exported async `initDb()` function AND call it. BUT routes call storage immediately. Simplest robust approach: create an IIFE that runs the DDL and store a promise `export const ready = (async () => { await client.unsafe(DDL); })();`. Then in `server/index.ts` startup, `await ready` before listening. Add `import { ready } from "./storage"` and `await ready;` right before `httpServer.listen(...)` in server/index.ts. Check server/index.ts for where it listens.
  - Remove the SQLite-specific `ensureColumn` / `PRAGMA table_info` migration helper. Instead, the CREATE TABLE IF NOT EXISTS will create fresh tables with all columns (max_attempts, auto_submitted, attempt_number already in the schema), so for a brand-new Postgres DB no column migration is needed. You may add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements for those 3 columns for safety (Postgres supports `ADD COLUMN IF NOT EXISTS`). Append after CREATEs:
    - `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1;`
    - `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS auto_submitted INTEGER NOT NULL DEFAULT 0;`
    - `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;`
- Convert every query terminator from sync to async (postgres-js drizzle is async):
  - `.get()` (single row) → drizzle-postgres has no `.get()`. Use `(await db.select()...).at(0)` OR `.then(r => r[0])`. Cleanest: `const rows = await db.select()...; return rows[0];` Wrap each. For inserts/updates with `.returning().get()` → `(await db.insert(...).values(...).returning())[0]`.
  - `.all()` → just `await db.select()...` (returns array).
  - `.run()` → `await db.delete(...)` / `await db.insert(...)` (no `.run()`).
  - For internal helper calls within a method that used sync `.all()` (e.g. memberships, mgRows), convert to `await`.
- Make sure every method body uses `await` correctly. Methods are already `async` so just add `await`.
- IMPORTANT: `db.insert(...).values(...).returning()` in postgres-js returns the rows array — index `[0]`.
- Keep all the in-memory filtering logic (getMaterialsForStudent, getSessionsForStudent, deleteMaterial cascade) identical, just await the DB reads.

## Step 3 — `package.json`
- Add deps: `"postgres": "^3.4.5"`. Keep `drizzle-orm`. You may LEAVE `better-sqlite3` in deps (harmless) OR remove it; prefer removing it from dependencies to keep the bundle lean, BUT the build allowlist references many libs — just removing better-sqlite3 from dependencies is fine. Also add `postgres` to the esbuild allowlist in `script/build.ts` so it gets bundled.
- Run `npm install postgres` in the project dir.

## Step 4 — `drizzle.config.ts`
- Change `dialect: "sqlite"` → `dialect: "postgresql"`.
- Change `dbCredentials: { url: "./data.db" }` → `dbCredentials: { url: process.env.DATABASE_URL || "" }`.

## Step 5 — Vercel serverless entry
- Create `api/index.ts` (Vercel serverless function) that exports the Express app as a handler. Pattern:
  ```ts
  import { app, ready } from "../server/index";
  export default async function handler(req: any, res: any) {
    await ready;
    app(req, res);
  }
  ```
  This requires `server/index.ts` to `export { app }` and `export { ready }` (re-export ready from storage). Check server/index.ts: it currently creates `const app = express()`. Change to `export const app = express()`. Also re-export ready: add `export { ready } from "./storage";`.
  IMPORTANT: server/index.ts currently calls `httpServer.listen(...)` at the bottom — that's fine for local/Render but on Vercel it must NOT listen. Guard the listen call: only call `httpServer.listen` when NOT running on Vercel, e.g. `if (!process.env.VERCEL) { await ready; httpServer.listen(...) }`. Read server/index.ts fully first to see the exact listen block and the vite/static setup.
  NOTE: In dev/prod-node mode, the vite middleware or serveStatic is set up in server/index.ts. On Vercel, static files (dist/public) are served by Vercel's static hosting (see vercel.json), and only /api/* hits the function. The serveStatic catch-all in the Express app is harmless on Vercel because Vercel routes static first.
- Create `vercel.json`:
  ```json
  {
    "version": 2,
    "buildCommand": "npm run build",
    "outputDirectory": "dist/public",
    "functions": { "api/index.ts": { "maxDuration": 30 } },
    "rewrites": [
      { "source": "/api/(.*)", "destination": "/api/index" }
    ]
  }
  ```
  Adjust if the API routes are registered WITHOUT an /api prefix — CHECK server/routes.ts: confirm all routes start with `/api`. The body limit is 60mb (materials base64) — note Vercel has a 4.5MB request body limit on serverless functions; document this in MIGRATION_NOTES.md as a known limitation (large uploads may fail on Vercel) but do NOT change the limit.

## Step 6 — Verify it compiles
- Run `npx tsc --noEmit` and fix any type errors from the driver swap.
- Do NOT run the dev server or build (the parent agent will provision DATABASE_URL and QA). Just ensure `tsc` passes.
- If tsc complains that postgres-js drizzle `.returning()` types differ, adjust with `[0]` indexing and proper typing. Return `rows[0]` (may be `undefined` which matches the `| undefined` signatures).

## Output
- Write a short `MIGRATION_NOTES.md` summarizing: files changed, the Vercel 4.5MB body limit caveat for material uploads, and that DATABASE_URL must be set (locally and on Vercel).
- Report back: list of files changed and confirmation `tsc` passes clean.

DO NOT commit or push. DO NOT delete data.db logic concerns — there is no data.db anymore in PG mode.
