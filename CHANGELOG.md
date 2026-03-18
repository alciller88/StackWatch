# Changelog

All notable changes to StackWatch are documented here.
See [SPEC.md](./SPEC.md) for full technical details.

## [0.10.1](https://github.com/alciller88/StackWatch/compare/v0.10.0...v0.10.1) (2026-03-18)

### Type Safety
- Reduced `any` instances from 24 to 17 — typed `TypedStore` interface (`unknown` instead of `any`), vulnScanner response types, IPC event types
- Remaining instances annotated with justification (catch clauses, electron-store constructor, AI JSON responses)

### Performance
- **NodeEditPanel**: refactored from 11 `useState` to `useReducer` — single state update per user action
- **ServiceCard**: wrapped in `React.memo` with shallow prop comparison — skips re-render when service data unchanged
- **historyStore**: `pushSnapshot` skips duplicate snapshots via reference equality check before `structuredClone`
- Memoized `handleEdit`/`handleCloseForm` callbacks in ServicesPanel with `useCallback`

### Security
- IPC rate limiter (`electron/ipcRateLimiter.ts`) throttles high-frequency channels: `save-config` 10/s, `set-ai-settings` 2/s, `scan-vulnerabilities` 1/30s

### Developer Experience
- CHANGELOG.md automation via `conventional-changelog-cli` (`npm run changelog`)
- `coverage/` directory added to `.gitignore`

### Tests
- 487 tests across 36 suites (+6 IPC RateLimiter tests)

---

## [0.10.0](https://github.com/alciller88/StackWatch/compare/v0.9.1...v0.10.0) (2026-03-18)

### Architecture
- 4 specialized selector hooks (`analysisStore`, `servicesStore`, `configStore`, `uiStore`) for optimized re-renders — components import only the state slice they need
- Zero dynamic `require()` in `src/store/` — all cross-store communication via registered callbacks (verified with grep)

### Performance
- **ServicesPanel** virtualized with `@tanstack/react-virtual` — only visible card rows rendered in DOM, handles 100+ services without lag
- **Dagre layout cache** in `graphStore` — `hashStructure()` fingerprints node/edge IDs, skips O(V^2+E) recalculation when structure unchanged (position drags and field edits are free)

### Stability
- **PanelErrorBoundary** — per-panel error boundaries with "Reload panel" and "Report issue" buttons; error in FlowGraph doesn't crash ServicesPanel or Sidebar

### Security
- `sanitizeToken()` with regex-safe character escaping replaces fragile `String.replaceAll()` for token redaction in error messages

### Tests
- 481 tests across 35 suites (+11 new: 5 PanelErrorBoundary, 6 Dagre Cache)

---

## [0.9.1](https://github.com/alciller88/StackWatch/compare/v0.9.0...v0.9.1) (2026-03-18)

### Testing
- **IPC handler tests** (22 tests) — `analyze-local` validation and filesystem round-trip, `analyze-github` auth flows, `save-config`/`load-config` with real temp directories, `open-external-url` protocol enforcement, `cancel-scan` safety
- **Encryption tests** (8 tests) — `encryptValue`/`decryptValue` round-trip, safeStorage unavailable fallback, corrupted base64 recovery, store corruption auto-recovery, legacy migration logic
- **GitHub auth tests** (20 tests) — repo format validation (dots, hyphens, slashes), token handling (empty/whitespace/undefined/too-long), Octokit initialization logic, rate limiting flag behavior, error message token sanitization
- **Concurrency tests** (16 tests) — mutex acquire/release serialization, exception safety in `finally`, 5 concurrent `addService` without data loss (vs proof that unlocked version loses data), `deleteService` graph consistency, rapid update serialization

### CI
- Coverage thresholds enforced via `@vitest/coverage-v8` — 60% statements/functions, 50% branches, 60% lines
- `npm run test:coverage` script added to package.json
- Coverage step added to `.github/workflows/build.yml`

### Tests
- 470 tests across 33 suites (+58 new tests, +4 new suites)

---

## [0.9.0](https://github.com/alciller88/StackWatch/compare/v0.8.0...v0.9.0) (2026-03-18)

### Security
- **safeStorage encryption** replacing deterministic key derivation — delegates to OS keychain (macOS Keychain, Windows DPAPI, Linux libsecret/kwallet). Silent migration from legacy format on startup. Fallback to unencrypted with console warning if keychain unavailable.
- **Zod IPC validation** — all 15+ IPC handler arguments validated via `electron/validation.ts` before any logic runs. Rejects malformed inputs with structured error messages.
- **Race condition fixes** — `AsyncMutex` serializes multi-store mutations (`addService`, `updateService`, `deleteService`). All cross-store communication uses registered callbacks (`registerServiceGetter`, `registerServiceDeleter`, `registerRepoPathGetter`, `registerScoreRecalculator`) instead of dynamic `import()`.
- **electron-builder** upgraded from v25 to v26 — 0 HIGH/CRITICAL CVEs in `npm audit`
- AI API keys encrypted with `safeStorage` before storing (not just electron-store encryption)

