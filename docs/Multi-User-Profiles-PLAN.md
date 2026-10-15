# Multi-user portfolio layouts and modules: plan

Status: agreed design, not yet implemented. Backend work happens in the sibling `honba` repo (approved).

## Decisions (confirmed)
- **Storage:** backend (`honba serve`), one profile per user.
- **Identity:** backend bearer tokens. A user is a token's `token_id` (`crates/honba-api-rest/src/auth.rs`). With no tokens file, everything runs as a single `default` user.
- **Authorization:** any valid token manages **its own** profile. No new scope is required, and a token can never read or write another token's profile.
- **Module:** a named **collection of sources** (data sources and feeds, for example a broker adapter, a symbol list, a bars directory). A module is not a UI panel. A layout can reference modules by id.
- **Profile contents:**
  - Workbench grid and the symbol and timeframe in each pane.
  - Module definitions and which modules are enabled.
  - Watchlists and shortlisted symbols.
  - Preferences and theme (market country, theme, indicators).

## Backend (honba, Rust, `honba-api-rest`)
1. Profile store: one JSON file per `token_id` in a profiles directory (new `--profiles-dir` flag, default next to the journals dir). The `default` user is used when auth is off. Writes are atomic (write to a temp file, then rename). User ids are sanitized to prevent path traversal.
2. Routes, each resolving the user from the validated token:
   - `GET /profile` and `PUT /profile` for the whole profile.
   - `GET /profile/layouts`, and `PUT` / `DELETE /profile/layouts/{name}` for named layouts.
   - `GET /profile/modules`, and `PUT` / `DELETE /profile/modules/{id}`.
3. Concurrency: each profile carries a `revision`. `PUT` requires the current revision and answers 409 on a mismatch.
4. Add the routes to the `auth.rs` route table as "any valid token". Add them to the OpenAPI and codegen endpoint lists.
5. Tests in the existing style: per-user isolation, 409 on a stale revision, default user with auth off, and rejection of a hostile `token_id`.

## Codegen
`npm run codegen` (runs `make -C ../honba schema client`) to regenerate `src/core/api/generated/client.ts`.

## Frontend (honba-frontend)
1. `profile-store`: loads `/profile` on start and debounce-saves changes, keeping the localStorage fallback when the backend is offline. This replaces the current `/api/user/preferences` calls in `src/core/user-preferences.ts`, which have no backend route.
2. Wire the workbench store (layout and panes), the watchlists and shortlists in `data-layer.ts`, and the preferences into it.
3. A Layouts menu in the workbench toolbar to save, load and delete named layouts.
4. A Modules view to create a module as a named collection of sources, enable or disable it, and attach it to a layout.
5. A token field in settings. The token is sent as `Authorization: Bearer`. The Vite proxy already forwards headers.

## Execution order (one small chunk at a time, one subagent at a time)
1. Rust profile store plus tests.
2. Rust routes plus auth table plus tests.
3. Codegen.
4. Frontend profile-store plus wiring.
5. Layouts menu.
6. Modules view and token settings.
7. Independent review pass after the Rust work and again at the end.

Each step is committed on its own, touching only the files for that step, with no Co-Authored-By trailer.

## Open questions
- Which concrete source kinds should a module support first (broker adapter, symbol list, Parquet directory)?
- Should layouts be shareable between users later? This design keeps them strictly private.
