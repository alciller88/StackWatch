# StackWatch

> Stop guessing what your project depends on.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

StackWatch scans your codebase and automatically maps every service, API, database, and paid account your project uses — with costs, renewal dates, and an interactive architecture graph.

**Zero config. Works offline. 10 seconds to your first scan.**

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="StackWatch Dashboard" width="800" />
</p>

<details>
<summary>More screenshots</summary>

| Services Panel | Flow Graph | Costs Panel |
|---|---|---|
| <img src="docs/screenshots/services.png" alt="Services" width="260" /> | <img src="docs/screenshots/flow.png" alt="Flow Graph" width="260" /> | <img src="docs/screenshots/costs.png" alt="Costs" width="260" /> |

</details>

> **Note:** To generate screenshots, run `npm run dev` and use your OS screenshot tool. Place images in `docs/screenshots/`.

---

## Dashboard

Four panels:

| Panel | What you see |
|---|---|
| **Services** | Every external service: inferred + manual, with cost and renewal alerts, confidence badges, and AI-generated usage context |
| **Dependencies** | Full dependency tree (npm, pip, cargo, go, composer, dart, maven, gradle, gem) with vulnerability scanning |
| **Flow graph** | Interactive node graph of your app's architecture with drag-and-drop editing, custom connections, and context menus |
| **Costs** | Cost breakdown by category with bar chart, monthly/yearly totals, renewal alerts, and budget mode with progress bar |
| **Settings** | AI provider configuration (Local / Cloud / Custom) with connection testing, theme toggle (dark/light) |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Git](https://git-scm.com/)

### Windows (PowerShell or cmd)

```powershell
git clone https://github.com/alciller88/StackWatch.git
cd StackWatch
npm install
npm run dev
```

The Electron window will open automatically.

### WSL2 (Ubuntu on Windows)

```bash
git clone https://github.com/alciller88/StackWatch.git
cd StackWatch
npm install
npm run dev
```

StackWatch detects WSL automatically and launches the Windows Electron binary — no manual setup required.

> **Note:** Clone into your WSL filesystem (`~/` or `/home/youruser/`), not into `/mnt/c/`. Running from `/mnt/c/` can cause performance issues and permission errors.

### macOS / Linux

```bash
git clone https://github.com/alciller88/StackWatch.git
cd StackWatch
npm install
npm run dev
```

### Available commands (all platforms)

| Command | What it does |
|---|---|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build` | Build production binaries |
| `npm test` | Run unit tests (241 tests across 18 suites) |

### CLI (no Electron required)

Scan any project from the command line:

```bash
# Scan current directory
npx stackwatch

# Scan a specific project
npx stackwatch ./my-project

# JSON output (for piping to other tools)
npx stackwatch --json

# Generate Markdown report
npx stackwatch --md > SERVICES.md

# Generate stackwatch.config.json from scan results
npx stackwatch init ./my-project

# CI gate: fail if critical/high vulnerabilities found (exit 1)
npx stackwatch --fail-on-vulns

# CI gate: fail if unreviewed services exist (exit 2)
npx stackwatch --fail-on-unreviewed

# Stack Diff: compare current scan with previous
npx stackwatch --diff

# Generate SBOM (CycloneDX or SPDX)
npx stackwatch --sbom cyclonedx > sbom.json
npx stackwatch --sbom spdx > sbom.spdx.json

# Generate README badges (copy-paste output into your README)
npx stackwatch badge ./my-project

# Health check: find actionable problems
npx stackwatch doctor
npx stackwatch doctor ./my-project
```

The CLI uses the same heuristic engine as the desktop app — zero config, works offline, instant results.

### GitHub Action

Add StackWatch to your CI pipeline to scan on every PR:

```yaml
# .github/workflows/stackwatch.yml
name: StackWatch Scan
on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: alciller88/StackWatch@main
        with:
          path: '.'
          comment: 'true'
```

The action posts a comment on the PR with detected services and dependencies.

---

## Supported sources

- **Local repo** — point StackWatch at any folder on your machine
- **GitHub repo** — enter `owner/repo` + a personal access token (read-only scope)

Both sources support re-linking: if a project moves or goes offline, StackWatch shows the link status and lets you reconnect.

---

## Service detection

StackWatch uses **semantic heuristics** — not hardcoded service maps — to detect services from your codebase. It recognises services by environment variable patterns, dependencies, config files, source code imports, API URLs, and CI/CD secrets.

### Ecosystems supported

| Ecosystem | Files scanned |
|---|---|
| **Node.js / Web** | `package.json`, `.env*`, source code (`.ts`, `.tsx`, `.js`, `.jsx`) |
| **Python** | `requirements.txt`, `pyproject.toml`, `setup.py`, `.py` source |
| **Rust** | `Cargo.toml`, `.rs` source |
| **Go** | `go.mod`, `.go` source |
| **Terraform** | `*.tf` providers and resources |
| **Docker** | `docker-compose.yml`, `Dockerfile` |
| **CI/CD** | GitHub Actions, GitLab CI, CircleCI workflows |
| **Deployment** | `vercel.json`, `netlify.toml`, `firebase.json`, `fly.toml`, `railway.toml`, `render.yaml`, `Procfile`, `app.yaml` |
| **Other languages** | Ruby, Java, Kotlin, Swift, Dart, C#, PHP (source code URL/import scanning) |

### 19 service categories

domain, hosting, CI/CD, database, auth, payments, email, analytics, monitoring, CDN, storage, infrastructure, AI, mobile, gaming, data, messaging, support, other

### Confidence levels

Each detected service is assigned a confidence level:

| Level | Meaning | Card border |
|---|---|---|
| **High** | Confirmed service — strong evidence (credentials, config files, Docker services) | Green |
| **Medium** | Likely service — moderate evidence (npm packages, generic URLs) | Yellow |
| **Low** | Uncertain — weak evidence, needs user confirmation | Orange dashed |

Services with low confidence appear in a "Needs Review" section at the top of the panel.

---

## AI analysis (optional)

StackWatch works 100% offline without AI. Two scan modes are available in **Settings**:

| Mode | Speed | Requires AI | Description |
|------|-------|-------------|-------------|
| **Heuristic only** | Fast | No | Pattern-based detection (~80% coverage). Default. |
| **Heuristic + AI** | Medium | Yes | Heuristics first, then AI validates, refines, and discovers hidden services (~95%) |

When Heuristic + AI is enabled, the AI pipeline runs in two phases:

**Phase 1 — Validation & refinement** (single compact AI call):
- Removes false positives (libraries mistaken for services)
- Fixes wrong categories
- Adjusts confidence levels
- Merges duplicate detections of the same service

**Phase 2 — Deep analysis** enriches results with three capabilities:

| Capability | What it does |
|---|---|
| **Usage context** | For each service, AI reads your code and explains how it's used, its criticality (critical/important/optional), and detects warnings (hardcoded secrets, missing error handling) |
| **Hidden service detection** | AI scans priority files (lib/, services/, api/) and finds services consumed via wrappers or SDKs that static analysis missed |
| **Graph edge inference** | AI determines the correct connection type (data/auth/payment/webhook) for each service based on usage context |

### Supported AI providers

| Preset | Type | Cost |
|---|---|---|
| **Local** (Ollama / LM Studio) | Local | Free, self-hosted |
| **Cloud (Groq)** | Cloud | Free tier available |
| **Custom** | Any OpenAI-compatible endpoint (OpenAI, Mistral, Anthropic, etc.) | Varies |

Configure in Settings → test the connection → enable AI analysis. All AI calls use the OpenAI-compatible chat completions format.

---

## Interactive flow graph

The Flow panel provides a canvas-based architecture visualisation powered by React Flow:

- **Auto-layout** — Dagre hierarchical layout (user → frontend → API → services)
- **Drag and reposition** — node positions persist to config
- **Context menus** — right-click nodes to edit, delete, exclude, or add connections
- **Custom connections** — drag between nodes to create edges, set flow types (data/auth/payment/webhook)
- **Node editing** — inline panel for label, type, category, URL, notes
- **Visual coding** — node borders by type (frontend=blue, API=purple, DB=orange), edges by flow type

---

## Scan vs Import — two distinct modes

| Action | What happens |
|---|---|
| **Scan / Open repo** | Fresh analysis from code. Detects services, dependencies, and graph from scratch. No stale data — previous edits are not carried over. |
| **Import config** | Full restore of a previously exported `stackwatch.config.json`. Restores all services (with edits, costs, owners, comments), graph layout, node positions, and edges exactly as saved. Works with or without a repo loaded. |

### Export options

| Action | Format |
|---|---|
| **Export config (.json)** | Full config backup — reimportable to restore your entire stack |
| **Export report (.md)** | Human-readable Markdown table — for documentation and sharing |

---

## Configuration

StackWatch reads `stackwatch.config.json` from the root of the project you're analysing. This file is yours to version — add services, accounts, and metadata that can't be inferred automatically.

```json
{
  "version": "1",
  "source": {
    "type": "local",
    "lastSeenPath": "/home/user/my-project"
  },
  "project": {
    "name": "My web project",
    "description": "Short description"
  },
  "services": [
    {
      "id": "namecheap-domain",
      "name": "Namecheap",
      "category": "domain",
      "plan": "paid",
      "confidence": "high",
      "cost": { "amount": 12, "currency": "USD", "period": "yearly" },
      "renewalDate": "2026-09-01",
      "accountEmail": "admin@example.com"
    }
  ],
  "graph": {
    "nodes": [],
    "edges": [],
    "excludedServices": []
  }
}
```

Full schema and all available fields: [`SPEC.md`](./SPEC.md)

---

## Re-analysis

When re-analysing a project that has manual services, StackWatch shows a confirmation dialog with three options:

- **Keep manual services** — re-run detection and merge with existing manual entries
- **Overwrite everything** — clear manual services and start fresh
- **Cancel** — abort re-analysis

---

## Development

### Stack

- [Electron](https://electronjs.org) 35 — desktop shell
- [React](https://react.dev) 19 + [Vite](https://vitejs.dev) 6 — renderer
- [TypeScript](https://typescriptlang.org) 5.7 — strict mode
- [React Flow](https://reactflow.dev) 11 — interactive flow graph
- [Tailwind CSS](https://tailwindcss.com) 4 — styling
- [Zustand](https://zustand-demo.pmnd.rs/) 5 — state management
- [Octokit](https://github.com/octokit/rest.js) — GitHub API
- [electron-store](https://github.com/sindresorhus/electron-store) — local persistence
- [Recharts](https://recharts.org) — cost charts
- [Vitest](https://vitest.dev) — testing
- [dagre](https://github.com/dagrejs/dagre) — graph layout

### Project structure

```
StackWatch/
├── electron/
│   ├── main.ts              # Main process, 20 IPC handlers, CSP, notifications
│   ├── preload.ts           # Secure renderer bridge (contextBridge, 23 methods)
│   ├── types.ts             # Re-exports from shared/types.ts
│   ├── analyzers/
│   │   ├── index.ts         # Pipeline orchestrator (extract → classify → dedup → AI → flow)
│   │   ├── extractor.ts     # Evidence extraction (env vars, imports, URLs, configs, deps)
│   │   ├── heuristic.ts     # Semantic classification (19 categories)
│   │   ├── deduplicator.ts  # Service grouping and deduplication
│   │   ├── flowInference.ts # Flow graph auto-generation (dagre layout)
│   │   ├── monorepo.ts      # Monorepo detection (npm/pnpm/lerna/turbo/nx)
│   │   ├── vulnScanner.ts   # Vulnerability scanning (OSV.dev, 8 ecosystems)
│   │   ├── stackDiff.ts     # Stack Diff (compare scans, save/load snapshots)
│   │   ├── sbom.ts          # SBOM generator (CycloneDX 1.5, SPDX 2.3)
│   │   ├── zombieDetector.ts # Zombie detection (git log activity per service)
│   │   ├── scoreHistory.ts  # Score history persistence (.stackwatch/)
│   │   └── __tests__/       # 7 test suites
│   └── ai/
│       ├── provider.ts      # OpenAI-compatible client + 3 provider presets
│       ├── deepAnalyzer.ts  # Deep analysis: context, hidden detection, edge inference
│       └── __tests__/       # 2 test suites
├── cli/
│   ├── index.ts             # CLI: scan, init, badge, doctor, --diff, --sbom, --fail-on-*
│   └── tsconfig.json        # CLI-specific TypeScript config
├── shared/
│   └── types.ts             # Canonical type definitions (23 exports)
├── src/
│   ├── App.tsx              # Layout, panel routing, undo/redo keyboard handler
│   ├── constants.ts         # APP_VERSION
│   ├── demoData.ts          # Demo services, dependencies, flows
│   ├── components/
│   │   ├── Dashboard/       # Welcome screen, quick start, keyboard shortcuts
│   │   ├── TopBar/          # Folder picker, GitHub, re-analyze, import/export, share
│   │   ├── Sidebar/         # Panel navigation (5 panels + Stack Score)
│   │   ├── ServicesPanel/   # Service cards, filters, add/edit form, confidence badges
│   │   ├── DepsPanel/       # Virtualized dependencies table, vuln scanning
│   │   ├── CostsPanel/      # Cost breakdown, bar chart (Recharts), renewal alerts, budget mode
│   │   ├── FlowGraph/       # Interactive graph, context menu, node edit panel
│   │   ├── ScoreHistory/    # Score history modal (Recharts line chart, trend stats)
│   │   ├── Settings/        # AI provider config (3 presets), scan mode, theme toggle, share, about
│   │   ├── TitleBar.tsx     # Custom frameless titlebar (minimize/maximize/close)
│   │   ├── ConfirmDialog.tsx # Promise-based confirm modal with focus trap
│   │   ├── ErrorBoundary.tsx # React error boundary with fallback UI
│   │   ├── GitHubModal.tsx  # GitHub repo connection with format validation
│   │   ├── OnboardingTutorial.tsx # 6-step post-scan walkthrough
│   │   ├── Skeleton.tsx     # Skeleton loaders for all panels
│   │   └── Toast.tsx        # Toast notification container
│   ├── store/
│   │   ├── useStore.ts      # Global state (services, deps, config, AI, analysis)
│   │   ├── graphStore.ts    # React Flow state, debounced persist, history
│   │   ├── historyStore.ts  # Undo/redo snapshot stacks (50 max)
│   │   ├── dialogStore.ts   # Promise-based confirm dialog state
│   │   └── toastStore.ts    # Toast notification state
│   ├── utils/
│   │   ├── badge.ts         # Badge generators (score, services, vulns, deps, scanned)
│   │   ├── healthScore.ts   # Stack Score 0-100 calculation
│   │   └── dates.ts         # daysUntil() utility
│   ├── themes.ts            # Dark/light theme CSS variable definitions
│   └── hooks/
│       ├── useDebounce.ts   # Generic debounce hook
│       └── useTheme.ts      # Applies theme CSS variables to document root
├── scripts/
│   ├── launch-electron.js   # WSL-aware Electron launcher
│   └── validate-build.js    # 29-point production build checker
├── build/                   # icon.svg, entitlements.mac.plist, Linux icons
├── .github/workflows/
│   ├── build.yml            # CI: test → build → validate → artifacts (3 platforms)
│   └── stackwatch-scan.yml  # Self-scan on PRs
├── SPEC.md                  # Full technical specification
├── CONTEXT.md               # AI agent context (keep updated)
├── action.yml               # GitHub Action definition
└── stackwatch.config.json   # Example config for analysed projects
```

### Test suites

241 tests across 18 suites:

| Suite | Tests | Coverage |
|---|---|---|
| graphStore | 27 | initFromAnalysis, node/edge CRUD, connect, exclude, resetLayout, persistToConfig |
| vulnScanner | 27 | Ecosystem mapping, batching, OSV parsing, severity, error handling |
| Extractor | 26 | All file types, URL/env/import patterns |
| Deep Analyzer | 19 | refineServicesWithAI, safeParseJSON, malformed responses |
| badge | 17 | SVG generation, shields.io URLs, markdown/HTML formats, color thresholds |
| Deep Analyzer (runDeep) | 13 | Usage context, hidden services, edge types |
| Heuristic | 13 | Category mapping, confidence, name extraction |
| TopBar | 13 | Buttons, repo path, error, analyzing state, link status |
| monorepo | 12 | npm/pnpm/lerna/turbo/nx detection, glob resolution, manifest check |
| historyStore | 12 | push/undo/redo, canUndo/canRedo, clear, 50-snapshot limit |
| healthScore | 11 | Scoring formula weights, perfect/partial/zero scores, edge cases |
| ServiceCard | 10 | Rendering, interactions, confidence, a11y |
| useStore | 10 | mergeServices, ensureConfig, ensureFlowNodes, CRUD |
| Flow inference | 9 | Node types, edge routing, layout |
| ContextMenu | 7 | ARIA roles, click/Escape, dividers |
| Deduplicator | 6 | Grouping, merging, confidence upgrades |
| Pipeline | 6 | End-to-end, AI checkpoint/restore |
| daysUntil | 3 | Today, future, past |

---

## Roadmap

- [x] Architecture and specification (v0.1)
- [x] Project scaffold — Electron + React + Vite + Tailwind CSS v4
- [x] Repo analyzer — package.json, .env, docker-compose, GitHub workflows, config files
- [x] Multi-ecosystem support — Python, Rust, Go, Terraform, Docker, CI/CD
- [x] Semantic heuristic detection (v0.2) — no hardcoded service maps
- [x] Services panel with manual config support (add/edit/delete/filter/search)
- [x] Dependencies panel (table with sort, filter, group by ecosystem)
- [x] Flow graph (auto-generated with React Flow + dagre layout)
- [x] Interactive flow graph (context menus, node editing, custom connections) (v0.3)
- [x] GitHub remote repo support (Octokit integration)
- [x] WSL2 support — auto-detect and launch Windows Electron binary
- [x] Optional AI analysis — usage context, hidden services, edge inference (v0.3.1)
- [x] AI provider presets (Groq, Ollama, LM Studio, OpenAI, Mistral, Anthropic)
- [x] Stack source reference + link status + rescan confirmation (v0.3.2)
- [x] Import/export (JSON config + Markdown table)
- [x] Confidence levels with color-coded borders + editable in form (v0.3.3)
- [x] Unit tests — 135 tests across 12 suites
- [x] Custom frameless titlebar + themed confirmation dialogs (v0.3.4)
- [x] Standalone import (no repo required) + scan mode selector (heuristic/hybrid)
- [x] Generic name filtering to reduce false positives (Admin, $Domain, etc.)
- [x] AI validation & refinement of heuristic results (v0.3.5)
- [x] Security hardening: IPC path validation, GitHub input validation, token sanitization (v0.3.6)
- [x] AI pipeline resilience: checkpoint/restore, category validation, timeout handling, empty ID prevention
- [x] Accessibility: ARIA dialog roles, focus trap, keyboard focus indicators, edge delete confirmation
- [x] File traversal depth limit (15 levels max)
- [x] Costs panel with category aggregation + renewal alerts (v0.3.7)
- [x] Analysis progress phases in top bar
- [x] GitHub modal with real-time repo format validation
- [x] Empty states with actionable CTAs in all panels
- [x] API key show/hide toggle in Settings
- [x] Dashboard demo mode CTA for first-time users
- [x] CSP headers + encrypted API key storage (v0.3.8)
- [x] CI/CD workflow for multi-platform builds (GitHub Actions)
- [x] Error boundary + Sentry scaffold for crash reporting
- [x] 241 tests across 18 suites (stores, analyzers, utils, UI components)
- [x] Enhanced Dashboard with quick start guide, features grid, keyboard shortcuts (v0.3.9)
- [x] Onboarding tutorial (5-step walkthrough after first scan)
- [x] Service ownership + comments fields
- [x] Badge generator + About section in Settings
- [x] Production build validation (29-point checker script)
- [x] UI component tests (ServiceCard, TopBar, ContextMenu)
- [x] Undo/redo with Ctrl+Z/Ctrl+Shift+Z (50-entry history)
- [x] Skeleton loaders during analysis
- [x] Toast notification system
- [x] List virtualization (DepsPanel with @tanstack/react-virtual)
- [x] CLI tool: `npx stackwatch` (scan, init, badge, doctor, --json, --md, --diff, --sbom, --fail-on-vulns, --fail-on-unreviewed)
- [x] GitHub Action for PR scanning with auto-comments
- [x] macOS / Windows / Linux distributable builds (electron-builder: dmg, nsis, AppImage, deb)
- [x] Monorepo support (npm workspaces, pnpm, lerna, turborepo, nx)
- [x] Dynamic Stack Score badge (SVG generator + shields.io) + vuln, deps, scanned badges
- [x] Vulnerability detection (OSV.dev API, 8 ecosystems)
- [x] Stack Diff between scans (--diff flag, .stackwatch/last-scan.json)
- [x] SBOM generation (CycloneDX 1.5 + SPDX 2.3, --sbom flag)
- [x] Desktop renewal notifications (OS-level alerts for services expiring within 30 days)
- [x] Cost visualization bar chart (Recharts, breakdown by category)
- [x] Zombie service detection (git log cross-reference, 6+ months = zombie)
- [x] Stack Score history with trend tracking (up/down/unchanged per scan)
- [x] `stackwatch doctor` CLI command (actionable health checklist: config, ownership, costs, vulns, score)
- [x] Budget mode in Costs panel (monthly budget, progress bar, threshold alerts, persisted in config)
- [x] Score history UI (line chart modal, trend indicators, min/max/average stats)
- [x] Light/dark theme toggle (CSS variables, Settings + Sidebar, localStorage persistence)

---

## Contributing

StackWatch is in active development. If you want to contribute, read `SPEC.md` and `CONTEXT.md` first — they contain everything an AI agent or human developer needs to get up to speed.

---

## License

MIT
