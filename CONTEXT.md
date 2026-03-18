# CONTEXT.md — StackWatch v0.10.6

> Operational context for AI agents. NOT a changelog, NOT user documentation.
> Read this before writing any code. Update after structural changes.
> Full spec: `SPEC.md` · User docs: `README.md`

---

## Project overview

**StackWatch** scans codebases and maps every external service, dependency, and paid account. Ships as Electron desktop app + CLI + GitHub Action.

| Layer        | Stack                                                            |
|------------- |------------------------------------------------------------------|
| Desktop      | Electron 35, React 19, Vite 6, TypeScript 5.7, Tailwind 4       |
| State        | Zustand 5 (5 stores + 4 selector hooks), React Flow 11, Recharts 3 |
| CLI          | `npx stackwatch [path]` — same heuristic engine, no Electron    |
| GitHub Action| `alciller88/StackWatch@main` — posts PR comments with results   |
| Config       | `stackwatch.config.json` in scanned repo (not this repo)        |
| Persistence  | `electron-store` + `safeStorage` (OS keychain: DPAPI/Keychain/libsecret) |
| Validation   | `zod` schemas on all IPC handlers                                |
| Tests        | 487 tests, 36 suites — vitest + @testing-library/react + jsdom  |

---

## Entry modes

| Mode              | Behavior                                                                                              |
|-------------------|-------------------------------------------------------------------------------------------------------|
| **Scan**          | Analyze from code. Saved data triggers ScanModeDialog: Merge (keep manual + graph) or Fresh Scan. Detects monorepos. |
| **Blank Stack**   | Empty canvas with USER layer node. No repo. Manual architecture building. TopBar shows "Untitled Stack". |
| **Import config** | Full restore from exported JSON — services, graph layout, edges, positions.                           |
| **CLI / Action**  | Headless scan. `--fail-on-vulns` (exit 1), `--fail-on-unreviewed` (exit 2) for CI gates.             |

---

## Analysis pipeline

```
extractor.ts → heuristic.ts → deduplicator.ts → [AI filter] → [AI refine] → [AI deep + alternatives] → zombieDetector.ts → flowInference.ts
     │                                                                                                        │
     ├── Evidences (env vars, imports, URLs, configs)                                                         ├── FlowNodes
     ├── Dependencies (npm, pip, cargo, go, etc.)                                                             └── FlowEdges
     └── Monorepo detection (workspaces, pnpm, lerna, turbo, nx)
```

Pipeline emits `scan-progress` IPC at each phase. Supports `AbortSignal` for cancellation. **Only one scan at a time** — `scanInProgress` flag rejects concurrent attempts.

**Heuristic scoring** (no hardcoded service maps):

| Evidence type                 | Base score | Penalties                                         |
|-------------------------------|:----------:|---------------------------------------------------|
| `config_file`                 | 10         | Config suffix (_ENABLED, _INTERVAL, etc.): -5     |
| `ci_secret`                   | 8          | Descriptive phrase (>2 words): -3                  |
| `env_var` credential          | 7          | Project name match: -10                            |
| `env_var` endpoint            | 6          |                                                    |
| `url`                         | 5          |                                                    |
| `env_var` generic             | 2          |                                                    |
| `import` / `npm_package`      | 1          |                                                    |

**Thresholds**: <6 discard, 6-10 low/needsReview (AI validates), >10 high confidence.
**Deduplication**: best-score-per-unique-evidence-type (not additive per instance), brand collapse, generic entry removal.

**AI mode** (optional, silent fallback on failure):
- Filter false positives (all services, catches generic names even at high confidence)
- Refine (medium/low only)
- Deep analysis: usage context, hidden services, edge types, alternative suggestions
- GitHub scans return `scoreEntry` (parity with local scans)

---

## Critical invariant: Service <-> Graph Node 1:1

