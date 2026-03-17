# CONTEXT.md — StackWatch

> Operational context for AI agents. NOT a changelog, NOT user documentation.
> Read this before writing any code. Update after structural changes.

---

## What this project is

**StackWatch** scans codebases and maps every external service, dependency, and paid account. Electron desktop app + CLI + GitHub Action.

- **Desktop app**: Electron 35 + React 19 + Vite 6 + TypeScript 5.7 + Tailwind 4 + Zustand 5 + React Flow 11
- **CLI**: `npx stackwatch [path] [--json|--md|--diff|--sbom cyclonedx|spdx|--fail-on-vulns|--fail-on-unreviewed]`. Subcommands: `init` (generate config), `badge` (generate README badges), `doctor` (health check). Same heuristic engine, no Electron dependency.
- **GitHub Action**: `alciller88/StackWatch@main` — posts PR comments with scan results
- **Config file**: `stackwatch.config.json` in the scanned repo (not this repo)

Full spec: `SPEC.md` · User docs: `README.md`

---

## How the app works

### Three ways to use it

| Mode | What happens |
|------|-------------|
| **Scan (Open folder / GitHub)** | Fresh analysis from code. Previous edits NOT carried over. Detects monorepos automatically. |
| **Import config** | Full restore from exported JSON. All services, graph layout, positions, edges restored exactly. Works without a repo. |
| **CLI / GitHub Action** | Headless scan, outputs JSON or Markdown. `--fail-on-vulns` (exit 1) and `--fail-on-unreviewed` (exit 2) for CI gates. `stackwatch init` generates config. |

### Analysis pipeline

```
extractor.ts → heuristic.ts → deduplicator.ts → [AI filter] → [AI refine] → [AI deep analysis + alternatives] → zombieDetector.ts → flowInference.ts
     │                                                                                                          │
     ├── Evidences (env vars, imports, URLs, configs)                                                           ├── FlowNodes
     ├── Dependencies (npm, pip, cargo, go, etc.)                                                               └── FlowEdges
     └── Monorepo detection (workspaces, pnpm, lerna, turbo, nx)
```

- **Heuristic mode** (default): fast, offline, ~80% coverage, semantic evidence scoring (best score per unique evidence type, not additive per instance), thresholds: <6 discard, 6-10 low/AI-validated, >10 high
- **Hybrid mode**: heuristics → AI filter (≤40 services, targets low/needsReview only; high confidence passes through) → AI refine (medium/low only) → AI deep analysis (~95% coverage)
- AI is always optional — silent fallback to heuristic results on failure

### Critical invariant: Service ↔ Graph Node 1:1

Every service MUST have a corresponding graph node. This is enforced by:
1. `flowInference.ts` creates a node per service
2. `useStore.ensureFlowNodes()` adds extra nodes for manual services missing from pipeline
3. Deleting a graph node also removes the linked service from useStore and config

Never filter services out of the graph. Never create services without nodes.

---

## Architecture

### Process model

```
┌─────────────────────────────────────────────┐
│ Main Process (electron/main.ts)             │
│  ├── IPC handlers (22 channels)             │
│  ├── electron-store (safeStorage encrypted) │
│  ├── Analyzers (pure Node.js)               │
│  ├── AI client (OpenAI-compatible)          │
│  ├── Vuln scanner (OSV.dev API)             │
│  ├── SBOM generator (CycloneDX/SPDX)       │
│  ├── Stack Diff (snapshot compare)          │
│  ├── Zombie detector (git log activity)     │
│  ├── Score history (.stackwatch/)           │
│  ├── HTML exporter (self-contained report)  │
│  ├── Renewal notifications (Electron)       │
│  └── CSP headers (production only)          │
├─────────────────────────────────────────────┤
│ Preload (electron/preload.ts)               │
│  └── contextBridge — exposes StackWatchAPI  │
├─────────────────────────────────────────────┤
│ Renderer (src/)                             │
│  ├── Stores: useStore, graphStore,          │
│  │   dialogStore, toastStore, historyStore  │
│  ├── 4 panels: Services, Deps, Flow, Costs │
│  ├── Score history modal (Recharts line)   │
│  ├── Doctor modal (health checklist)       │
│  ├── Theme system (dark/light via CSS vars)│
│  ├── Skeleton loaders during analysis       │
│  └── Undo/redo (Ctrl+Z / Ctrl+Shift+Z)     │
└─────────────────────────────────────────────┘
```

### Stores

