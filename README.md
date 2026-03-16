# StackWatch

**Know your stack, own your stack.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

StackWatch is a desktop app (Electron + React) that scans your repository and maps every service, dependency, and external account your project depends on — automatically inferred from your codebase, enriched with optional AI analysis, and complemented with manual entries for what can't be detected.

---

## The problem

Modern software projects run on dozens of external services: domains, hosting, CI/CD, analytics, payments, APIs... spread across multiple accounts and providers. There's no single place to see the full picture.

## What StackWatch does

- **Scans your repo** — reads package.json, .env, docker-compose, CI configs, Terraform, and source code across 8+ languages to detect services automatically
- **Optional AI analysis** — deep analysis enriches results with usage context, criticality levels, hidden service detection, and smart graph edge inference
- **Maps your stack** — visualises services, dependencies and app flow in a unified four-panel dashboard
- **Tracks what matters** — plan (free/paid), renewal dates, costs, account emails, confidence levels
- **Stays in your repo** — all manual data lives in `stackwatch.config.json`, versioned alongside your code

---

## Dashboard

Four panels:

| Panel | What you see |
|---|---|
| **Services** | Every external service: inferred + manual, with cost and renewal alerts, confidence badges, and AI-generated usage context |
| **Dependencies** | Full dependency tree (npm, pip, cargo, go, composer, dart, maven, gradle, gem) with ecosystem links |
| **Flow graph** | Interactive node graph of your app's architecture with drag-and-drop editing, custom connections, and context menus |
| **Settings** | AI provider configuration with connection testing and provider presets |

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
| `npm test` | Run unit tests (58 tests across 5 suites) |

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

| Provider | Type | Cost |
|---|---|---|
| **Groq** (recommended) | Cloud | Free tier available |
| **Ollama** (recommended) | Local | Free, self-hosted |
| **LM Studio** | Local | Free, self-hosted |
| **OpenAI** | Cloud | Paid |
| **Mistral** | Cloud | Paid |
| **Anthropic** | Cloud | Paid |
| **Custom** | Any OpenAI-compatible endpoint | Varies |

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

## Import & export

| Action | Format |
|---|---|
| **Import config** | Load an existing `stackwatch.config.json` — works with or without a repo loaded (standalone = unlinked) |
| **Export config** | Save full config as JSON (all services, accounts, graph layout) — reimportable |
| **Export report** | Save services as a formatted Markdown table — read-only documentation |

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
- [Vitest](https://vitest.dev) — testing
- [dagre](https://github.com/dagrejs/dagre) — graph layout

### Project structure

```
StackWatch/
├── electron/
│   ├── main.ts              # Main process, IPC handlers (15 channels)
│   ├── preload.ts           # Secure renderer bridge (contextBridge)
│   ├── types.ts             # Shared types (Service, Dependency, FlowNode, etc.)
│   ├── analyzers/
│   │   ├── extractor.ts     # Evidence extraction from repo files
│   │   ├── heuristic.ts     # Semantic classification (19 categories)
│   │   ├── deduplicator.ts  # Service grouping and deduplication
│   │   ├── flowInference.ts # Flow graph auto-generation (dagre layout)
│   │   ├── index.ts         # Pipeline orchestrator (extract → classify → dedup → AI → flow)
│   │   └── __tests__/       # 58 tests (heuristic, deduplicator, extractor, pipeline, flowInference)
│   └── ai/
│       ├── provider.ts      # OpenAI-compatible AI client + 6 provider presets
│       └── deepAnalyzer.ts  # Deep analysis: context, hidden detection, edge inference
├── scripts/
│   ├── launch-electron.js   # WSL-aware Electron launcher
│   └── setup.js             # Postinstall: system deps on WSL
├── src/
│   ├── components/
│   │   ├── TitleBar.tsx     # Custom frameless titlebar (minimize/maximize/close)
│   │   ├── ConfirmDialog.tsx # Themed confirmation modals (replaces native OS dialogs)
│   │   ├── Dashboard/       # Welcome screen + loading state
│   │   ├── TopBar/          # Folder picker, GitHub, re-analyze, import/export, link status
│   │   ├── Sidebar/         # Panel navigation (4 panels)
│   │   ├── ServicesPanel/   # Service cards, filters, add/edit form, confidence badges
│   │   ├── DepsPanel/       # Dependencies table with sort/filter
│   │   ├── FlowGraph/       # Interactive graph, context menu, node edit panel
│   │   └── Settings/        # AI provider config, scan mode selector, connection testing
│   ├── store/
│   │   ├── useStore.ts      # Global Zustand state (services, deps, config, AI)
│   │   ├── graphStore.ts    # Graph-specific state (nodes, edges, excluded)
│   │   └── dialogStore.ts   # Promise-based confirm dialog state
│   └── types.ts             # Renderer-side type definitions
├── SPEC.md                  # Full technical specification
├── CONTEXT.md               # AI agent context (keep updated)
└── stackwatch.config.json   # Example config for analysed projects
```

### Test suites

| Suite | Tests | Coverage |
|---|---|---|
| Heuristic classifier | 13 | Category mapping, confidence, name extraction |
| Deduplicator | 6 | Grouping, merging, confidence upgrades |
| Extractor | 26 | All file types, URL/env/import patterns |
| Pipeline | 4 | End-to-end analysis flow |
| Flow inference | 9 | Node types, edge routing, layout |

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
- [x] Unit tests — 58 tests across 5 suites
- [x] Custom frameless titlebar + themed confirmation dialogs (v0.3.4)
- [x] Standalone import (no repo required) + scan mode selector (heuristic/hybrid)
- [x] Generic name filtering to reduce false positives (Admin, $Domain, etc.)
- [x] AI validation & refinement of heuristic results (v0.3.5)
- [ ] Production build validation
- [ ] UI component tests
- [ ] macOS / Windows / Linux distributable builds
- [ ] Monorepo support

---

## Contributing

StackWatch is in active development. If you want to contribute, read `SPEC.md` and `CONTEXT.md` first — they contain everything an AI agent or human developer needs to get up to speed.

---

## License

MIT