Every service MUST have a corresponding graph node. Enforced by:
1. `flowInference.ts` creates a node per service
2. `useStore.ensureFlowNodes()` adds nodes for manual services missing from pipeline
3. Deleting a graph node removes the linked service from useStore and config

**Never** filter services out of the graph. **Never** create services without nodes.

Layer nodes (type: `'layer'`) are organizational — they do NOT represent services. The 1:1 invariant only applies to service nodes. Old types `'user'`, `'frontend'`, `'api'` kept in union for backward compat but are no longer produced.

---

## Architecture

### Process model

```
┌──────────────────────────────────────────────┐
│ Main Process (electron/main.ts)              │
│  ├── IPC handlers (27 channels, all validated) │
│  ├── electron-store (typed: Store<StoreSchema>) │
│  ├── Analyzers (pure Node.js)                │
│  ├── AI client (OpenAI-compatible)           │
│  ├── Vuln scanner (OSV.dev API)              │
│  ├── SBOM generator (CycloneDX/SPDX)        │
│  ├── Stack Diff, Zombie detector, Score history │
│  ├── HTML exporter (self-contained report)   │
│  ├── Renewal notifications (Electron)        │
│  └── CSP headers (production only)           │
├──────────────────────────────────────────────┤
│ Preload (electron/preload.ts)                │
│  └── contextBridge — exposes StackWatchAPI   │
├──────────────────────────────────────────────┤
│ Renderer (src/)                              │
│  ├── 5 stores: useStore, graphStore,         │
│  │   dialogStore, toastStore, historyStore   │
│  ├── 6 panels + settings + scan progress     │
│  ├── Theme system (dark/light via CSS vars)  │
│  └── Undo/redo (Ctrl+Z / Ctrl+Shift+Z)      │
└──────────────────────────────────────────────┘
```

### Stores

| Store          | Purpose                       | Key details                                                                                                                     |
|----------------|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| `useStore`     | Services, deps, config, AI, theme, score, budget, mode | Single Zustand store with 4 specialized selector hooks: `useAnalysisState/Actions`, `useServicesState/Actions`, `useConfigState/Actions`, `useUIState/Actions`. Import selectors for better re-render performance. |
| `graphStore`   | React Flow nodes/edges, excluded services | `persistToConfig` debounced 500ms with **serialized write lock**. Dagre layout cache (skips recalc when structure unchanged). Registered callbacks — no dynamic `import()`. |
| `historyStore` | Undo/redo                     | Past/future stacks, dynamic limit (50/25/10 for small/medium/large graphs). Captures nodes + edges + services.                 |
| `dialogStore`  | Confirm dialogs               | Promise-based, returns button value string.                                                                                     |
| `toastStore`   | Notifications                 | Auto-dismiss 4s. Animation keyframes defined in CSS (slide-in-from-right + fade-in).                                            |

### Type system

```
shared/types.ts          ← canonical: SERVICE_CATEGORIES const, all interfaces
  ↗ src/types.ts         ← re-exports + Window.stackwatch
  ↗ electron/types.ts    ← re-exports
```

`SERVICE_CATEGORIES` is a `const` array — the `ServiceCategory` union is derived from it. NO duplicated category list. `Vulnerability` and `DepVulnResult` live in `shared/types.ts` only.

**Build artifact warning**: if stale `shared/types.js` appears in repo root, delete it (gitignored, breaks Vite).

### Security model

