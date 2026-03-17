# CONTEXT.md — StackWatch

> Operational context for AI agents. NOT a changelog, NOT user documentation.
> Read this before writing any code. Update after structural changes.

---

## What this project is

**StackWatch** scans codebases and maps every external service, dependency, and paid account. Electron desktop app + CLI + GitHub Action.

- **Desktop app**: Electron 35 + React 19 + Vite 6 + TypeScript 5.7 + Tailwind 4 + Zustand 5 + React Flow 11
- **CLI**: `npx stackwatch [path] [--json|--md]` — same heuristic engine, no Electron dependency
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
| **CLI / GitHub Action** | Headless scan, outputs JSON or Markdown. No GUI, no config persistence. |

### Analysis pipeline

```
extractor.ts → heuristic.ts → deduplicator.ts → [AI refine] → [AI deep analysis] → flowInference.ts
     │                                                                                      │
     ├── Evidences (env vars, imports, URLs, configs)                                       ├── FlowNodes
     ├── Dependencies (npm, pip, cargo, go, etc.)                                           └── FlowEdges
     └── Monorepo detection (workspaces, pnpm, lerna, turbo, nx)
```

- **Heuristic mode** (default): fast, offline, ~80% coverage
- **Hybrid mode**: heuristics → AI validates/refines → AI deep analysis (~95% coverage)
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
│  ├── IPC handlers (17 channels)             │
│  ├── electron-store (safeStorage encrypted) │
│  ├── Analyzers (pure Node.js)               │
│  ├── AI client (OpenAI-compatible)          │
│  ├── Vuln scanner (OSV.dev API)             │
│  └── CSP headers (production only)          │
├─────────────────────────────────────────────┤
│ Preload (electron/preload.ts)               │
│  └── contextBridge — exposes StackWatchAPI  │
├─────────────────────────────────────────────┤
│ Renderer (src/)                             │
│  ├── Stores: useStore, graphStore,          │
│  │   dialogStore, toastStore, historyStore  │
│  ├── 4 panels: Services, Deps, Flow, Costs │
│  ├── Skeleton loaders during analysis       │
│  └── Undo/redo (Ctrl+Z / Ctrl+Shift+Z)     │
└─────────────────────────────────────────────┘
```

### Stores

| Store | Purpose | Key details |
|-------|---------|-------------|
| `useStore` | Global state: services, deps, config, AI settings, analysis state | Merged services = inferred + manual + confidence overrides |
| `graphStore` | React Flow nodes/edges, excluded services | `persistToConfig` debounced 500ms. Pushes to historyStore before mutations. |
| `historyStore` | Undo/redo | Past/future stacks, max 50 snapshots. Captures nodes + edges + services. |
| `dialogStore` | Promise-based confirm dialogs | Returns button value string |
| `toastStore` | Notifications | Auto-dismiss after 4s |

### Security model

- **Encryption**: `safeStorage.encryptString()` derives machine-unique key for `electron-store`. Fallback: `userData`-based seed.
- **CSP**: `Content-Security-Policy` via `session.webRequest.onHeadersReceived`. Production only (disabled in dev for Vite HMR).
- **External URLs**: all opened via IPC `open-external-url` → `shell.openExternal()` with protocol validation (http/https only). No `window.open()`.
- **Path validation**: `validateRepoPath()` resolves and rejects `..` traversal.
- **Secrets**: GitHub tokens and AI API keys stored in encrypted electron-store, never in config JSON.

### Type system

```
shared/types.ts          ← canonical source: SERVICE_CATEGORIES const, all interfaces
  ↗ src/types.ts         ← re-exports + declares Window.stackwatch
  ↗ electron/types.ts    ← re-exports