| Store | Purpose | Key details |
|-------|---------|-------------|
| `useStore` | Global state: services, deps, config, AI settings, analysis state, theme, score history, budget | Merged services = inferred + manual + confidence overrides. Theme persisted in localStorage. |
| `graphStore` | React Flow nodes/edges, excluded services | `persistToConfig` debounced 500ms. Pushes to historyStore before mutations. |
| `historyStore` | Undo/redo | Past/future stacks, max 50 snapshots. Captures nodes + edges + services. |
| `dialogStore` | Promise-based confirm dialogs | Returns button value string |
| `toastStore` | Notifications | Auto-dismiss after 4s |

### Security model

- **Encryption**: `safeStorage.encryptString()` derives machine-unique key for `electron-store`. Fallback: `userData`-based seed.
- **CSP**: `Content-Security-Policy` via `session.webRequest.onHeadersReceived`. Production only (disabled in dev for Vite HMR).
- **External URLs**: all opened via IPC `open-external-url` → `shell.openExternal()` with protocol validation (http/https only). No `window.open()`.
- **Path validation**: `validateRepoPath()` checks raw input for `..` traversal via regex before resolving.
- **Secrets**: GitHub tokens and AI API keys stored in encrypted electron-store, never in config JSON.

### Type system

```
shared/types.ts          ← canonical source: SERVICE_CATEGORIES const, all interfaces
  ↗ src/types.ts         ← re-exports + declares Window.stackwatch
  ↗ electron/types.ts    ← re-exports
```

`SERVICE_CATEGORIES` is a `const` array — the `ServiceCategory` union type is derived from it. All consumers import from `shared/types.ts` (or its re-exports). There is NO duplicated category list anywhere. `Vulnerability` and `DepVulnResult` interfaces live in `shared/types.ts` only — `vulnScanner.ts` imports from there.

**Build artifact warning**: Vite resolves `shared/types.ts` directly. If a stale `shared/types.js` exists in the repo root, Vite will pick it up instead → app breaks. This file is gitignored. If it appears, delete it.

---

## Key files

### Electron (main process)
| File | Purpose |
|------|---------|
| `electron/main.ts` | Entry point, IPC handlers, safeStorage, CSP, window management |
| `electron/preload.ts` | IPC bridge via contextBridge (StackWatchAPI) |
| `electron/analyzers/index.ts` | Pipeline orchestrator. Monorepo-aware. |
| `electron/analyzers/extractor.ts` | Evidence extraction: env vars, imports, URLs, configs, deps |
| `electron/analyzers/heuristic.ts` | Semantic scoring classification into 19 categories (config_file: 10, ci_secret: 8, env_var credential: 7, env_var endpoint: 6, url: 5, env_var generic: 2, npm/import: 1) + hard filters (CI vars, feature flags, browser APIs) + score penalties (config suffixes: -5, descriptive phrases: -3, project name: -10) |
| `electron/analyzers/deduplicator.ts` | Service grouping, best-score-per-unique-evidence-type (not additive per instance), thresholds (<6: discard, 6-10: low/needsReview for AI, >10: high), brand collapse, generic entry removal |
| `electron/analyzers/flowInference.ts` | Node/edge generation from services + deps |
| `electron/analyzers/monorepo.ts` | Detects workspaces, pnpm, lerna, turbo, nx |
| `electron/analyzers/vulnScanner.ts` | OSV.dev batch API (8 ecosystems, groups of 100) |
| `electron/analyzers/stackDiff.ts` | Stack Diff: compare scans, save/load snapshots (.stackwatch/last-scan.json) |
| `electron/analyzers/sbom.ts` | SBOM generator: CycloneDX 1.5 and SPDX 2.3 JSON from dependencies |
| `electron/analyzers/zombieDetector.ts` | Zombie detection: git log activity per service, stale/zombie classification |
| `electron/analyzers/scoreHistory.ts` | Score history: persist health scores to `.stackwatch/score-history.json` |
| `electron/ai/deepAnalyzer.ts` | AI: false-positive filter (≤40 services, targets low/needsReview only), refine services (medium/low only, high skipped), usage context, hidden detection, edge types, alternative suggestions |
| `electron/ai/alternativeSuggester.ts` | AI: suggest cheaper/open-source alternatives for detected services |
| `electron/exporters/htmlExporter.ts` | Self-contained HTML report generator (dark theme, print-friendly) |
| `electron/ai/provider.ts` | OpenAI-compatible client + 3 provider presets (Local, Cloud, Custom) |