| Area              | Implementation                                                                                      |
|-------------------|-----------------------------------------------------------------------------------------------------|
| Encryption        | `safeStorage` (OS keychain: macOS Keychain, Windows DPAPI, Linux libsecret/kwallet). Fallback to unencrypted with **startup warning dialog + Settings banner** if unavailable. `get-encryption-status` IPC exposes availability to renderer. Auto-migration from legacy deterministic key. |
| IPC validation    | `zod` schemas validate all IPC handler arguments in `electron/validation.ts` before any logic runs. |
| CSP               | Production-only via `session.webRequest.onHeadersReceived`. Disabled in dev for Vite HMR.           |
| External URLs     | All via IPC `open-external-url` → zod-validated (http/https only) → `shell.openExternal()`.         |
| Path validation   | `validateRepoPath()` checks for `..` traversal via regex before resolving.                          |
| Secrets           | GitHub tokens and AI API keys encrypted with `safeStorage` in electron-store, never in config JSON. |
| Config encryption | Sensitive fields (`accountEmail`, `owner`, `notes`) as `$encrypted:` refs in JSON; real values encrypted with `safeStorage` in electron-store. |
| Context isolation | `contextIsolation: true`, `nodeIntegration: false`, all IPC via contextBridge.                      |
| Race conditions   | `AsyncMutex` serializes multi-store operations (add/update/delete service). Registered callbacks replace dynamic `import()` in cross-store communication. |
| AI provider SSRF  | `baseUrl` blocks cloud metadata IPs (169.254.x.x, GCP, Alibaba). Localhost allowed for Ollama/LM Studio. |
| File size limits  | Extractor skips files >1MB. AI responses capped at 10MB.                                            |
| Symlink traversal | `walkRepo` resolves symlinks, skips those outside root, detects circular links via visited set.      |
| Prompt injection  | `sanitizeForPrompt()` strips control chars and truncates before AI prompt interpolation.              |
| Error handling    | Global `unhandledRejection` and `uncaughtException` handlers prevent main process crashes.          |

---

## Key files

### Electron (main process)

| File                                    | Purpose                                                                          |
|-----------------------------------------|----------------------------------------------------------------------------------|
| `electron/main.ts`                      | Entry, IPC handlers, safeStorage encryption, CSP, window management, global error handlers |
| `electron/validation.ts`                | Zod schemas + validate() helper for all IPC handler arguments                    |
| `electron/ipcRateLimiter.ts`            | Rate limiter for high-frequency IPC channels (save-config, scan-vulnerabilities) |
| `electron/preload.ts`                   | IPC bridge via contextBridge (StackWatchAPI)                                      |
| `electron/analyzers/index.ts`           | Pipeline orchestrator. Monorepo-aware. Emits scan-progress. AbortSignal support. |
| `electron/analyzers/extractor.ts`       | Evidence extraction: env vars, imports, URLs, configs, deps                      |
| `electron/analyzers/heuristic.ts`       | Semantic scoring, 19 categories, hard filters, penalties                         |
| `electron/analyzers/deduplicator.ts`    | Service grouping, best-score-per-type, brand collapse, discarded tracking        |
| `electron/analyzers/flowInference.ts`   | 4-layer hierarchical graph with dagre layout                                     |
| `electron/analyzers/monorepo.ts`        | Detects npm/pnpm/lerna/turbo/nx workspaces                                       |
| `electron/analyzers/vulnScanner.ts`     | OSV.dev batch API (8 ecosystems, groups of 100)                                  |
| `electron/analyzers/stackDiff.ts`       | Snapshot compare (.stackwatch/last-scan.json)                                    |
| `electron/analyzers/sbom.ts`            | CycloneDX 1.5 / SPDX 2.3 JSON from dependencies                                |
| `electron/analyzers/zombieDetector.ts`  | Git log activity per service, stale/zombie classification                        |
| `electron/analyzers/scoreHistory.ts`    | Persist health scores to .stackwatch/score-history.json                           |
| `electron/ai/deepAnalyzer.ts`           | AI: filter, refine, context, hidden detection, edge types                        |
| `electron/ai/alternativeSuggester.ts`   | AI: cheaper/open-source alternative suggestions                                  |
| `electron/ai/sanitize.ts`              | Prompt injection prevention: `sanitizeForPrompt()`                               |
| `electron/ai/provider.ts`              | OpenAI-compatible client + 3 provider presets                                    |
| `electron/exporters/htmlExporter.ts`    | Self-contained HTML report (dark theme, print-friendly)                          |

