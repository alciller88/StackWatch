# Changelog

All notable changes to StackWatch are documented here.
See [SPEC.md](./SPEC.md) for full technical details.

## [0.12.1](https://github.com/alciller88/StackWatch/compare/v0.12.0...v0.12.1) (2026-03-19)

### Fixed
- Drag & drop now shows ScanProgress and Cancel button — scan progress takes priority over active panel
- Progress bar no longer regresses — forward-only interpolation at 20fps with smooth easing
- Phase messages display for minimum 800ms to be readable on fast scans
- Extractor emits progress every 50 files for granular updates on large repos
- Rebalanced pipeline phase weights — extraction gets 5-45% (was 5-20%), reflecting actual scan time

---

## [0.12.0](https://github.com/alciller88/StackWatch/compare/v0.11.1...v0.12.0) (2026-03-19)

### Added
- Dashboard always visible in Sidebar as first nav item ("Home")
- "Close Stack" button in Sidebar — clears all state and returns to Dashboard with confirmation dialog
- Drag & drop folder to scan from any panel — full-window overlay with accent border
- Dashboard hint: "or drag & drop a folder anywhere on this window"

### Fixed
- Cancel scan now returns to Dashboard instead of empty Services panel (or Services if partial results exist)
- Critical scan errors now return to Dashboard with descriptive toast instead of showing empty panels

### Tests
- 548 tests across 41 suites

---

## [0.11.1](https://github.com/alciller88/StackWatch/compare/v0.11.0...v0.11.1) (2026-03-19)

### Fixed
- Layer nodes no longer disappear when editing a service from ServicesPanel — `updateManualService` uses incremental `graphStore.updateServiceNode()` instead of full graph rebuild
- "Needs review" badge now shows `confidenceReasons` explaining what fields to complete; falls back to generic message when reasons are empty
- Editing confidence to 'high' from FlowGraph NodeEditPanel now clears `needsReview` — no need to re-edit from ServicesPanel
- ServiceForm preserves existing service metadata (`evidenceSummary`, `confidenceReasons`, `aiContext`, `zombieStatus`) when editing
- Connection line now visible when dragging to create edges in FlowGraph — added `connectionLineStyle` with accent color and dashed stroke

### Architecture
- `shouldNeedReview()` helper in `src/utils/serviceValidation.ts` — centralized review logic used by both ServicesPanel and FlowGraph
- `graphStore.updateServiceNode(serviceId, data)` — incremental node update by serviceId without touching layer nodes

### Tests
- 540+ tests across 40 suites (+16 new: 5 serviceValidation, 3 graphStore updateServiceNode, 5 NodeEditPanel, 3 ServiceCard needsReview)

---

## [0.11.0](https://github.com/alciller88/StackWatch/compare/v0.10.10...v0.11.0) (2026-03-18)

### Features
- **Style Editor** in Settings — full graph color customization with real-time preview
  - Connection type colors (data, auth, payment, webhook) saved in config
  - Node type colors (user, cdn, frontend, api, database, external) saved in config
  - Layer node colors (user, frontend, backend, custom) saved in config
  - Theme overrides (accent, background, text) saved locally per user

### Architecture
- `stylesStore` (6th Zustand store) for centralized color state

### Refactor
- `flowUtils.ts` `getNodeColor()`/`getEdgeColor()` accept `GraphStyles` parameter — zero hardcoded colors
- `graphStore` `buildNodeStyle()`/`buildEdgeStyle()` read from `stylesStore`

### Tests
- 523+ tests across 38 suites

---

## [0.10.10](https://github.com/alciller88/StackWatch/compare/v0.10.9...v0.10.10) (2026-03-18)

### Added
- Splash screen shown during app startup — eliminates blank window while renderer loads. Inline SVG logo with animated loading indicator, no external dependencies.
- SECURITY.md with vulnerability reporting process, scope, security features and known limitations
- GitHub security policy badge in README

