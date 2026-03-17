# CONTEXT.md — StackWatch

> This file is living memory for AI agents (Claude, Copilot, Cursor, etc.).
> Update it after each significant development session.
> NOT user documentation — this is operational context for the agent.

---

## What this project is

Electron + React desktop app that analyzes any software project (local or GitHub) and infers all external services, dependencies and accounts the project uses. Supports web, Python, Rust, Go, Terraform ecosystems and more. Results are displayed in a dashboard with four panels: services, dependencies, flow graph, and costs.

Also available as:
- **CLI**: `npx stackwatch` — scan any repo from the terminal (--json, --md, --help)
- **GitHub Action**: `alciller88/StackWatch@main` — scan on every PR, post results as comment

The user's manual configuration file is `stackwatch.config.json` in the root of the analyzed repo (not the app's repo).

Full spec: `SPEC.md`

---

## Current development state

> ⚠️ Update this section at the start of each session.

- **Phase**: v0.4.1 — quality sweep, new features, distribution preparation
- **Latest session**: 2026-03-17

### Changes implemented this session (8 commits)

#### Security (commit a668e97)
- **safeStorage encryption**: replaced hardcoded `encryptionKey` with machine-unique key derived from `safeStorage.encryptString()`, with fallback to `userData`-based seed. Store initialization moved into `app.whenReady()`.
- **CSP headers**: added `Content-Security-Policy` via `session.webRequest.onHeadersReceived` — production only (disabled in dev for Vite HMR). Restricts scripts, styles, fonts, connections, images.
- **shell.openExternal**: replaced all `window.open()` calls (DepsPanel, FlowGraph) with IPC handler `open-external-url` that validates protocol (http/https only) before calling `shell.openExternal`.

#### Performance (commit a668e97)
- **Local fonts**: replaced Google Fonts CDN `@import` with 5 local `@font-face` declarations (IBM Plex Mono 400/500, IBM Plex Sans 300/400/500) in `src/assets/fonts/`. App now works fully offline.
- **Zustand selectors**: FlowGraph.tsx replaced `useGraphStore()` (subscribes to ALL state) with 17 individual selectors (`useGraphStore(s => s.nodes)`, etc.) to prevent unnecessary re-renders.
- **Debounced persistToConfig**: added 500ms debounce timer to `graphStore.persistToConfig()` to reduce disk I/O during node dragging.

#### Code Quality (commits a668e97, bf14d11)
- **SERVICE_CATEGORIES**: extracted const array in `shared/types.ts`, derived `ServiceCategory` union type from it. Updated 4 consumers (ServicesPanel, NodeEditPanel, deepAnalyzer, shared). Eliminated 4 duplicated category arrays.
- **Shared daysUntil()**: created `src/utils/dates.ts` with unified implementation (used `Math.ceil` with hour reset). Replaced two divergent implementations in ServiceCard.tsx and CostsPanel.tsx.
- **Dead ternary**: fixed `(editPanel?.isCustom ? 'external' : 'external')` → `'external'` in FlowGraph.tsx.
- **Unused import**: removed `LinkStatus` from TopBar.tsx imports.
- **eslint-disable**: documented intentional dep exclusion in FlowGraph useEffect; added `checkLinkStatus` to TopBar useEffect deps.

#### Accessibility (commits a668e97, bf14d11)
- **Focus trap in GitHubModal**: Tab/Shift+Tab trapped within modal form, includes `a[href]` links.
- **ARIA roles on ContextMenu**: `role="menu"` on container, `role="menuitem"` on each button.
- **NodeEditPanel**: added `role="dialog"`, `aria-modal="false"`, `aria-label="Edit node"`, viewport clamping via `Math.min()`.
- **htmlFor labels**: linked all 11 ServiceForm labels to inputs via `htmlFor`/`id` pairs (sf-name, sf-category, sf-plan, sf-confidence, sf-url, sf-cost, sf-renewal, sf-email, sf-notes, sf-owner, sf-comment).
- **Table caption**: added visually-hidden `<caption>Project dependencies</caption>` to DepsPanel table.
- **aria-hidden SVGs**: added `aria-hidden="true"` to all 6 decorative SVGs in Sidebar navItems.
- **Color contrast**: boosted `--color-text-muted` from `#6a7a90` to `#8090a6` (~5.2:1 ratio on `#0a0c0f`, WCAG AA compliant).