### Renderer (src/)

| File                            | Purpose                                                           |
|---------------------------------|-------------------------------------------------------------------|
| `src/App.tsx`                   | Layout, panel routing, undo/redo, skeleton switching              |
| `src/store/useStore.ts`        | Global state, analysis flow, service CRUD, theme, budget, score   |
| `src/store/analysisStore.ts`   | Selector hooks for analysis pipeline state                        |
| `src/store/servicesStore.ts`   | Selector hooks for services/deps/score state                      |
| `src/store/configStore.ts`     | Selector hooks for config/AI/budget state                         |
| `src/store/uiStore.ts`         | Selector hooks for UI state (panels, theme, modals)               |
| `src/store/graphStore.ts`      | React Flow state, debounced persist, dagre cache, registered callbacks |
| `src/store/mutex.ts`           | AsyncMutex for serializing multi-store operations                 |
| `src/store/historyStore.ts`    | Undo/redo snapshots (50 max)                                      |
| `src/store/toastStore.ts`      | Toast notifications (4s auto-dismiss)                             |
| `src/store/dialogStore.ts`     | Promise-based confirm dialog                                      |
| `src/utils/healthScore.ts`     | Stack Score via 8 binary checks (security + completeness). Score = passing/applicable × 100 |
| `src/utils/billing.ts`         | ServiceBilling utilities: calculateNextDate, renewService, getRenewalThreshold, getMonthlyAmount |
| `src/themes.ts`                | Dark/light theme CSS variable definitions + semantic colors       |
| `src/components/ServicesPanel/` | Virtualized card grid (@tanstack/react-virtual), zombie badges, confidence, evidence popover, activity filter |
| `src/components/PanelErrorBoundary.tsx` | Per-panel error boundary with reload/report actions                |
| `src/components/DepsPanel/`    | Virtualized table (@tanstack/react-virtual), vuln scanning        |
| `src/components/DiscardedPanel/`| Virtualized list, reason filter, restore to manual service        |
| `src/components/FlowGraph/`    | React Flow canvas, context menu (arrow key nav), node edit (with billing fields, viewport-clamped) |
| `src/components/ScoreBreakdown/`| Slide-in panel: 8 checks (security + completeness), actions, informational counts |
| `src/components/CostsPanel/`   | Cost breakdown, renewal alerts, bar chart, budget mode            |
| `src/components/ScanProgress/` | Real-time progress: CRT effect bar, phase text, cancel button     |
| `src/components/TopBar/`       | Import/export, share (dynamic badges), GitHub, re-analyze         |

### CLI & CI

| File           | Purpose                                                                       |
|----------------|-------------------------------------------------------------------------------|
| `cli/index.ts` | CLI: scan, init, badge, doctor, --diff, --sbom, --html, --all, CI gate flags |
| `action.yml`   | GitHub Action (composite): install, build CLI, scan, PR comment               |

---

## Build & run

| Command              | What it does                                      |
|----------------------|---------------------------------------------------|
| `npm run dev`        | Vite + Electron in dev mode with HMR              |
| `npm run build:prod` | TSC + Vite only (fast, no packaging)               |
| `npm run build:dist` | Full electron-builder (distributable)              |
| `npm run build`      | Alias for `build:dist`                             |
| `npm run build:cli`  | Build CLI to `dist-cli/`                           |
| `npm run validate`   | 29-point build validation                          |
| `npm run release`    | Validate, create git tag from package.json, push   |
| `npm test`           | vitest (487 tests, 36 suites)                      |
| `npm run test:coverage` | vitest with v8 coverage (thresholds: 60/60/50/60) |

### Release flow

1. Update `version` in `package.json`
2. Commit: `chore: bump version to vX.Y.Z`
3. `npm run release` — validates, tags, pushes
4. CI detects `v*` tag → test → build (3 platforms) → GitHub Release with binaries

