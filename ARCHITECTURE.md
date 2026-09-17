# Architecture

A SvelteKit app that fronts a WebDAV file store ("the cloud drive"), reachable only over the owner's
Tailscale network. It adds per-folder access control keyed on Tailscale identity, plus a chunked,
resumable upload pipeline with live save-progress over SSE. This doc maps every file/component to its
purpose and shows how they connect, so you can find the right place to make a change without
re-deriving the flow from scratch each time.

For the domain vocabulary (Tailscale Identity, Folder, Grant, Protected Root, Folder Request …) see
`CONTEXT.md`. For why there's no login system, see `docs/adr/0001-tailscale-identity-over-better-auth.md`.

## Tech stack

- **SvelteKit** (Svelte 5 runes) with `@sveltejs/adapter-node` — deploys as a standalone Node server,
  not serverless/static.
- **Tailscale identity headers** as the only auth. `tailscale serve` injects `Tailscale-User-Login` /
  `Tailscale-User-Name`; `hooks.server.ts` reads them into `locals.tailscaleIdentity`. There is no
  login UI, no session store, no credential system.
- **Drizzle ORM** + Postgres — holds only the permission model (`folder`, `folder_permission`).
- **WebDAV** (`webdav` npm client) as the actual file storage backend — the app is a UI/API layer in
  front of a WebDAV server, not a filesystem of its own.
- **SSE (Server-Sent Events)** for pushing upload/save progress from server to client.

`better-auth` is still a `package.json` devDependency with two orphaned files, but nothing imports it.
See "Known gaps".

## Directory layout

```
src/
  routes/           file-based routes: pages + API endpoints
  lib/               client-safe shared code ($lib/*)
  lib/server/         server-only shared code ($lib/server/*, never bundled to the client)
  lib/assets/          static assets bundled through Vite
  hooks.server.ts      global request hook (populates locals.tailscaleIdentity)
  app.d.ts              ambient types (App.Locals.tailscaleIdentity)
static/                 files served as-is (robots.txt)
docs/adr/               architecture decision records
```

## Route tree

| Route | Files | Purpose |
|---|---|---|
| `/` | `+page.svelte` | Unused SvelteKit starter placeholder — not linked from the cloud UI. |
| `/cloud` | `+page.server.ts`, `+page.svelte` | Health-check landing page: pings the WebDAV backend (`client.exists('/')`); redirects to `/cloud/files` if reachable, otherwise renders `components/Offline.svelte`. |
| `/cloud/files` | `+page.server.ts`, `+page.svelte`, `upload.svelte.ts` | The main file browser — directory listing, rename/delete/bulk-delete, upload picker/progress banner, disk-space widget. |
| `/cloud/files/upload/init` | `+server.ts` | `POST` — starts or resumes a chunked upload transfer. Requires `edit` on `destPath`. |
| `/cloud/files/upload/chunk` | `+server.ts` | `PUT` — receives one chunk; triggers finalize when the last chunk lands. Re-checks `edit`. |
| `/cloud/files/upload-progress` | `+server.ts` | `GET` (SSE) — streams server-side save progress for an upload session. |
| `/cloud/file` | `+server.ts` | `GET` — streams a single file's raw bytes from WebDAV for inline view/download (`?path=`). Requires any access level. |
| `/cloud/api/disk-space` | `+server.ts` | `GET` — host disk usage from the cached `df` poll. Sends `Access-Control-Allow-Origin: *` so a dev server can read the deployed host's real numbers. |
| `/cloud/no-access` | `+page.server.ts`, `+page.svelte` | Where a denied request lands; shows the denying login and the path. |

## Access control

Every server-side entry point into the drive funnels through `getAccessLevel(login, path)` in
`lib/server/permissions.ts`. There is no route-group guard or middleware — each route calls it itself:

| Caller | Required level | On failure |
|---|---|---|
| `/cloud/files` load | any (`view` or `edit`) | redirect to `/cloud/no-access?path=…` |
| `rename` / `delete` actions | any non-null level | redirect to `/cloud/no-access` |
| `deleteMany` action | `edit` on **every** selected path | `fail(403)` — checked up front so a bulk delete never half-applies |
| `/cloud/file` GET | any non-null level | `error(403)` |
| `/upload/init`, `/upload/chunk` | `edit` on `destPath` | `403` |