### Fixed
- App name "StackWatch" verified across all platforms (taskbar, title, dock, about)
- Main window uses `show: false` until `ready-to-show` — no flash of blank window

---

## [0.10.9](https://github.com/alciller88/StackWatch/compare/v0.10.8...v0.10.9) (2026-03-18)

### Added
- Playwright E2E test infrastructure (`playwright.config.ts`, `e2e/app.test.ts`) covering app launch, navigation, panel switching
- `data-testid` attributes on critical elements: stack-score, service-card, scan-progress, nav items
- WCAG 2.1 AA accessibility improvements:
  - `aria-sort` on sortable table headers in DepsPanel
  - `aria-live` region announcing filtered service count in ServicesPanel
  - `role="alert"` on error messages in TopBar
  - `aria-label` on all icon-only buttons in TopBar and Sidebar
  - `aria-pressed` on category/type filter toggle buttons
  - Keyboard support (Enter/Space) on DepsPanel sortable headers

---

## [0.10.8](https://github.com/alciller88/StackWatch/compare/v0.10.7...v0.10.8) (2026-03-18)

### Added
- Tests for 18 previously uncovered IPC handlers (window controls, AI settings, exports, check-link-status, generate-sbom, score history, connectivity)
- Tests for toastStore and dialogStore (auto-dismiss, custom timeout, promise resolution)
- Coverage scope expanded to include `electron/config/**` and `shared/**`

### Changed
- Coverage exclusion of `electron/main.ts` documented with justification (requires Electron runtime; IPC logic covered via mocked handlers)

---

## [0.10.7](https://github.com/alciller88/StackWatch/compare/v0.10.6...v0.10.7) (2026-03-18)

### Added
- Offline mode detection via Electron `net.isOnline()` — vulnerability scan and GitHub analysis return descriptive errors when offline
- `get-connectivity` IPC channel for renderer to check connectivity status
- Config schema migration system (`electron/config/migrations.ts`) — automatic migration chain applied on config load
- Snapshot versioning in `.stackwatch/last-scan.json` — stale/incompatible snapshots ignored gracefully
- `shared/configLoader.ts` — unified config loading for CLI and Electron (no more duplicated `fs.readFileSync`)

### Fixed
- GitHub Action example in README now pins to specific version tag instead of `@main`
- Vuln scan offline returns `{ error: 'requires internet' }` instead of hanging 15s

---

## [0.10.6](https://github.com/alciller88/StackWatch/compare/v0.10.5...v0.10.6) (2026-03-18)

### Fixed
- All hardcoded hex colors replaced with CSS variables — light/dark mode now consistent across DepsPanel, ServiceCard, CostsPanel, FlowGraph, Settings
- Unjustified `any` types replaced with `Record<string, unknown>` or proper types in main.ts, deepAnalyzer.ts, alternativeSuggester.ts; remaining `as any` annotated with justification
- Magic numbers extracted to named constants: `SCORE_GREEN_THRESHOLD`, `SCORE_YELLOW_THRESHOLD`, `MAX_VULNS_PER_DEP`, `MAX_SUMMARY_LENGTH`, `TOAST_DURATION_MS`, `TOAST_ERROR_DURATION_MS`, `DEBOUNCE_PERSIST_MS`, `DEBOUNCE_SCORE_MS`
- `react-hooks/exhaustive-deps` disable in FlowGraph.tsx now has justification comment
- `noUncheckedIndexedAccess` enabled in both tsconfig files — array/object index access now type-safe at compile time
- CI workflow now verifies version consistency on every build

### Added
- CSS variables `--color-info`, `--color-info-bg`, `--color-info-border`, `--color-danger-bg` in both dark and light themes

---

## [0.10.5](https://github.com/alciller88/StackWatch/compare/v0.10.4...v0.10.5) (2026-03-18)