| Platform | Assets                               |
|----------|--------------------------------------|
| macOS    | `.dmg` (universal), `.zip` (universal)|
| Windows  | `.exe` (NSIS installer), `.exe` (portable) |
| Linux    | `.AppImage`, `.deb`                  |

### Common pitfalls

| Problem                                  | Fix                                                   |
|------------------------------------------|-------------------------------------------------------|
| Stale `dist-electron/tsconfig.node.tsbuildinfo` | Delete and rebuild                              |
| Stale `shared/types.js` in repo root     | Delete (gitignored, breaks Vite)                      |
| `GH_TOKEN not set` in CI build           | Use `--publish never` in CI; release job handles it   |
| Blank screen on launch (packaged)        | `loadFile` needs `../..` from `__dirname` to app root |
| Missing `.icns`/`.ico`                   | Run `node scripts/generate-icons.js`                  |

---

## Tests

487 tests across 36 suites.

| Suite                   | Count | Suite                  | Count |
|-------------------------|:-----:|------------------------|:-----:|
| Heuristic               | 32    | IPC Handlers           | 22    |
| graphStore              | 27    | GitHub Auth            | 20    |
| vulnScanner             | 27    | useStore               | 19    |
| Extractor               | 26    | IPC Validation         | 18    |
| Deep Analyzer           | 24    | Concurrency            | 16    |
| Deduplicator            | 23    | Flow inference         | 17    |
| badge                   | 17    | htmlExporter           | 13    |
| TopBar                  | 13    | Deep Analyzer (runDeep)| 13    |
| zombieDetector          | 12    | monorepo               | 12    |
| historyStore            | 12    | ServiceCard            | 12    |
| healthScore             | 11    | alternativeSuggester   | 10    |
| ScanProgress            | 9     | Encryption             | 8     |
| scoreHistory            | 8     | ContextMenu            | 7     |
| scanDiff                | 7     | Pipeline               | 7     |
| DiscardedPanel          | 7     | Dagre Cache            | 6     |
| IPC RateLimiter         | 6     | PanelErrorBoundary     | 5     |
| AsyncMutex              | 5     | Pipeline Integration   | 4     |
| daysUntil               | 3     |                        |       |

---

## Patterns to follow

### Adding a new analyzer
1. Extraction logic in `electron/analyzers/extractor.ts`
2. Classification in `electron/analyzers/heuristic.ts` if needed
3. Tests in `electron/analyzers/__tests__/`
4. Pipeline picks up new evidence automatically

### Adding a new IPC channel
1. Zod schema in `electron/validation.ts`
2. Handler in `electron/main.ts` (call `validate()` before any logic)
3. Method in `electron/preload.ts`
4. Type in `StackWatchAPI` in `shared/types.ts`

### Adding a new panel
1. Component in `src/components/NewPanel/`
2. Panel type in `ActivePanel` union (`useStore.ts`)
3. Tab in `Sidebar.tsx`
4. Render in `App.tsx` `renderPanel()`
5. Skeleton in `Skeleton.tsx`

### Adding undo support
- `useHistoryStore.getState().pushSnapshot(label, { nodes, edges, services })` BEFORE the mutation
- Skip high-frequency ops (drag, resize, init)

---

## Anti-patterns (do NOT do these)