`data.accessLevel` is returned to `/cloud/files` and the page hides mutating UI when it isn't `edit`
— that's presentation only; the server checks above are the real boundary.

### Resolution rules (`getAccessLevel`)

1. No login → `null` (deny).
2. `isAdmin(login)` → `'edit'` everywhere. The allowlist (`ADMIN_LOGINS`) is a hardcoded `Set` in
   `permissions.ts` and is **currently empty** — no identity is an admin today.
3. Otherwise collect two sets of grants: **personal** (`tailscale_login = login`) and **general**
   (`tailscale_login IS NULL AND access = 'view'`).
4. Personal grants cascade — a grant on `/family` covers `/family/photos`. Matching is segment-aware
   (`pathCovers`), so `/family` does not match `/familyphotos`. A grant on `/` covers everything.
5. General grants do **not** cascade — they match only their exact folder path.
6. Among matching grants, the longest folder path wins (most specific); ties break by `ACCESS_RANK`
   (`edit: 2`, `view: 1`).

`hasAccess()` is a boolean variant that only considers personal grants; nothing currently calls it.

### Data model (`lib/server/db/schema.ts`)

- **`folder`** — `id`, `path` (normalized, unique, e.g. `/family`), `label`, `created_at`. A path must
  have a `folder` row before it can be granted; not every WebDAV directory is a Folder.
- **`folder_permission`** — `id`, `folder_id` (FK, cascade delete), `tailscale_login` (nullable —
  `NULL` means a General Grant), `access` (`'view' | 'edit'`, plain text, not an enum), `created_at`.
  Unique on `(folder_id, tailscale_login)`.