#### Tests (commits bf14d11, a668e97)
- **135 tests across 12 suites** (was 102 in 8 suites before this session)
- Installed `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- Added `src/test-setup.ts` with jest-dom matchers, configured vitest with `environment: 'jsdom'`
- **ServiceCard.test.tsx** (10 tests): rendering, cost, owner, renewal, click/keyboard, confidence, notes, inferred-from
- **TopBar.test.tsx** (13 tests): buttons, repo path, error banner, analyzing state, link status, interactions
- **ContextMenu.test.tsx** (7 tests): ARIA roles, click/Escape, dividers, active state
- **dates.test.ts** (3 tests): today, future, past dates

#### UI/UX (commit bf14d11)
- **Toast notification system**: `toastStore` (Zustand, auto-dismiss 4s) + `ToastContainer` component with success/error/info styles. Rendered in App.tsx.
- **useDebounce hook**: generic debounce hook in `src/hooks/useDebounce.ts`.
- **CSS hover migration**: replaced JS `onMouseEnter`/`onMouseLeave` with Tailwind `hover:` classes in TitleBar (3 buttons), ConfirmDialog (all button variants), NodeEditPanel (Save/Cancel), DepsPanel (table rows).
- **TopBar responsive**: reduced padding/gaps (`px-3 gap-2`) for narrow windows.

#### Undo/Redo (commit 87464a9)
- **historyStore**: Zustand store with past/future snapshot stacks, max 50 entries. Uses `structuredClone` for deep copies.
- **Keyboard shortcuts**: Ctrl+Z (undo), Ctrl+Shift+Z (redo). Skips input/textarea/select focus.
- **Tracked operations**: addNode, updateNode, deleteNode, onConnect, deleteEdge, updateEdgeType, resetLayout. Restores nodes, edges, and services.
- NOT tracked (intentional): onNodesChange, onEdgesChange, saveNodePosition, initFromAnalysis (high-frequency or init).

#### List Virtualization (commit 87464a9)
- **@tanstack/react-virtual** for DepsPanel table rows in flat (non-grouped) mode.
- `estimateSize: 41px`, `overscan: 20`. Spacer rows maintain scroll height.
- ServicesPanel grid NOT virtualized (rarely exceeds ~50 items, variable card height).

#### Skeleton Loaders (commit 87464a9)
- `src/components/Skeleton.tsx`: `SkeletonBlock`, `SkeletonServiceCard`, `SkeletonTableRow`, plus full panel skeletons for Services, Deps, Flow, and Costs.
- CSS `@keyframes pulse` animation (opacity 0.15–0.4, 1.5s).
- Shown during initial analysis when `isAnalyzing && !hasData`.

#### CLI Tool (commit cf33078)
- `cli/index.ts`: standalone scanner using the same heuristic engine as the desktop app.
- Outputs: human-readable summary (default), JSON (`--json`), Markdown table (`--md`).
- `--help`, `--version` flags. `bin.stackwatch` in package.json for `npx stackwatch`.
- Built with `npm run build:cli` to `dist-cli/` (gitignored). Separate `cli/tsconfig.json`.
- `dist-cli/` excluded from vitest config to prevent test collection.

#### GitHub Action (commit cf33078)
- `action.yml`: composite action — installs deps, builds CLI, scans, posts/updates PR comment.
- `.github/workflows/stackwatch-scan.yml`: example workflow triggered on PRs to main.
- Updates existing StackWatch comment if found, creates new otherwise.

#### Dynamic Stack Score Badge (commit a3c29a5)
- `src/utils/badge.ts`: `generateScoreBadgeSvg()` (self-contained SVG), `getScoreBadgeUrl()` (shields.io), `getScoreBadgeMarkdown()`, `getScoreBadgeHtml()`.
- TopBar Share menu: badges now include Stack Score (color-coded green/yellow/red) + service count. New "Copy Badge (SVG)" option.
- Stack Summary includes `Stack Score: X/100` line.

#### Vulnerability Detection (commit a3c29a5)
- `electron/analyzers/vulnScanner.ts`: uses OSV.dev batch API (free, no key). Maps 8 ecosystems (npm→npm, pip→PyPI, cargo→crates.io, go→Go, gem→RubyGems, composer→Packagist, maven/gradle→Maven, dart→Pub).
- Batches in groups of 100, 15s timeout, maps CVSS scores to severity levels.
- IPC handler `scan-vulnerabilities` + preload bridge.
- DepsPanel: "Scan vulns" button, red summary banner, per-dep vuln badges with tooltip details.
- Types: `Vulnerability`, `DepVulnResult` in `shared/types.ts`.

#### Monorepo Support (commit 4996729)
- `electron/analyzers/monorepo.ts`: detects npm workspaces, pnpm-workspace.yaml, lerna.json, turbo.json, nx.json. Resolves glob patterns to package directories.
- `analyzeLocalRepo` auto-detects monorepos (2+ packages), scans root + all packages.
- Evidence files tagged with package name (`pkgName/file`), dependencies deduplicated (production preferred over dev).
- `monorepo` field on `AnalysisResult` (`{ type, packages }`).

#### Distributable Builds (commit 4996729)
- `electron-builder.yml`: macOS (dmg+zip universal, hardened runtime, entitlements), Windows (nsis+portable x64), Linux (AppImage+deb x64). Asar packaging. GitHub draft releases.
- `build/`: icon.svg source, entitlements.mac.plist, icons/ for Linux PNGs.
- Scripts: `build:prod` (TSC+Vite, fast), `build:dist` (full electron-builder), `build` (alias for dist).
- CI: `build.yml` runs test → build → validate → upload artifacts for 3 platforms.

#### Production Build Validation (commit 4996729)
- `scripts/validate-build.js`: 29-point checker covering Vite output (HTML, JS, CSS, fonts, no CDN refs), Electron compilation (all analyzers + AI + types + monorepo), security (no hardcoded keys, safeStorage present, CSP configured, no .env files), package metadata, electron-builder config.
- `npm run validate` — runs locally and as CI step after build.

### Bug fixes this session
- CSP disabled in dev mode to allow Vite HMR scripts and WebSocket (commit 5beb749)
- `VALID_CATEGORIES.has()` type cast fixed for readonly tuple (commit ee8d796)
- Stale `shared/types.js` build artifact removed (was confusing Vite module resolution)
- Stale `tsbuildinfo` causing empty `dist-electron/shared/` output

- **Previous milestones**:
  - v0.4.0: Stack Health Score, session restore, demo mode, share badges, cancel button, score reactivity, false positive filtering, 102 tests
  - v0.3.10: unified types, extracted helpers, removed dead code, WCAG AA contrast fix
  - v0.3.0–v0.3.9: interactive flow graph, deep AI analysis, confidence levels, costs panel, frameless titlebar, CSP, encrypted storage, onboarding tutorial, error boundary

---

## Architecture decisions (do not reopen without reason)

| Decision | Rejected alternative | Reason |
|---|---|---|
| Semantic heuristics without fixed maps | Hardcoded per-service maps | Scalability — detects new services without code changes |
| Optional AI with silent fallback | AI required | App must work 100% offline without config |
| OpenAI-compatible API for AI | Provider-specific SDKs | One format covers Ollama, LM Studio, Groq, OpenAI, Mistral, Custom |
| electron-store for AI settings | Manual JSON file | Integrated with Electron, no manual I/O |
| `ignore` (npm) for .gitignore | Manual regex | Edge cases handled, it's the standard |
| React Flow for the graph | D3.js | Better DX with React, native React nodes |
| Zustand for global state | Redux / Context | Less boilerplate, sufficient for the scale |
| Separate graphStore from main store | Single store | Graph has its own state lifecycle |
| Node positions in config.graph | electron-store | Positions should be versioned with the repo |
| Inline panel over modal/drawer | Modal | Doesn't interrupt graph visual flow |
| Deep AI enriches, doesn't replace | AI replaces heuristics | Heuristics are fast and offline |
| Stack Health Score in sidebar | Full panel | Quick-glance metric, not a destination |
| safeStorage for encryption key | Hardcoded string | Machine-unique, no exposed key in source |
| CSP production-only | CSP always | Vite HMR requires inline scripts + WS |
| shell.openExternal via IPC | window.open | Protocol validation, Electron security best practice |
| Local fonts, no CDN | Google Fonts @import | Works offline, no FOUC, no external dependency |
| Zustand selectors in FlowGraph | Full store subscription | Prevents re-renders on every node drag |
| Debounced persistToConfig | Immediate writes | Reduces disk I/O during drag-and-drop |
| History snapshots for undo | Zustand middleware | Simpler, captures both graph + services state |
| OSV.dev for vuln scanning | npm audit / Snyk | Free, no API key, supports 8 ecosystems |
| @tanstack/react-virtual | Full render | Handles 500+ dependency rows efficiently |
| Composite GitHub Action | Docker-based | Faster, no container overhead, reuses CLI |

---

## Project conventions

- **Strict TypeScript** across the entire codebase (`strict: true`)
- **Naming**: camelCase for variables/functions, PascalCase for components and types
- **Imports**: absolute paths from `src/` configured in `tsconfig.json`
- **IPC**: all channels defined in `electron/preload.ts`, never expose `ipcRenderer` directly
- **Analysis**: pipeline flow extract → classify → dedup → (AI) → flow. Each step is pure and testable.
- **No secrets in the repo**: GitHub token and AI API key stored with `electron-store` (safeStorage encrypted)
- **Types**: canonical definitions in `shared/types.ts`, re-exported via `src/types.ts` and `electron/types.ts`
- **SERVICE_CATEGORIES**: single source of truth in `shared/types.ts`, consumed everywhere via import
- **Hover effects**: use Tailwind `hover:` classes, NOT JavaScript `onMouseEnter`/`onMouseLeave`
- **Build artifacts**: `dist-electron/` generated by `tsc -p tsconfig.node.json`. Delete `tsbuildinfo` if stale. NEVER keep `shared/types.js` or `shared/types.d.ts` in repo root (gitignored, confuses Vite resolution).
- **Tests**: vitest + @testing-library/react + jsdom. Exclude `dist-cli/` in vitest config.

---

## Key files the agent must know

```
SPEC.md                              ← full specification
CONTEXT.md                           ← this file (living memory)
shared/types.ts                      ← canonical types + SERVICE_CATEGORIES const
electron/types.ts                    ← re-exports shared/types
electron/main.ts                     ← entry point + IPC handlers + safeStorage + CSP
electron/preload.ts                  ← IPC bridge
electron/analyzers/extractor.ts      ← evidence extraction from repo
electron/analyzers/heuristic.ts      ← semantic classification
electron/analyzers/deduplicator.ts   ← grouping and deduplication
electron/analyzers/index.ts          ← pipeline orchestrator (monorepo-aware)
electron/analyzers/flowInference.ts  ← flow graph inference
electron/analyzers/vulnScanner.ts    ← vulnerability scanning (OSV.dev)
electron/analyzers/monorepo.ts       ← monorepo detection (workspaces, pnpm, lerna, turbo, nx)
electron/ai/provider.ts              ← OpenAI-compatible AI client + presets
electron/ai/deepAnalyzer.ts          ← deep analysis: context, hidden detection, edge inference
cli/index.ts                         ← CLI entry point (npx stackwatch)
action.yml                           ← GitHub Action definition
src/store/useStore.ts                ← global Zustand state
src/store/graphStore.ts              ← graph state (debounced persist, history snapshots)
src/store/historyStore.ts            ← undo/redo snapshot stacks
src/store/toastStore.ts              ← toast notification state
src/store/dialogStore.ts             ← promise-based confirm dialog
src/utils/dates.ts                   ← shared daysUntil utility
src/utils/healthScore.ts             ← Stack Health Score calculation
src/utils/badge.ts                   ← SVG badge generator + shields.io URLs
src/hooks/useDebounce.ts             ← generic debounce hook
src/components/Skeleton.tsx          ← skeleton loaders for all panels
src/components/Toast.tsx             ← toast notification container
src/components/TopBar/TopBar.tsx     ← toolbar with share/badge, responsive layout
src/components/FlowGraph/            ← interactive graph with selectors, undo support
src/components/DepsPanel/            ← virtualized table, vuln scanning
src/components/ServicesPanel/        ← cards with htmlFor labels, confidence badges
scripts/validate-build.js            ← 29-point production build validator
electron-builder.yml                 ← multi-platform build config
build/                               ← icons, entitlements, build resources
.github/workflows/build.yml          ← CI: test → build → validate → artifacts
.github/workflows/stackwatch-scan.yml ← PR scanning workflow
```

---

## Patterns to follow

### Adding a new analyzer
1. Add extraction logic in `electron/analyzers/extractor.ts` (new file type or pattern)
2. Add classification rules in `electron/analyzers/heuristic.ts` if needed
3. Add tests in `electron/analyzers/__tests__/`
4. The pipeline in `index.ts` picks up new evidence types automatically

### Adding a new service to automatic detection
Don't. The system uses semantic heuristics — it detects services by name patterns, not hardcoded lists. If a service isn't detected, improve the extraction patterns or heuristic rules.

### Adding a new dashboard panel
1. Create component in `src/components/NewPanel/`
2. Add panel type to `ActivePanel` union in `src/store/useStore.ts`
3. Add tab button in Sidebar navigation
4. Add panel rendering in `App.tsx` `renderPanel()`
5. Add skeleton loader in `src/components/Skeleton.tsx`

### Adding a new IPC channel
1. Add handler in `electron/main.ts`
2. Add method in `electron/preload.ts` api object
3. Add type to `StackWatchAPI` in `shared/types.ts`
4. Build artifacts will be auto-generated on next `tsc -p tsconfig.node.json`

### Adding undo support to a new operation
1. Call `useHistoryStore.getState().pushSnapshot(label, { nodes, edges, services })` BEFORE the mutation
2. Do NOT add to high-frequency operations (drag, resize, init)

---

## What NOT to do (lessons learned)

- **Do not use hardcoded service maps** — the heuristic system classifies by semantics
- **Do not use `nodeIntegration: true`** in webPreferences — all IPC via `contextBridge`
- **Do not parse `.env` with custom regex** — use line-by-line parsing with split on `=`
- **Do not block the main process** with synchronous analysis — use `fs.promises`
- **Do not hardcode paths** — always use `path.join`
- **Do not assume AI is available** — always fallback to heuristic results
- **Do not use `window.open()`** — use `shell.openExternal` via IPC for security
- **Do not use Google Fonts CDN** — fonts are bundled locally in `src/assets/fonts/`
- **Do not use JS hover handlers** — use Tailwind `hover:` classes instead
- **Do not keep `shared/types.js` in repo root** — it's a build artifact that confuses Vite resolution. It's gitignored.
- **Do not skip `tsbuildinfo` cleanup** — if electron build artifacts are stale, delete `dist-electron/tsconfig.node.tsbuildinfo` and rebuild
- **Do not subscribe to full Zustand stores** in performance-critical components — use selectors

---

## Product context (for UX decisions)

- **Target user**: any developer or small team managing a software project
- **Main pain point**: not knowing which services are active, which are paid, when they renew
- **Primary use case**: open the app at the start of the day to see the project's status
- **Secondary use case**: onboarding a new developer to the team
- **Tertiary use case**: CI/CD scanning via CLI or GitHub Action

---

## Open questions (for future sessions)

- Renewal alerts as OS notifications (Electron Notification API)?
- Multi-project dashboard (open multiple repos simultaneously)?
- Stack Diff between scans (track changes over time)?
- Should `stackwatch.config.json` be encrypted for sensitive data?
- Light theme option?

---

## How to use this file as an agent

1. **Read this file first** at the start of every session to understand project state
2. **Check "Current development state"** to know what was done last and what's next
3. **Check "Architecture decisions"** before proposing structural changes
4. **Check "What NOT to do"** to avoid known pitfalls
5. **Update this file** after making significant changes — keep the living memory current