### Security
- AI provider `baseUrl` now blocks cloud metadata IPs (169.254.x.x, GCP metadata, Alibaba) — localhost still allowed for Ollama/LM Studio
- Symlink traversal prevention: symlinks outside repo root detected and skipped; circular symlinks detected via visited paths set
- Service names sanitized before AI prompt interpolation to prevent prompt injection (`electron/ai/sanitize.ts`)
- File size limit: files >1MB skipped in extractor to prevent memory exhaustion
- AI response size capped at 10MB — `response.json()` replaced with `response.text()` + size check + `JSON.parse()`
- Rate limiting extended to `test-ai-connection` (3/10s), `check-link-status` (5/10s), `export-html` (5/10s)

### Added
- `electron/ai/sanitize.ts`: `sanitizeForPrompt()` strips control chars, truncates to 200 chars

---

## [0.10.4](https://github.com/alciller88/StackWatch/compare/v0.10.3...v0.10.4) (2026-03-18)

### Fixed
- Concurrent scan guard: second scan attempt throws error instead of corrupting state (`scanInProgress` flag in main.ts)
- OSV.dev vulnerability scanner now uses exponential backoff on HTTP 429 with 200ms delay between batches; shows partial result warning to user
- 27 silent catch blocks now log `console.warn`/`console.error` or have justification comments — no more empty `catch {}`
- `graphStore.persistToConfig` now catches `saveConfig` errors instead of leaving unhandled promise rejections
- `historyStore` memory usage reduced with dynamic snapshot limits based on graph size (10/25/50 snapshots for large/medium/small graphs)
- Monorepo scanner limited to 500 packages via `MAX_WORKSPACE_PACKAGES` to prevent hangs on massive workspaces

### Stability
- `VulnScanResult` type with `partial` flag and `error` message — renderer shows toast when results are incomplete
- Scan cancellation now also resets `scanInProgress` flag

---

## [0.10.3](https://github.com/alciller88/StackWatch/compare/v0.10.2...v0.10.3) (2026-03-18)

### Fixed
- APP_VERSION now reads from package.json via Vite `define` instead of hardcoded constant — UI always shows correct version
- Zod validation added to `check-link-status` IPC handler (was accepting unvalidated UserConfig objects)
- safeStorage unavailability now shows warning dialog at startup and banner in Settings instead of silent `console.warn`
- `NodeEditPanel` changed `aria-modal` from `"false"` to `"true"`, added focus trap

### Security
- All 27 IPC handlers now validated or documented as no-args — no unvalidated input paths remain
- `.passthrough()` usage in Zod schemas documented with justification comments
- `get-encryption-status` IPC channel exposes safeStorage availability to renderer for UI warnings

### Accessibility
- `ScanProgress`: added `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- `DepsPanel`: table rows now keyboard navigable with `tabIndex`, `onKeyDown` (Enter/Space), `role="row"`, `aria-label`
- `NodeEditPanel`: `aria-modal="true"`, focus trap cycling Tab/Shift+Tab within dialog

---

## [0.10.2](https://github.com/alciller88/StackWatch/compare/v0.10.1...v0.10.2) (2026-03-18)

### Bug Fixes
- **Vulnerability scan button broken**: Zod validation schema for `scan-vulnerabilities` IPC was missing `ecosystem` field — Zod stripped it during parsing, causing `vulnScanner` to filter out all dependencies and silently return empty results
- **Scan progress stuck at 0% on large repos**: pipeline emitted no progress events until after `detectMonorepo()` and `extractEvidences()` completed — added immediate progress emission, granular file-processing updates, and `AbortSignal` checks throughout extraction
- **Vuln button text not resetting on project switch**: `vulnScanned` and `vulnResults` were not cleared when scanning a new repo or importing a config — button now correctly shows "Scan vulns" instead of "Re-scan" after switching projects

### Improvements
- Monorepo scanning now shows per-package progress (`Scanning package 3/12...`)
- File extraction shows incremental progress (`Processing files (150/800)...`)
- Scan cancellation now works during monorepo detection and file extraction phases

### Tests
- Updated `scanVulnerabilities` validation tests to include `ecosystem` field

---

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