### Stability
- Global `unhandledRejection` and `uncaughtException` handlers in main process prevent crashes; errors logged and shown to user via dialog
- npm audit check added to `validate-build.js` (32 total validation checks)

### Tests
- 412 tests across 29 suites (+23 new validation and mutex tests)

---

## [0.8.0](https://github.com/alciller88/StackWatch/compare/v0.7.0...v0.8.0) (2026-03-18)

### Features
- **ServiceBilling** data model replacing legacy `cost`/`renewalDate` fields — `type` (manual/automatic/free), `period`, `amount`, `currency`, `nextDate`, `lastRenewed`
- **8 binary Stack Score checks** (5 security + 3 completeness): score = passing/applicable x 100
- Renewal tracking with per-billing-type thresholds (automatic monthly excluded, manual yearly 30d, etc.)
- `billing.ts` utilities: `calculateNextDate`, `renewService`, `getRenewalThreshold`, `getMonthlyAmount`
- ScoreBreakdown panel in Sidebar showing N/M checks passing
- CostsPanel split into auto-renewing vs manual renewal sections
- ServiceForm with billing type/period/amount/nextDate/lastRenewed fields

### Tests
- 389 tests across 27 suites (+17 new billing and healthScore tests)

---

## [0.7.0](https://github.com/alciller88/StackWatch/compare/v0.6.0...v0.7.0) (2026-03-18)

### Features
- Semantic color CSS variables (`--color-danger`, `--color-success`, `--color-warning`, `--color-badge-bg/border-*`) with dark/light variants, replacing ~40 hardcoded hex colors across 15 components
- WCAG AA contrast compliance: `--color-text-secondary` and `--color-text-muted` adjusted to 4.5:1 ratio in both themes
- `TypedStore<StoreSchema>` interface for electron-store (replaces `any` typing)
- Serialized write lock in `graphStore.persistToConfig` preventing race conditions from overlapping debounced writes
- `registerServiceGetter()` callback pattern replacing `require()` circular dependency between graphStore and useStore
- ContextMenu keyboard navigation (ArrowDown/ArrowUp between items, auto-focus first item)
- Unified panel headers, search icon consistency, Tailwind-only hover handlers

---

## [0.6.0](https://github.com/alciller88/StackWatch/compare/v0.5.0...v0.6.0) (2026-03-17)

### Features
- Scan progress screen with real-time pipeline updates (CRT animation, phase text, counters) and AbortController cancellation
- Reactive Stack Score recalculation after every service/graph mutation with debounced history persistence
- Blank Stack mode: empty canvas with USER layer node, manual architecture building without a repo

---

## [0.5.0](https://github.com/alciller88/StackWatch/compare/v0.4.0...v0.5.0) (2026-03-17)

### Features
- Sensitive field encryption (`$encrypted:` references in config JSON, real values in electron-store)
- Evidence info popover on ServiceCard (score breakdown per evidence type)
- Graph diff visual highlighting (new nodes green, removed nodes grey with fade-out)
- Release automation: CI creates GitHub Release with platform binaries on version tag push

---

## [0.4.0](https://github.com/alciller88/StackWatch/compare/v0.3.0...v0.4.0) (2026-03-17)

### Features
- Layer node type for organizational graph nodes (User, Frontend, Backend, grouping)
- Discarded panel: virtualized list of items filtered during analysis with restore capability
- Scan mode dialog: Merge vs Fresh Scan for repos with saved data
- AI false-positive filter (Step 0): reviews ALL services including high-confidence

---

## [0.3.0](https://github.com/alciller88/StackWatch/compare/v0.2.0...v0.3.0) (2026-03-17)

### Features
- Static HTML export (self-contained report, CLI `--html`, print-friendly)
- AI stack alternatives (cheaper/open-source suggestions per service)
- Zombie UI badges and activity filter in ServicesPanel
- Doctor modal and CLI subcommand (health checklist with live vuln scan)
- Light/dark theme toggle with CSS variable system

---

## [0.2.0](https://github.com/alciller88/StackWatch/compare/v0.1.0...v0.2.0) (2026-03-17)

### Features
- Zombie service detection via git log (active/stale/zombie classification)
- Stack Score history with trend tracking and Recharts line chart modal
- Budget mode in CostsPanel (monthly budget, progress bar, threshold alerts)
- Cost visualization with Recharts horizontal bar chart

---

## [0.1.0](https://github.com/alciller88/StackWatch/releases/tag/v0.1.0) (2026-03-16)

### Features
- Semantic heuristic detection engine with evidence scoring (no hardcoded service lists)
- AI deep analysis: false-positive filter, service context, hidden detection, smart edge types
- CLI with scan, init, badge, `--diff`, `--sbom`, `--fail-on-vulns`, `--fail-on-unreviewed`
- GitHub Action with PR comment posting
- Vulnerability scanning via OSV.dev (8 ecosystems)
- SBOM generation (CycloneDX 1.5, SPDX 2.3)
- Monorepo support (npm, pnpm, lerna, turbo, nx)
- Cross-platform builds (macOS, Windows, Linux)
