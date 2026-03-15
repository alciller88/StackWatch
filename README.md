# StackWatch

**Know your stack, own your stack.**

StackWatch is a desktop app (Electron + React) that scans your repository and maps every service, dependency, and external account your project depends on — automatically inferred from your codebase, enriched manually for what can't be detected.

---

## The problem

Modern web projects run on dozens of external services: domains, hosting, CI/CD, analytics, payments, APIs... spread across multiple accounts and providers. There's no single place to see the full picture.

## What StackWatch does

- **Scans your repo** — reads `package.json`, `.env.example`, `docker-compose.yml`, GitHub Actions workflows and more to detect services automatically
- **Maps your stack** — visualises services, dependencies and app flow in a unified dashboard
- **Tracks what matters** — plan (free/paid), renewal dates, costs, account emails
- **Stays in your repo** — all manual data lives in `stackwatch.config.json`, versioned alongside your code

---

## Dashboard

Three panels:

| Panel | What you see |
|---|---|
| **Services** | Every external service: inferred + manual, with cost and renewal alerts |
| **Dependencies** | Full npm/pip/cargo dependency tree with ecosystem links |
| **Flow graph** | Interactive node graph of your app's architecture |

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
| `npm test` | Run unit tests |

---

## Configuration

StackWatch reads `stackwatch.config.json` from the root of the project you're analysing. This file is yours to version — add services, accounts, and metadata that can't be inferred automatically.

```json
{
  "version": "1",
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
      "cost": { "amount": 12, "currency": "USD", "period": "yearly" },
      "renewalDate": "2026-09-01",
      "accountEmail": "admin@example.com"
    }
  ]
}
```

Full schema and all available fields: [`SPEC.md`](./SPEC.md)

---

## Supported sources

- **Local repo** — point StackWatch at any folder on your machine
- **GitHub repo** — enter `owner/repo` + a personal access token (read-only scope)

---

## Auto-detected services

StackWatch recognises services by environment variable patterns, dependencies, and config files:

| Pattern | Service |
|---|---|
| `STRIPE_*` | Stripe |
| `SENDGRID_*` | SendGrid |
| `DATABASE_URL` | Database (postgres / mysql / mongodb) |
| `NEXT_PUBLIC_GA_*` | Google Analytics |
| `SENTRY_*` | Sentry |
| `AWS_*` | Amazon Web Services |
| `VERCEL_*` | Vercel |
| `TWILIO_*` | Twilio |

Full detection rules: [`SPEC.md § 3.1`](./SPEC.md)

---

## Development

### Stack

- [Electron](https://electronjs.org) — desktop shell
- [React](https://react.dev) + [Vite](https://vitejs.dev) — renderer
- [React Flow](https://reactflow.dev) — interactive flow graph
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Octokit](https://github.com/octokit/rest.js) — GitHub API
- [electron-store](https://github.com/sindresorhus/electron-store) — local persistence

### Project structure

```
StackWatch/
├── electron/
│   ├── main.ts              # Main process, IPC handlers
│   ├── preload.ts           # Secure renderer bridge
│   └── analyzers/           # One module per file type
├── scripts/
│   ├── launch-electron.js   # WSL-aware Electron launcher
│   └── setup.js             # Postinstall: system deps on WSL
├── src/
│   ├── components/
│   │   ├── ServicesPanel/
│   │   ├── DepsPanel/
│   │   └── FlowGraph/
│   └── store/               # Zustand global state
├── SPEC.md                  # Full technical specification
├── CONTEXT.md               # AI agent context (keep updated)
└── stackwatch.config.json   # Example config for analysed projects
```

---

## Roadmap

- [x] Architecture and specification (v0.1)
- [x] Project scaffold — Electron + React + Vite + Tailwind CSS v4
- [x] Repo analyzer — `package.json`, `.env`, `docker-compose`, GitHub workflows, config files
- [x] Services panel with manual config support (add/filter/search)
- [x] Dependencies panel (table with sort, filter, group by type)
- [x] Flow graph (auto-generated with React Flow + dagre layout)
- [x] GitHub remote repo support (Octokit integration)
- [x] WSL2 support — auto-detect and launch Windows Electron binary
- [ ] Unit tests for analyzers
- [ ] Runtime validation and polish
- [ ] macOS / Windows / Linux builds

---

## Contributing

StackWatch is in early development. If you want to contribute, read `SPEC.md` and `CONTEXT.md` first — they contain everything an AI agent or human developer needs to get up to speed.

---

## License

MIT
