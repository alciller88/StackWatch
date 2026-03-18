# StackWatch

> Stop guessing what your project depends on.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Latest Release](https://img.shields.io/github/v/release/alciller88/StackWatch)](https://github.com/alciller88/StackWatch/releases/latest)

StackWatch scans your codebase and automatically maps every service, API, database, and paid account your project uses — with costs, renewal dates, and an interactive architecture graph.

**Zero config. Works offline. 10 seconds to your first scan.**

<p align="center">
  <img src="docs/screenshots/StackWatch1.png" alt="StackWatch Dashboard" width="800" />
</p>

---

## Dashboard

Five panels:

| Panel | What you see |
|---|---|
| **Services** | Every external service: inferred + manual, with cost and renewal alerts, confidence badges, evidence breakdown popover, and AI-generated usage context |
| **Dependencies** | Full dependency tree (npm, pip, cargo, go, composer, dart, maven, gradle, gem) with vulnerability scanning |
| **Discarded** | Items filtered during analysis (low score, AI filter, generic terms) — with search, filter by reason, and restore button |
| **Flow graph** | Interactive node graph of your app's architecture with drag-and-drop editing, custom connections, and context menus |
| **Costs** | Cost breakdown by category with bar chart, monthly/yearly totals, renewal alerts, and budget mode with progress bar |
| **Settings** | AI provider configuration (Local / Cloud / Custom) with connection testing, theme toggle (dark/light) |

---

## Download

Pre-built binaries for all platforms are available on the [Releases page](https://github.com/alciller88/StackWatch/releases/latest):

| Platform | Download |
|---|---|
| **Windows** | `.exe` installer or portable `.exe` |
| **macOS** | `.dmg` (universal — Intel + Apple Silicon) |
| **Linux** | `.AppImage` or `.deb` |

No build required — download, install, and scan.

---

## Getting started (from source)

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
| `npm test` | Run unit tests (372 tests across 26 suites) |
| `npm run release` | Validate, tag current version, push tag (triggers CI release) |

### Your first scan in 4 steps

1. **Open a folder, connect a GitHub repo, or start a Blank Stack** — click "Open folder" in the top bar, use the GitHub icon to enter `owner/repo`, or click "Blank Stack" on the Dashboard to build your architecture manually
2. **Review detected services** — StackWatch scans automatically and shows every service it found, with confidence levels. Click the `?` button on any card to see the evidence breakdown (which env vars, imports, and config files contributed to the detection)
3. **Add what's missing** — manually add services that have no code footprint (domains, SaaS accounts, billing). Fill in cost, renewal date, and owner for each service
4. **Re-analyze anytime** — click the re-analyze button when your stack changes. Choose Merge to keep your manual edits, or Fresh Scan to start over

### AI setup (optional)

StackWatch works 100% offline with heuristic detection. For deeper analysis, configure an AI provider in **Settings**:

| Provider | Setup | Cost |
|---|---|---|
| **Local** (Ollama / LM Studio) | Install Ollama, pull a model (`ollama pull llama3.2`), select "Local" preset | Free |
| **Cloud** (Groq) | Sign up at groq.com, paste API key, select "Cloud (Groq)" preset | Free tier |
| **Custom** | Any OpenAI-compatible endpoint — paste base URL, model name, and API key | Varies |

With AI enabled, set scan mode to **Hybrid** in Settings. The AI will filter false positives, validate low-confidence detections, analyze usage context, detect hidden services, and suggest cheaper alternatives.

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

# Export self-contained HTML report
npx stackwatch --html > report.html

# Show ALL services including low-confidence and needs-review
npx stackwatch --all
```

The CLI uses the same heuristic engine as the desktop app — zero config, works offline, instant results. By default, low-confidence and needs-review services are hidden; use `--all` to see everything.

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

StackWatch uses **semantic evidence scoring** — not hardcoded service maps — to detect services from your codebase. Each evidence type (config files, CI secrets, env vars, URLs, npm packages) receives a quality score. The deduplicator sums scores and applies confidence thresholds, ensuring only well-evidenced services appear in results.

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

Each detected service is assigned a confidence level based on the sum of its **best score per unique evidence type** (not per instance — 50 imports of the same package still scores 1):

| Level | Score range | Meaning | Card border |
|---|---|---|---|
| **High** | > 10 | Confirmed service — multiple evidence types | Green |
| **Low** | 6–10 | Grey zone — AI validates if configured | Orange dashed |

Evidence type scores: config files (10), CI secrets (8), credential env vars (7), endpoint env vars (6), URLs (5), generic env vars (2), npm packages/imports (1). Services scoring below 6 are automatically discarded.

Services with low confidence appear in a "Needs Review" section at the top of the panel.

---

## AI analysis (optional)

StackWatch works 100% offline without AI. Two scan modes are available in **Settings**:

| Mode | Speed | Requires AI | Description |
|------|-------|-------------|-------------|
| **Heuristic only** | Fast | No | Pattern-based detection (~80% coverage). Default. |
| **Heuristic + AI** | Medium | Yes | Heuristics first, then AI filters false positives, validates, refines, and discovers hidden services (~95%) |

When Heuristic + AI is enabled, the AI pipeline runs in two phases:

**Phase 1 — Validation & refinement** (only medium/low confidence services — high confidence skipped):
- Removes false positives (libraries mistaken for services)
- Fixes wrong categories
- Adjusts confidence levels
- Merges duplicate detections of the same service
- Capped at ≤40 services to avoid rate limits; silently skipped if exceeded

**Phase 2 — Deep analysis** enriches results with four capabilities:

| Capability | What it does |
|---|---|
| **Usage context** | For each service, AI reads your code and explains how it's used, its criticality (critical/important/optional), and detects warnings (hardcoded secrets, missing error handling) |
| **Hidden service detection** | AI scans priority files (lib/, services/, api/) and finds services consumed via wrappers or SDKs that static analysis missed |
| **Graph edge inference** | AI determines the correct connection type (data/auth/payment/webhook) for each service based on usage context |
| **Stack alternatives** | For paid/commercial services, suggests 1-2 cheaper or open-source alternatives with estimated savings |

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

- **Auto-layout** — Dagre 4-layer hierarchical layout (user → frontend/backend → category groups → services)
- **Layer nodes** — organizational nodes (User, Frontend, Backend) with distinct styling (200x56, uppercase bold, colored borders)
- **Drag and reposition** — node positions persist to config
- **Context menus** — right-click nodes to edit, delete, exclude, or add connections; right-click canvas to add service/custom/layer nodes
- **Custom connections** — drag between nodes to create edges, set flow types (data/auth/payment/webhook)
- **Node editing** — inline panel for label, type, category, URL, notes
- **Visual coding** — node borders by type (layer=gold, DB=orange, service=pink), edges by flow type

---

## Three ways to start

| Action | What happens |
|---|---|
| **Scan / Open repo** | Analysis from code. If saved data exists, prompts to **Merge** (keep manual changes + positions) or **Fresh Scan** (discard everything). |
| **Blank Stack** | No scan. Starts with an empty canvas and a single USER node. Build your architecture manually — add services, nodes, and connections by hand. Save via Export. |
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

## Scan mode dialog

When re-scanning a repo that already has saved data (manual services, graph positions, or config), StackWatch shows a **Scan Mode Dialog** with two options:

- **Merge** (default) — keeps manually added services and graph positions for existing nodes. New nodes are placed by dagre. Press Enter to confirm.
- **Fresh Scan** — discards all manual services, graph positions, and saved config. Starts with a clean dagre layout. Shows a warning: "Manual changes will be lost."
- **Escape** — cancels without scanning.

If the repo has no saved data, the dialog is skipped and StackWatch goes straight to a merge scan.

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
│   ├── preload.ts           # Secure renderer bridge (contextBridge, 24 methods)
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
│   ├── ai/
│   │   ├── provider.ts      # OpenAI-compatible client + 3 provider presets
│   │   ├── deepAnalyzer.ts  # Deep analysis: context, hidden detection, edge inference, alternatives
│   │   ├── alternativeSuggester.ts # AI stack alternatives (cheaper/open-source suggestions)
│   │   └── __tests__/       # 2 test suites
│   └── exporters/
│       └── htmlExporter.ts  # Self-contained HTML report generator
├── cli/
│   ├── index.ts             # CLI: scan, init, badge, doctor, --diff, --sbom, --html, --all, --fail-on-*
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
│   │   ├── DiscardedPanel/ # Discarded items: search, filter, restore
│   │   ├── CostsPanel/      # Cost breakdown, bar chart (Recharts), renewal alerts, budget mode
│   │   ├── Doctor/          # Doctor modal (health checklist: config, services, costs, vulns, score)
│   │   ├── FlowGraph/       # Interactive graph, context menu, node edit panel
│   │   ├── ScanProgress/   # Real-time scan progress (progress bar, phases, cancel)
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
│   ├── build.yml            # CI: test → build → validate → artifacts → release on v* tags
│   └── stackwatch-scan.yml  # Self-scan on PRs
├── SPEC.md                  # Full technical specification
├── CONTEXT.md               # AI agent context (keep updated)
├── action.yml               # GitHub Action definition
└── stackwatch.config.json   # Example config for analysed projects
```

### Test suites

372 tests across 26 suites:

| Suite | Tests | Coverage |
|---|---|---|
| graphStore | 27 | initFromAnalysis, node/edge CRUD, connect, exclude, resetLayout, persistToConfig |
| vulnScanner | 27 | Ecosystem mapping, batching, OSV parsing, severity, error handling |
| Extractor | 26 | All file types, URL/env/import patterns |
| Deep Analyzer | 24 | refineServicesWithAI (medium/low), filterFalsePositivesWithAI (≤40), safeParseJSON |
| badge | 17 | SVG generation, shields.io URLs, markdown/HTML formats, color thresholds |
| htmlExporter | 13 | HTML structure, sections, XSS escaping, budget, print styles |
| Deep Analyzer (runDeep) | 13 | Usage context, hidden services, edge types |
| Heuristic | 32 | Category mapping, semantic scoring, name extraction, penalties |
| TopBar | 13 | Buttons, repo path, error, analyzing state, link status |
| zombieDetector | 12 | Classification thresholds, caching, enrichment, git failure handling |
| monorepo | 12 | npm/pnpm/lerna/turbo/nx detection, glob resolution, manifest check |
| historyStore | 12 | push/undo/redo, canUndo/canRedo, clear, 50-snapshot limit |
| healthScore | 11 | Scoring formula weights, perfect/partial/zero scores, edge cases |
| alternativeSuggester | 10 | AI response parsing, filtering, error handling, ID mapping |
| ServiceCard | 12 | Rendering, interactions, confidence, a11y, evidence info popover |
| scanDiff | 7 | Added/removed detection, empty lists, first scan |
| useStore | 19 | mergeServices, ensureConfig, ensureFlowNodes, CRUD, ScanModeDialog (merge/fresh/cancel), reactive stackScore |
| Flow inference | 17 | 4-layer hierarchy, virtual nodes, category routing, edge generation |
| scoreHistory | 8 | Load/append, trimming, directory creation, invalid JSON |
| ContextMenu | 7 | ARIA roles, click/Escape, dividers |
| DiscardedPanel | 7 | Rendering, reason badges, restore, scores, empty state |
| Deduplicator | 23 | Grouping, merging, best-per-type scoring, thresholds, brand collapse, discarded tracking |
| Pipeline | 7 | End-to-end, AI checkpoint/restore, npm-only discard |
| Pipeline Integration | 4 | Fixture repo: Stripe/Sentry/PostgreSQL detection, no false positives |
| ScanProgress | 9 | Rendering, phases, counters, cancel, Done state |
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
- [x] 331 tests across 22 suites (stores, analyzers, exporters, AI, utils, UI components)
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
- [x] Static HTML export (self-contained dashboard report, --html flag, print-friendly)
- [x] AI stack alternatives (cheaper/open-source suggestions per service in deep analysis)
- [x] Zombie UI badges and activity status filter in Services panel
- [x] Doctor modal in desktop app (interactive health checklist with live vuln scan)
- [x] Scan mode dialog: merge (keep manual + positions) vs fresh scan on re-analyze
- [x] Discarded panel: virtualized list of filtered items with search, reason filter, restore to manual service
- [x] 363 tests across 25 suites (+10 DiscardedPanel and deduplicator tracking tests)
- [x] Layer node type: organizational nodes (User, Frontend, Backend) use type: 'layer' with custom colors and sizing
- [x] "Add layer node" in canvas context menu, layer-specific icons, no confidence badges
- [x] Evidence info popover: "Why was this detected?" button on service cards with score breakdown
- [x] Graph diff visual: green highlight for new nodes, grey strikethrough for removed (3s after re-scan)
- [x] 363 tests across 25 suites (+9 scanDiff and evidence popover tests)
- [x] Release automation: GitHub Release with platform binaries on version tags (v*), `npm run release` convenience script
- [x] Sensitive field encryption: accountEmail/owner/notes stored as $encrypted: references in config JSON
- [x] Error handling: configurable toast timeouts (8s for errors), AI/save/empty-scan toasts
- [x] 29-point build validation: all checks passing
- [x] Integration tests with fixture repo (Stripe, Sentry, PostgreSQL detection, no false positives)
- [x] User docs: 4-step first scan guide, AI setup guide, CLI/GitHub Action examples
- [x] Blank Stack mode: start with empty canvas + USER node, build architecture manually, no repo required
- [x] Reactive Stack Score: recalculates in real-time after every service/graph mutation, debounced history persistence with scan/manual source differentiation
- [x] Scan progress screen: real-time progress bar with CRT effect, phase text with blinking cursor, counters, cancel with AbortController
- [x] 372 tests across 26 suites (+9 ScanProgress tests)
- [x] Fix: race condition in graphStore `persistToConfig` — serialized write lock
- [x] Fix: circular dependency graphStore ↔ useStore — `registerServiceGetter()` callback pattern
- [x] Fix: typed `electron-store` (`Store<StoreSchema>`) instead of `any`
- [x] Fix: GitHub scans now return score entry (parity with local scans)
- [x] Fix: scan diff cleanup timer properly cancelled on re-scan
- [x] Fix: toast slide-in animation keyframes
- [x] Semantic color CSS variables (danger, success, warning, badge-bg/border) with dark/light theme variants
- [x] Replaced ~40 hardcoded hex colors across 15 components with theme-aware CSS variables
- [x] WCAG AA contrast: adjusted text-secondary and text-muted for 4.5:1 ratio
- [x] Accessibility: aria-label on all search inputs, unified panel headers (h2 text-sm)
- [x] DiscardedPanel: search icon for consistency
- [x] ScanProgress: replaced JS hover handlers with Tailwind hover: classes
- [x] ContextMenu: ArrowDown/ArrowUp keyboard navigation with auto-focus

---

## Contributing

StackWatch is in active development. If you want to contribute, read `SPEC.md` and `CONTEXT.md` first — they contain everything an AI agent or human developer needs to get up to speed.

---

## License

MIT