Rows are created by hand via `npm run db:studio`. `grantAccess()` exists but hardcodes `access: 'view'`
and silently returns when the folder row is missing (see issue #5).

## `src/lib` (client-safe)

- **`upload-constants.ts`** — `CHUNK_SIZE` (5MB), `computeTransferId()` (stable id hashed from
  `destPath::filename::size::lastModified`, via `crypto.subtle.digest` with a hand-rolled djb2-ish
  fallback for non-HTTPS origins), `totalChunks(size)`. Shared between client and server — hence not
  under `server/`.
- **`webdav.ts`** — the storage layer. Thin wrapper around the `webdav` npm client: `getClient`,
  `listDirectory`, `readFile`, `writeFileStream`, `deleteItem`, `moveItem`, `createDirectory`,
  `exists`. Every WebDAV read/write in the app funnels through here. Two things aren't plain client
  calls: `moveItem` issues a raw `MOVE` fetch (the Apache backend wants an `http://` `Destination`
  even when the app talks `https://`), and `writeFileStream` optionally pipes through a `PassThrough`
  to report bytes-written — using `stream/promises.pipeline` so a read failure surfaces instead of
  hanging.
- **`tailscale.ts`** — `getDevices`/`getOnlineStatus` against the Tailscale API. Not wired into
  anything: `/cloud`'s online check talks to WebDAV directly.

## `src/lib/server` (server-only)

- **`permissions.ts`** — the access-control module described above: `isAdmin`, `normalizePath`,
  `getAccessLevel`, `hasAccess`, `listPermissions`, `listGeneralViewOnlyFolders`, `grantAccess`,
  `revokeAccess`.
- **`db/index.ts`** — Drizzle Postgres client (`DATABASE_URL`).
- **`db/schema.ts`** — `folder` + `folder_permission` (above). Nothing else.
- **`disk-space.ts`** — module-level singleton that shells out to `df -B1 --output=size,used,avail /`,
  caches the result, and re-polls every 10s. Imported for side effect by `hooks.server.ts` purely so
  the timer starts at boot. `getCachedDiskSpace()` (cheap, ≤10s stale), `getFreshDiskSpace()`,
  `getDiskSpaceError()`. Linux-only — on Windows dev machines `df` ENOENTs and the error string is
  surfaced through the API instead of the numbers.
- **`upload-state.ts`** — SSE session registry: in-memory `Map<uploadId, UploadSession>`, each holding
  an `EventEmitter` plus a replay buffer of events (`saving` / `complete` / `error`).
  `getOrCreateUploadSession` exists because the SSE client connects *before* `/upload/init` runs.
  Includes a 30-minute idle TTL GC (`cleanupStaleSessions`).
- **`chunk-transfer.ts`** — chunked-upload state machine. In-memory `Map<transferId, ChunkTransfer>`
  plus chunk files on disk at `os.tmpdir()/cloud-uploads/<transferId>/chunk.<n>`.
  `createChunkTransfer` (idempotent, re-creates if already `done` to support re-uploads),
  `receivedChunks` (resume support), `writeChunk` (rejects out-of-range indices), `isComplete` (checks
  for holes, not just count), `assemble`, `streamChunksInOrder`, `claimFinalize` (compare-and-set so
  exactly one caller finalizes), `markDone`, `cleanupStaleTransfers` (30-min TTL).
- **`finalize-upload.ts`** — `finalizeFile()`: streams the chunks straight to WebDAV
  (`createDirectory` + `writeFileStream`), emitting throttled `saving` events (max ~4/s) and a
  `complete` when it's the last file in the batch. On failure it releases the finalize claim and emits
  `error` instead of throwing, so the route never 500s mid-upload.
- **`safe-path.ts`** — `resolveUploadPath(destPath, filename)`: path-traversal guard so an uploaded
  file can never resolve outside `destPath` (folder uploads may nest deeper, never escape via `../`).
- **`auth.ts`**, **`db/auth.schema.ts`** — dead better-auth leftovers, imported by nothing.

## The upload/save pipeline

This is the part most worth understanding end-to-end, since it spans client, two HTTP endpoints, an
SSE stream, and three pieces of server state.

```
+page.svelte
   │ user picks files
   ▼
upload.svelte.ts (UploadManager.start)
   │ 1. opens EventSource(/cloud/files/upload-progress?id=uploadId)   ← ephemeral, SSE-only id
   │ 2. per file: computeTransferId() → stable id from path+name+size+mtime
   ▼
POST /upload/init  ─────────────► upload-state.ts (session)  +  chunk-transfer.ts (transfer)
   │ checks edit access on destPath; returns already-received chunk indices (resume)
   │ or { done: true } if already finalized
   ▼
PUT /upload/chunk  (repeated, one call per remaining chunk, retried up to 3x)
   │ re-checks edit access; writeChunk() → on last chunk, isComplete() triggers:
   ▼
finalize-upload.ts (finalizeFile)
   │ claimFinalize() → streamChunksInOrder() → webdav.writeFileStream()
   │ emits throttled saving → (last file) complete over the session's EventEmitter
   ▼
upload-progress/+server.ts (SSE)  ─────────────►  UploadManager (client)
   │ replays buffered events, then streams live ones; closes on complete/error
   ▼
UploadManager updates phase/percent/savingFilename for the progress banner,
then calls invalidateAll() to refresh the directory listing.
```

Key design points to know before touching this code:

- **Two different IDs**: `uploadId` (per upload *batch*, SSE channel only) vs `transferId` (per *file*,
  derived deterministically so re-uploading the same file/path/size/mtime resumes instead of
  duplicating).
- **Nothing is ever assembled into one temp file.** `streamChunksInOrder` reads `chunk.0..chunk.n-1`
  straight off disk into the WebDAV PUT body, so a 10GB upload never needs 10GB of scratch beyond the
  chunks themselves. (`assemble()` still exists as a buffer-everything variant but nothing calls it.)
- **EventSource close race** (see `upload.svelte.ts`): the client must call `es.close()` the moment a
  `complete`/`error` event is *received* — otherwise the server ends the HTTP stream first, the
  browser's native SSE auto-reconnect kicks in, and `getOrCreateUploadSession` replays the entire
  event history, causing the progress UI to loop.
- **Finalize is claimed, not just triggered**: both the chunk endpoint (last chunk received) and the
  init endpoint (resume where every chunk was already on disk) can independently observe "transfer
  complete." `claimFinalize()` in `chunk-transfer.ts` ensures only one of them actually finalizes.
- **Pause is an `AbortController`**, not a protocol feature. Pausing aborts the in-flight chunk fetch;
  on resume the loop rolls the index back one and re-sends. The abort path is distinguished from a
  real network failure by `e.name === 'AbortError'` so it doesn't burn retry attempts.
- **Temp storage vs. final storage**: in-flight chunks live under `os.tmpdir()/cloud-uploads/`; the
  only durable destination is WebDAV via `lib/webdav.ts`. Nothing in the upload pipeline touches disk
  paths that aren't temp scratch space.

## In-memory state and what a restart costs

Three things live only in the Node process, and all of them are lost on restart (and would break under
more than one instance — `adapter-node` runs a single process, which is why this is fine today):

- `chunk-transfer.ts`'s `transfers` map — the chunk *files* survive in tmpdir but become orphans the
  GC will eventually sweep; the client re-inits and re-uploads.
- `upload-state.ts`'s `uploads` map — an in-flight upload's SSE stream dies; the client's `onmessage`
  never fires `complete`.
- `disk-space.ts`'s cache and poll timer — re-primed on boot.

## Config files that matter architecturally

- **`svelte.config.js`** — `adapter-node` (standalone Node server).
- **`vite.config.ts`** — `@tailwindcss/vite`, `sveltekit()`, `vite-plugin-devtools-json`.
- **`hooks.server.ts`** — single global `Handle`: reads the Tailscale headers into
  `event.locals.tailscaleIdentity`, and imports `disk-space` for its boot-time side effect. Also
  carries a `getAccessToken()` helper for the Tailscale OAuth API that is currently commented out at
  the call site.
- **`drizzle.config.ts`** — schema at `lib/server/db/schema.ts`, `postgresql` dialect, `DATABASE_URL`.
- **`package.json` scripts** — `db:push/generate/migrate/studio` (Drizzle Kit), plus a dead
  `auth:schema`.
- **`compose.yaml`** — local Postgres dev DB (`db:start`).
- **Env vars** — `WEBDAV_URL`, `WEBDAV_PASSWORD`, `TAILSCALE_OAUTH_CLIENT`, `TAILSCALE_OAUTH_PASSWORD`
  (`$env/static/private`); `DATABASE_URL` (`$env/dynamic/private`). `.env.example` is stale: it still
  lists `BETTER_AUTH_SECRET` / `GITHUB_CLIENT_*` / `ORIGIN` and omits the WebDAV and Tailscale OAuth
  vars the app actually requires at build time.

## Known gaps

Tracked in GitHub Issues (mackerelsoup/website). Not repeated here where a ticket already owns them —
notably the admin dashboard, Folder Requests, Protected Root enforcement, and selectable grant levels
(#4–#9) are all incoming work, and `permissions.ts` is expected to grow around them.

- **The dev-fallback identity is unconditional** (#2). `hooks.server.ts` reads the real headers, then
  overwrites `locals.tailscaleIdentity` with a hardcoded `mackerelsoup@github` in every environment.
  Right now *everyone is that identity*, in production too — read any access-control behavior with
  that in mind.
- **`better-auth` is still installed but dead** (#3): `lib/server/auth.ts`, `db/auth.schema.ts`, the
  `auth:schema` script, and the `better-auth` dependency all persist with no importer.
- **No admin allowlist entries.** `ADMIN_LOGINS` is empty and the only entry is commented out, so
  `isAdmin()` always returns `false` and the admin bypass in `getAccessLevel`/`hasAccess` is
  currently unreachable. `permissions.ts`'s comment points at a `/cloud/admin/permissions` UI that
  does not exist yet (#7).
- **`access` is untyped text.** The column is plain `text`, not a pg enum, and `ACCESS_RANK` falls back
  to `0` for anything unrecognized — a typo'd value silently resolves as the weakest grant.
- **The disk-space widget hardcodes a hostname.** `/cloud/files/+page.svelte` fetches
  `https://homelab.tail3fdd8a.ts.net:8080/cloud/api/disk-space` as an absolute URL rather than the
  relative route, so the widget is tied to one deployment.
- **`hasAccess()` and `assemble()` are unused** — both superseded (by `getAccessLevel` and
  `streamChunksInOrder` respectively) but still exported.
- **No sharing feature** (public links, `/share`) exists and none is planned in the current tickets.
- **"Crypto" in this codebase is not encryption** — the `computeTransferId`/`generateUUID` fallbacks
  exist only because `crypto.subtle`/`crypto.randomUUID` are unavailable on plain-HTTP (non-secure)
  origins; there is no application-level encryption layer.