| Rule                                         | Reason                                         |
|----------------------------------------------|------------------------------------------------|
| No hardcoded service maps                    | Semantic heuristics detect new services without code changes |
| No `nodeIntegration: true`                   | All IPC via contextBridge                      |
| No `window.open()`                           | Use `shell.openExternal` via IPC               |
| No Google Fonts CDN                          | Fonts bundled in `src/assets/fonts/`           |
| No JS hover handlers                         | Use Tailwind `hover:` classes                  |
| No hardcoded hex colors in components        | Use CSS variables from `themes.ts` (--color-danger, --color-success, etc.) |
| No `shared/types.js` in repo root            | Delete if it appears (breaks Vite)             |
| No full Zustand store subscriptions          | Use specialized selector hooks (`useAnalysisState`, `useServicesState`, etc.) for better re-render performance |
| No synchronous fs in main process            | Use `fs.promises`                              |
| No assuming AI is available                  | Always fallback to heuristics                  |
| No using legacy cost/renewalDate fields      | Use `service.billing` (ServiceBilling). Legacy fields removed. |
| No skipping tsbuildinfo cleanup              | Stale cache breaks builds                      |
| No `: any` without justification             | Use typed alternatives or annotate with eslint-disable comment |
| No `mutex.acquire()` without try/finally     | Prevents deadlock if operation throws                          |
| No `.passthrough()` without justification comment | Document why extra fields are needed in Zod schemas       |
| No empty `catch {}` blocks                       | Always `console.warn`/`console.error` or justification comment |
| No concurrent scans                              | Check `scanInProgress` flag before starting a new scan    |
| No user strings in AI prompts without sanitize   | Use `sanitizeForPrompt()` from `electron/ai/sanitize.ts`  |
| No `fs.readFile()` without size check            | Use `readFileSafe()` in extractor (1MB limit)              |
| No `response.json()` on AI responses             | Read as text, check size (<10MB), then `JSON.parse()`      |
| No magic numbers                                 | Use constants from `src/constants.ts` (frontend) or `electron/analyzers/constants.ts` (pipeline) |
| No `eslint-disable` without justification        | Always add comment explaining exactly why the disable is needed |
| No `!` (non-null assertion) without comment      | `noUncheckedIndexedAccess` enabled — use `?.` or `??` instead, `!` only with proof |

---

## Architecture decisions (settled — do not reopen without reason)

| Decision                               | Rationale                                              |
|----------------------------------------|--------------------------------------------------------|
| Semantic scoring, not fixed maps       | Detects new services without code changes              |
| Optional AI with silent fallback       | Must work 100% offline                                 |
| OpenAI-compatible API format           | One format covers all providers                        |
| Separate graphStore from useStore      | Different lifecycle, interactive state                 |
| `registerServiceGetter()` callback     | Breaks circular dependency (no `require()`)            |
| Serialized write lock on persistToConfig| Prevents race conditions from overlapping writes      |
| safeStorage for encryption             | Machine-unique, no key in source                       |
| CSP production-only                    | Vite HMR needs inline scripts                          |
| Local fonts bundled                    | Works offline, no FOUC                                 |
| Zustand selectors in FlowGraph         | Prevents re-renders on drag                            |
| Semantic CSS variables for theming     | Swap vars at root, no component rewrites. WCAG AA contrast. |
| Theme in localStorage, not config      | User preference, not project-level setting             |
| Budget in UserConfig                   | Project-level setting, shared via config file          |
| ServiceBilling replaces cost/renewalDate | Richer billing model (type/period/amount/nextDate/lastRenewed) |
| Binary checks for Stack Score          | 8 pass/fail checks, score = passing/applicable × 100. No weighted percentages. |
| OSV.dev for vulns                      | Free, no API key, 8 ecosystems                         |
| @tanstack/react-virtual               | Handles 500+ rows efficiently                          |
| Composite GitHub Action               | Faster than Docker, reuses CLI                         |
| Score history in .stackwatch/          | Same directory as stack diff, consistent pattern       |
| HTML export as template literal        | No template engine deps, self-contained, XSS-escaped  |
| SBOM without external deps             | CycloneDX/SPDX JSON generated directly                |

---

## Product context

- **Target user**: developer or small team managing a software project
- **Pain point**: not knowing which services are active, paid, or expiring
- **Primary**: daily check on project infrastructure status
- **Secondary**: onboarding new developers to a codebase
- **Tertiary**: CI/CD scanning and PR reporting

---

## Open questions

- Multi-project dashboard (multiple repos at once)?