```

`SERVICE_CATEGORIES` is a `const` array — the `ServiceCategory` union type is derived from it. All consumers import from `shared/types.ts` (or its re-exports). There is NO duplicated category list anywhere.

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
| `electron/analyzers/heuristic.ts` | Semantic classification into 19 categories |
| `electron/analyzers/deduplicator.ts` | Service grouping, merge, confidence upgrade |
| `electron/analyzers/flowInference.ts` | Node/edge generation from services + deps |
| `electron/analyzers/monorepo.ts` | Detects workspaces, pnpm, lerna, turbo, nx |
| `electron/analyzers/vulnScanner.ts` | OSV.dev batch API (8 ecosystems, groups of 100) |
| `electron/ai/deepAnalyzer.ts` | AI: refine services, usage context, hidden detection, edge types |
| `electron/ai/provider.ts` | OpenAI-compatible client + 6 provider presets |

### Renderer (src/)
| File | Purpose |
|------|---------|
| `src/App.tsx` | Layout, panel routing, undo/redo keyboard handler, skeleton switching |
| `src/store/useStore.ts` | Global state, analysis flow, service CRUD, import/export |
| `src/store/graphStore.ts` | React Flow state, debounced persist, history integration |
| `src/store/historyStore.ts` | Undo/redo snapshot stacks (50 max) |
| `src/store/toastStore.ts` | Toast notifications (4s auto-dismiss) |
| `src/store/dialogStore.ts` | Promise-based confirm dialog |
| `src/utils/healthScore.ts` | Stack Score 0-100 (cost 30%, owner 25%, reviewed 25%, graph 20%) |
| `src/utils/badge.ts` | SVG badge generator + shields.io URLs for Stack Score |
| `src/utils/dates.ts` | Shared `daysUntil()` utility |
| `src/hooks/useDebounce.ts` | Generic debounce hook |
| `src/components/Skeleton.tsx` | Skeleton loaders for all 4 panels |
| `src/components/Toast.tsx` | Toast notification container |
| `src/components/DepsPanel/` | Virtualized table (@tanstack/react-virtual), vuln scanning |
| `src/components/FlowGraph/` | React Flow graph, Zustand selectors, context menu, node edit |
| `src/components/ServicesPanel/` | Service cards, form with htmlFor labels, confidence badges |
| `src/components/TopBar/` | Import/export, share (dynamic badges), GitHub, re-analyze |

### CLI & CI
| File | Purpose |
|------|---------|
| `cli/index.ts` | CLI entry point. Built to `dist-cli/` via `npm run build:cli` |
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
| `npm test` | vitest (135 tests, 12 suites) |

**Common pitfalls**:
- Stale `dist-electron/tsconfig.node.tsbuildinfo` → delete and rebuild
- Stale `shared/types.js` in repo root → delete (gitignored, breaks Vite)
- `dist-cli/` must be excluded from vitest config

---

## Tests

135 tests across 12 suites. vitest + @testing-library/react + jsdom.

| Suite | Count | Coverage |
|-------|-------|----------|
| Extractor | 26 | File types, URL/env/import patterns |
| Deep Analyzer | 19 | refineServicesWithAI, safeParseJSON, malformed responses |
| Deep Analyzer (runDeep) | 13 | Usage context, hidden services, edge types |
| Heuristic | 13 | Category mapping, confidence, name extraction |
| ServiceCard | 10 | Rendering, interactions, confidence, a11y |
| TopBar | 13 | Buttons, repo path, error, analyzing state, link status |
| useStore | 10 | mergeServices, ensureConfig, ensureFlowNodes, CRUD |
| Flow inference | 9 | Node types, edge routing, layout |
| ContextMenu | 7 | ARIA roles, click/Escape, dividers |
| Deduplicator | 6 | Grouping, merging, confidence upgrades |
| Pipeline | 6 | End-to-end, AI checkpoint/restore |
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
| Semantic heuristics, not fixed maps | Detects new services without code changes |
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

- Renewal alerts as OS desktop notifications?
- Multi-project dashboard (multiple repos at once)?
- Stack Diff between scans (change tracking over time)?
- Light theme?
- Encrypt sensitive fields in `stackwatch.config.json`?