### Renderer (src/)
| File | Purpose |
|------|---------|
| `src/App.tsx` | Layout, panel routing, undo/redo keyboard handler, skeleton switching, score history modal |
| `src/store/useStore.ts` | Global state, analysis flow, service CRUD, import/export, theme, budget, score history |
| `src/store/graphStore.ts` | React Flow state, debounced persist, history integration |
| `src/store/historyStore.ts` | Undo/redo snapshot stacks (50 max) |
| `src/store/toastStore.ts` | Toast notifications (4s auto-dismiss) |
| `src/store/dialogStore.ts` | Promise-based confirm dialog |
| `src/utils/healthScore.ts` | Stack Score 0-100 (cost 30%, owner 25%, reviewed 25%, graph 20%) |
| `src/utils/badge.ts` | SVG badge + shields.io URLs: score, services, vulns, deps, scanned date |
| `src/utils/dates.ts` | Shared `daysUntil()` utility |
| `src/hooks/useDebounce.ts` | Generic debounce hook |
| `src/hooks/useTheme.ts` | Applies theme CSS variables to document root |
| `src/themes.ts` | Dark/light theme CSS variable definitions |
| `src/components/Skeleton.tsx` | Skeleton loaders for all 4 panels |
| `src/components/Toast.tsx` | Toast notification container |
| `src/components/DepsPanel/` | Virtualized table (@tanstack/react-virtual), vuln scanning |
| `src/components/CostsPanel/` | Cost breakdown by category, renewal alerts, bar chart (Recharts), budget mode |
| `src/components/Doctor/` | Doctor modal: health checklist (config, services, costs, vulns, score) |
| `src/components/ScoreHistory/` | Score history modal with Recharts line chart, trend stats |
| `src/components/FlowGraph/` | React Flow graph, Zustand selectors, context menu, node edit |
| `src/components/ServicesPanel/` | Service cards with zombie badges, form with htmlFor labels, confidence badges, activity filter |
| `src/components/TopBar/` | Import/export, share (dynamic badges), GitHub, re-analyze |

### CLI & CI
| File | Purpose |
|------|---------|
| `cli/index.ts` | CLI entry: scan, init, badge, doctor, --diff, --sbom, --html, --all, --fail-on-vulns, --fail-on-unreviewed. Built to `dist-cli/` |
| `action.yml` | GitHub Action (composite): install, build CLI, scan, comment on PR |

### Build & validation
| File | Purpose |
|------|---------|
| `electron-builder.yml` | macOS dmg+zip, Windows nsis+portable, Linux AppImage+deb |
| `build/` | icon.svg, entitlements.mac.plist, Linux icon dir |
| `scripts/validate-build.js` | 29-point production build checker |
| `.github/workflows/build.yml` | CI: test → build → validate → upload artifacts (3 platforms) |

---

## Build & run

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite + Electron in dev mode with HMR |
| `npm run build:prod` | TSC + Vite only (fast, no packaging) |
| `npm run build:dist` | Full electron-builder (distributable) |
| `npm run build` | Alias for `build:dist` |
| `npm run build:cli` | Build CLI to `dist-cli/` |
| `npm run validate` | 29-point build validation |
| `npm test` | vitest (319 tests, 22 suites) |
| `npx stackwatch doctor [path]` | Health check: services, costs, vulns, score |

**Common pitfalls**:
- Stale `dist-electron/tsconfig.node.tsbuildinfo` → delete and rebuild
- Stale `shared/types.js` in repo root → delete (gitignored, breaks Vite)
- `dist-cli/` must be excluded from vitest config

---

## Tests

323 tests across 22 suites. vitest + @testing-library/react + jsdom.

| Suite | Count | Coverage |
|-------|-------|----------|
| graphStore | 27 | initFromAnalysis, node/edge CRUD, connect, exclude, resetLayout, persistToConfig |
| vulnScanner | 27 | Ecosystem mapping, batching, OSV parsing, severity, error handling |
| Extractor | 26 | File types, URL/env/import patterns |
| Deep Analyzer | 24 | refineServicesWithAI (medium/low only), filterFalsePositivesWithAI (≤40, low/needsReview), safeParseJSON, malformed responses |
| badge | 17 | SVG generation, shields.io URLs, markdown/HTML formats, color thresholds |
| htmlExporter | 13 | HTML structure, sections, XSS escaping, budget, print styles |
| Deep Analyzer (runDeep) | 13 | Usage context, hidden services, edge types |
| Heuristic | 32 | Category mapping, semantic scoring (base scores + penalties), name extraction, config suffix penalty, CI var filtering, feature flag filtering, generic names, project name exclusion |
| TopBar | 13 | Buttons, repo path, error, analyzing state, link status |
| zombieDetector | 12 | Classification thresholds, caching, enrichment, git failure handling |
| monorepo | 12 | npm/pnpm/lerna/turbo/nx detection, glob resolution, manifest check |
| historyStore | 12 | push/undo/redo, canUndo/canRedo, clear, 50-snapshot limit |
| healthScore | 11 | Scoring formula weights, perfect/partial/zero scores, edge cases |
| alternativeSuggester | 10 | AI response parsing, filtering, error handling, ID mapping |
| ServiceCard | 10 | Rendering, interactions, confidence, a11y |
| useStore | 10 | mergeServices, ensureConfig, ensureFlowNodes, CRUD |
| Flow inference | 9 | Node types, edge routing, layout |
| scoreHistory | 8 | Load/append, trimming, directory creation, invalid JSON |
| ContextMenu | 7 | ARIA roles, click/Escape, dividers |
| Deduplicator | 20 | Grouping, merging, best-score-per-unique-type (no additive inflation), thresholds (<6 discard, 6-10 low, >10 high), brand collapse, generic entry removal |
| Pipeline | 7 | End-to-end, AI checkpoint/restore, npm-only discard |
| daysUntil | 3 | Today, future, past |

