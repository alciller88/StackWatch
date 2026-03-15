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

> ⚠️ Pre-release — not yet available for download. See [Development](#development) to run locally.

```bash
git clone https://github.com/YOUR_USERNAME/StackWatch.git
cd StackWatch
npm install
npm run dev
```

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

### Prerequisites

- Node.js 20+
- npm 10+

### Platform notes

| Environment | Behaviour |
|---|---|
| **Windows native** (cmd / PowerShell) | Works out of the box |
| **WSL2** (Ubuntu on Windows) | `npm install` auto-installs system libs; `npm run dev` launches the Windows Electron binary |
| **macOS** | Works out of the box |

On WSL2, the postinstall hook (`scripts/setup.js`) may ask for `sudo` to install system dependencies (libnss3, libatk, etc.). If you prefer to skip this, install them manually:

```bash
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

### Stack

- [Electron](https://electronjs.org) — desktop shell
- [React](https://react.dev) + [Vite](https://vitejs.dev) — renderer
- [React Flow](https://reactflow.dev) — interactive flow graph
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Octokit](https://github.com/octokit/rest.js) — GitHub API
- [electron-store](https://github.com/sindresorhus/electron-store) — local persistence

### Run in development

```bash
npm run dev          # starts Electron + Vite with HMR
npm run test         # unit tests (Vitest)
npm run build        # production build
```

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