---

## Patterns to follow

### Adding a new analyzer
1. Add extraction in `electron/analyzers/extractor.ts`
2. Add classification in `electron/analyzers/heuristic.ts` if needed
3. Add tests in `electron/analyzers/__tests__/`
4. Pipeline picks up new evidence automatically

### Adding a new IPC channel
1. Handler in `electron/main.ts`
2. Method in `electron/preload.ts`
3. Type in `StackWatchAPI` in `shared/types.ts`

### Adding a new panel
1. Component in `src/components/NewPanel/`
2. Panel type in `ActivePanel` union (`useStore.ts`)
3. Tab in `Sidebar.tsx`
4. Render in `App.tsx` `renderPanel()`
5. Skeleton in `Skeleton.tsx`

### Adding undo support
1. `useHistoryStore.getState().pushSnapshot(label, { nodes, edges, services })` BEFORE the mutation
2. Skip high-frequency ops (drag, resize, init)

---

## Architecture decisions (do not reopen without reason)

| Decision | Reason |
|----------|--------|
| Semantic scoring heuristics, not fixed maps | Detects new services without code changes; evidence quality scoring determines confidence |
| Optional AI with silent fallback | Must work 100% offline |
| OpenAI-compatible API format | One format covers all providers |
| Separate graphStore from useStore | Different lifecycle, interactive state |
| safeStorage for encryption | Machine-unique, no key in source |
| CSP production-only | Vite HMR needs inline scripts |
| shell.openExternal via IPC | Protocol validation, security |
| Local fonts bundled | Works offline, no FOUC |
| Zustand selectors in FlowGraph | Prevents re-renders on drag |
| Debounced persistToConfig | Reduces disk I/O |
| History snapshots for undo | Captures graph + services together |
| OSV.dev for vulns | Free, no API key, 8 ecosystems |
| @tanstack/react-virtual | Handles 500+ rows efficiently |
| Composite GitHub Action | Faster than Docker, reuses CLI |
| Stack Diff via .stackwatch/last-scan.json | Simple file-based, no DB needed, gitignore-able |
| Zombie detection via git log | Leverages existing evidence files, no external deps |
| Score history in .stackwatch/ | Same directory as stack diff, consistent pattern |
| Doctor as CLI subcommand | Reuses existing pipeline + vuln scanner, no new deps |
| SBOM without external deps | CycloneDX/SPDX JSON generated directly, no library overhead |
| Recharts for cost visualization | Lightweight, React-native, good dark theme support |
| CSS variables for theming | Least invasive approach, swap vars at root, no component rewrites |
| Theme in localStorage, not config | User preference, not project-level setting |
| Budget in UserConfig | Project-level setting, shared via config file |
| Score history as modal, not panel | Secondary content, doesn't justify a full panel slot |
| HTML export as template literal | No template engine deps, self-contained, XSS-escaped |
| AI alternatives as Step D in deep analysis | Reuses existing AI pipeline, silent fallback, no new deps |

---

## What NOT to do

- **No hardcoded service maps** — semantic heuristics only
- **No `nodeIntegration: true`** — all IPC via contextBridge
- **No `window.open()`** — use shell.openExternal via IPC
- **No Google Fonts CDN** — fonts bundled in `src/assets/fonts/`
- **No JS hover handlers** — use Tailwind `hover:` classes
- **No `shared/types.js` in repo root** — delete if it appears (breaks Vite)
- **No full Zustand store subscriptions** in perf-critical components — use selectors
- **No synchronous fs** in main process — use `fs.promises`
- **No assuming AI is available** — always fallback to heuristics
- **No skipping tsbuildinfo cleanup** — stale cache breaks builds

---

## Product context

- **Target user**: developer or small team managing a software project
- **Pain point**: not knowing which services are active, paid, or expiring
- **Primary use**: daily check on project infrastructure status
- **Secondary use**: onboarding new developers to a codebase
- **Tertiary use**: CI/CD scanning and PR reporting

---

## Open questions

- Multi-project dashboard (multiple repos at once)?
- ~~Light theme?~~ ✔ Implemented (dark/light toggle via CSS variables)
- Encrypt sensitive fields in `stackwatch.config.json`?
