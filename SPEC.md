# SPEC.md — StackWatch

> Technical specification. Source of truth for data model, API contracts, and feature behavior.
> Version: v0.9.0 | Last updated: 2026-03-18 | Tests: 412 across 29 suites
>
> Release: [v0.8.0](https://github.com/alciller88/StackWatch/releases/tag/v0.8.0)

---

## 1. Product Overview

**StackWatch** is a desktop application (Electron), CLI tool, and GitHub Action that detects, visualizes, and monitors all services, dependencies, and external accounts in a software project — via semantic heuristic inference with optional AI enrichment.

### 1.1 Problem

Modern projects depend on dozens of external services spread across multiple accounts and providers. There is no unified view of the ecosystem — what it costs, when things renew, or how it connects.

### 1.2 Value Proposition

- **Semantic inference**: detects services via heuristic scoring — no hardcoded service lists
- **Optional AI**: enhances detection with any OpenAI-compatible provider (cloud or local)
- **Triple delivery**: desktop app + CLI + GitHub Action
- **Portable**: all data lives in the repo as versionable JSON
- **CI gates**: fail pipelines on vulnerabilities or unreviewed services
- **SBOM compliance**: CycloneDX 1.5 and SPDX 2.3 generation

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| App shell | Electron | 35 |
| UI / renderer | React + Vite | 19 / 6 |
| Language | TypeScript (strict) | 5.7 |
| Styles | Tailwind CSS | 4 |
| State | Zustand | 5 |
| Interactive graph | React Flow | 11 |
| Graph layout | dagre | — |
| Cost charts | Recharts | 3 |
| Dep virtualization | @tanstack/react-virtual | — |
| Remote GitHub | Octokit (`@octokit/rest`) | — |
| Local persistence | electron-store | 10 |
| Testing | Vitest + @testing-library/react + jsdom | — |
| IPC validation | zod | — |
| Build | electron-builder | 26 |
| CI/CD | GitHub Actions | — |

---

## 3. Architecture

### 3.1 Process Model

```
┌─────────────────────────────────────────────┐
│ Main Process (electron/main.ts)             │
│  ├── IPC handlers (26 channels)             │
│  ├── TypedStore<StoreSchema> (encrypted)    │
│  ├── Analyzers (pure Node.js)               │
│  ├── AI client (OpenAI-compatible)          │
│  ├── Vuln scanner (OSV.dev API)             │
│  ├── SBOM generator (CycloneDX / SPDX)     │
│  ├── Stack Diff / Zombie detector           │
│  ├── Score history (.stackwatch/)           │
│  ├── HTML exporter (self-contained report)  │
│  └── CSP headers (production only)          │
├─────────────────────────────────────────────┤
│ Preload (electron/preload.ts)               │
│  └── contextBridge — exposes StackWatchAPI  │
├─────────────────────────────────────────────┤
│ Renderer (src/)                             │
│  ├── Stores: useStore, graphStore,          │
│  │   dialogStore, toastStore, historyStore  │
│  ├── 6 panels: Dashboard, Services, Deps,  │
│  │   Discarded, Flow, Costs                 │
│  ├── Settings, ScoreHistory, Doctor modals  │
│  ├── Theme system (dark/light CSS vars)     │
│  ├── Scan progress screen (replaces panel)  │
│  └── Undo/redo (Ctrl+Z / Ctrl+Shift+Z)     │
└─────────────────────────────────────────────┘
```

### 3.2 Type System

```
shared/types.ts          ← canonical source: SERVICE_CATEGORIES, all interfaces
  ↗ src/types.ts         ← re-exports + declares Window.stackwatch
  ↗ electron/types.ts    ← re-exports
```

`SERVICE_CATEGORIES` is a `const` array. The `ServiceCategory` union type is derived from it. No duplicated category list anywhere.

---

## 4. Detection Pipeline

```
repo (local or GitHub)
    ↓
Evidence extractor  →  Evidence[]
    ↓
Heuristic classifier  →  HeuristicResult[]
    ↓
Deduplicator  →  DetectedService[]  +  DiscardedItem[]
    ↓ (if AI configured)
AI filter  →  semantic false-positive removal
    ↓
AI refine  →  category/confidence fixes
    ↓
AI deep analysis  →  usage context + hidden services + edge types + alternatives
    ↓
Zombie detector  →  git log activity classification
    ↓
Flow inference  →  FlowNode[] + FlowEdge[]  (dagre layout)
    ↓
Merge with stackwatch.config.json
    ↓
Dashboard / CLI output / PR comment
```

Pipeline emits `scan-progress` IPC events at each phase. Supports `AbortSignal` for cancellation.

### 4.1 Evidence Extractor (`extractor.ts`)

Walks the repo recursively (max 15 levels, respects `.gitignore`) and extracts raw signals.

| Evidence Type | Source | Method |
|---|---|---|
| `npm_package` | `package.json` (all levels) | Reads dependencies + devDependencies |
| `env_var` | `.env*` files | Parses key=value, detects credentials |
| `url` | Code files (12 languages) | Regex in API call patterns |
| `import` | Code files | `from '...'` and `require('...')` |
| `config_file` | Repo root | Presence of vercel.json, firebase.json, etc. |
| `ci_secret` | CI workflow files | `secrets.NAME` patterns |
| `domain` | All code | Domain extraction from URLs |

**Supported languages**: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, `.rb`, `.java`, `.kt`, `.swift`, `.dart`, `.cs`, `.php`

**Dependency ecosystems (9)**: npm, pip, cargo, go, composer, gem, maven, gradle, pub

**Exclusions**: `node_modules`, `dist`, `.next`, `build`, `.git`, `coverage`, `vendor` + `.gitignore`

### 4.2 Heuristic Classifier (`heuristic.ts`)

Semantic scoring classification — no hardcoded service allowlists.

**Base scores by evidence type:**

| Evidence Type | Score | Example |
|---|---|---|
| `config_file` | 10 | `vercel.json`, docker-service:postgres |
| `ci_secret` | 8 | `secrets.STRIPE_KEY` |
| `env_var` (credential suffix) | 7 | `STRIPE_SECRET_KEY` |
| `env_var` (endpoint suffix) | 6 | `REDIS_URL` |
| `url` (external domain) | 5 | `https://api.stripe.com/v1` |
| `env_var` (generic) | 2 | `GA_MEASUREMENT_ID` |
| `import` / `npm_package` | 1 | `stripe`, `@sentry/node` |

**Score penalties:**

| Condition | Penalty |
|---|---|
| Config suffix (`_ENABLED`, `_LIMIT`, `_PRICE`, etc.) | -5 |
| Descriptive phrase (>2 words) | -3 |
| Contains project name | -10 |

**Hard filters** (excluded entirely): system variables (`NODE_ENV`, `PORT`), CI patterns (`EXIT_CODE`, `DEVIN_*`), feature flags (`IS_*`, `ENABLE_*`), Node.js built-ins, generic names.

**Category inference**: semantic regex against normalized name for 19 categories.

### 4.3 Deduplicator (`deduplicator.ts`)

Groups related detections and applies score-based confidence.

- **Best-score-per-type**: tracks highest score per unique evidence type (not additive per instance)
- **Final score** = sum of best scores across unique evidence types
- **Confidence thresholds**: `< 6` discard, `6-10` low + `needsReview`, `> 10` high
- **Brand collapse**: "BrandName + descriptor" entries merge (e.g., "Cloudflare Sitekey" + "Cloudflare Turnstile" → "Cloudflare")
- **Generic removal**: removes generic entries when a specific service exists in the same category
- Tracks `DiscardedItem[]` with reason (`low_score`, `generic_term`)

### 4.4 Monorepo Support (`monorepo.ts`)

Detects 5 monorepo types: npm workspaces, pnpm-workspace.yaml, lerna.json, turbo.json, nx.json. Resolves glob patterns, scans each workspace separately, merges results.

### 4.5 AI Analysis (`ai/deepAnalyzer.ts`)

Only runs when user configures an AI provider. Five capabilities:

| Step | Function | Scope |
|---|---|---|
| 0 | False-positive filter | ALL services (≤100), catches generic names |
| 0b | Service refinement | Medium/low confidence only |
| 1 | Service context | Usage, criticality, warnings per service |
| 2 | Hidden service detection | Services consumed via wrappers |
| 3 | Smart graph edges | Correct edge types from usage context |
| 4 | Stack alternatives | Cheaper/open-source suggestions |

**Provider presets**: Local (Ollama/LM Studio), Cloud (Groq), Custom (any OpenAI-compatible).

**Token control**: max 5 files/service, 500 lines/file, batches of 3 concurrent calls, 60s timeout. Silent fallback on failure.

### 4.6 Vulnerability Scanner (`vulnScanner.ts`)

Batch queries OSV.dev API. Maps 8 ecosystems (npm, PyPI, crates.io, Go, Packagist, RubyGems, Maven, Pub). Batches of 100, max 5 vulns per dependency. Graceful failure on network errors.

### 4.7 Stack Diff (`stackDiff.ts`)

Compares scan snapshots via `.stackwatch/last-scan.json`. Computes added/removed/changed services and dependencies.

### 4.8 SBOM Generator (`sbom.ts`)

CycloneDX 1.5 and SPDX 2.3 (JSON) from detected dependencies. Maps all ecosystems to PURL types. No external dependencies.

### 4.9 Zombie Detector (`zombieDetector.ts`)

Cross-references services with `git log`. Classifies as **active** (<90d), **stale** (90-179d), or **zombie** (180d+). Local repos only, silent fallback.

### 4.10 Score History (`scoreHistory.ts`)

Persists health scores to `.stackwatch/score-history.json`. Max 100 entries. Source: `'scan'` or `'manual'` (debounced 2s).

### 4.11 Flow Inference (`flowInference.ts`)

4-layer hierarchical graph: User → Frontend/Backend → Grouping (Auth Layer, Data Layer for 2+ services) → Individual services. All structural nodes use `type: 'layer'` with `layerColor`. Category routing: frontend-bound (hosting, cdn, auth, analytics, support), backend-bound (database, storage, payments, email, monitoring, messaging, cicd, infra). Dagre layout: top-to-bottom, ranksep 120, nodesep 80.

### 4.12 HTML Exporter (`exporters/htmlExporter.ts`)

Self-contained HTML report with inline CSS. Sections: Stack Score, services by category, costs with budget, dependencies by ecosystem, graph connections. XSS-escaped, print-friendly, mobile-responsive.

---

## 5. Data Model

### 5.1 Service

```typescript
interface ServiceBilling {
  type: 'manual' | 'automatic' | 'free'
  period?: 'monthly' | 'yearly' | 'one-time' | 'usage-based'
  amount?: number
  currency?: string
  nextDate?: string        // next renewal/payment (ISO string)
  autoRenew?: boolean
  paymentMethod?: string
  lastRenewed?: string     // last renewal date (ISO string)
}

interface Service {
  id: string
  name: string
  category: ServiceCategory
  plan: 'free' | 'paid' | 'trial' | 'unknown'
  source: 'inferred' | 'manual'
  confidence?: 'high' | 'medium' | 'low'
  needsReview?: boolean
  confidenceReasons?: string[]
  evidenceSummary?: EvidenceSummary[]
  inferredFrom?: string
  billing?: ServiceBilling
  accountEmail?: string
  owner?: string
  notes?: string
  url?: string
  aiContext?: ServiceContext
  lastActivityDate?: string
  daysSinceActivity?: number
  zombieStatus?: 'active' | 'stale' | 'zombie'
}
```

### 5.2 Service Categories (19)

| Category | Category | Category | Category |
|---|---|---|---|
| `domain` | `hosting` | `cicd` | `database` |
| `auth` | `payments` | `email` | `analytics` |
| `monitoring` | `cdn` | `storage` | `infra` |
| `ai` | `mobile` | `gaming` | `data` |
| `messaging` | `support` | `other` | |

### 5.3 Supporting Types

```typescript
interface Evidence {
  type: 'npm_package' | 'env_var' | 'url' | 'import' | 'config_file' | 'ci_secret' | 'domain'
  value: string
  file: string
  line?: number
}

interface Dependency {
  name: string
  version: string
  type: 'npm' | 'pip' | 'cargo' | 'go' | 'composer' | 'gem' | 'maven' | 'gradle' | 'pub'
  dev?: boolean
}

interface DiscardedItem {
  name: string
  reason: 'low_score' | 'ai_filter' | 'generic_term'
  score: number
  evidences: { type: string; value: string; file: string }[]
  category?: ServiceCategory
}
```

### 5.4 Graph Types

```typescript
interface FlowNode {
  id: string
  label: string
  type: 'user' | 'cdn' | 'frontend' | 'api' | 'database' | 'external' | 'layer'
  category?: ServiceCategory
  serviceId?: string
  layerColor?: string
}

interface FlowEdge {
  id: string
  source: string
  target: string
  flowType?: 'data' | 'auth' | 'payment' | 'webhook'
}
```

### 5.5 Vulnerability Types

```typescript
interface Vulnerability {
  id: string
  summary: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  aliases: string[]
  fixedVersion?: string
  url?: string
}

interface DepVulnResult {
  ecosystem: string
  name: string
  version: string
  vulnerabilities: Vulnerability[]
}
```

### 5.6 Analysis & History Types

```typescript
interface StackDiffResult {
  added: { name: string; category: string }[]
  removed: { name: string; category: string }[]
  changed: { name: string; field: string; previousValue: string; newValue: string }[]
  addedDeps: { name: string; version: string }[]
  removedDeps: { name: string; version: string }[]
  timestamp: string; previousTimestamp: string
}

interface ScoreHistoryEntry {
  timestamp: string; score: number
  passingChecks: number; totalChecks: number
  serviceCount: number; depCount: number; source?: 'scan' | 'manual'
}

interface ScanProgressData {
  phase: string; percent: number
  counts: { evidences: number; services: number; vulns: number }
}
```

### 5.7 AI Types

```typescript
interface AIProvider { name: string; baseUrl: string; model: string; apiKey?: string }
interface AISettings { enabled: boolean; provider: AIProvider }

interface ServiceContext {
  serviceId: string
  usage: string
  criticalityLevel: 'critical' | 'important' | 'optional'
  usageLocations: string[]
  warnings?: string[]
}

interface Alternative {
  name: string
  reason: string
  type: 'cheaper' | 'open-source' | 'self-hosted'
  estimatedSavings?: string
  url?: string
}

interface DeepAnalysisResult {
  serviceContexts: ServiceContext[]
  hiddenServices: Service[]
  inferredEdgeTypes: { serviceId: string; flowType: FlowEdge['flowType']; reason: string }[]
  alternativeSuggestions?: AlternativeSuggestion[]
}
```

### 5.8 Configuration

```typescript
interface UserConfig {
  version: string; source?: StackSource
  project?: { name?: string; description?: string }
  services: Service[]; accounts?: { service: string; email?: string; notes?: string }[]
  graph?: GraphConfig; budget?: { monthly: number; currency: string; alertThreshold?: number }
}
```

---

## 6. UI Specification

### 6.1 Design System

- **Theme**: dark/light toggle via CSS custom properties (`src/themes.ts`)
  - Dark: `#0a0c0f` primary, `#0d1017` secondary, `#e2b04a` accent
  - Light: `#f5f6f8` primary, `#ffffff` secondary, `#c4962e` accent
  - Semantic color variables: `--color-danger`, `--color-success`, `--color-warning`, `--color-badge-bg-*`, `--color-badge-border-*` with dark/light variants
  - WCAG AA contrast: `--color-text-secondary` and `--color-text-muted` meet 4.5:1 ratio in both themes
  - Persisted in `localStorage('stackwatch-theme')`
- **Typography**: IBM Plex Mono (primary), IBM Plex Sans (headings) — bundled locally
- **Border radius**: `rounded-none` (industrial aesthetic)
- **Hover**: Tailwind `hover:` classes only (no JS handlers)
- **External links**: all via IPC `open-external-url` (no `window.open()`)

### 6.2 Panels

| Panel | Component | Purpose |
|---|---|---|
| Dashboard | `Dashboard.tsx` | Quick start guide, features grid, keyboard shortcuts |
| Services | `ServicesPanel/` | Card grid, search, filters (category/plan/activity), add/edit form, confidence & zombie badges, evidence popover |
| Dependencies | `DepsPanel/` | Virtualized table, sort, group by ecosystem, vuln scanning |
| Discarded | `DiscardedPanel/` | Virtualized list, search, reason filter, restore to manual service |
| Flow | `FlowGraph/` | React Flow canvas, minimap, controls, legend, context menus, inline node edit, dagre layout |
| Costs | `CostsPanel/` | Monthly/yearly totals, category breakdown, bar chart, renewal alerts, budget mode |
| Settings | `Settings/` | AI provider config, theme toggle, share, about |

### 6.3 Shared Components

`TitleBar` (frameless window controls), `TopBar` (import/export/share, repo path, GitHub connect), `Sidebar` (panel nav, Stack Score, theme toggle), `ScoreHistoryPanel` (Recharts line chart modal), `DoctorModal` (health check), `ConfirmDialog` (promise-based, focus trap), `Toast` (auto-dismiss 4s, CSS keyframe animation), `ScanProgress` (CRT-effect progress bar, phase text, counters, cancel), `ErrorBoundary`, `OnboardingTutorial` (6-step walkthrough).

### 6.4 Confidence Display

| Level | Card Style | Flow Node Style |
|---|---|---|
| High | Normal card, green border | Solid border |
| Medium | Yellow "review" badge | Normal border |
| Low | Orange "incomplete" badge + warning | Dashed border, orange, "?" marker |

### 6.5 Accessibility

- ARIA roles: `menu`, `menuitem`, `alertdialog`, `switch`, `status`
- Focus trap in modals and tutorials; focus restore on close
- Keyboard navigation: Escape closes menus/dialogs, Enter/Space activates cards
- ContextMenu: ArrowDown/ArrowUp navigation between items, auto-focus first item on open
- `aria-label` on icon-only buttons and search inputs
- `aria-current="page"` on active sidebar item
- `aria-live="polite"` on toasts
- `htmlFor` labels on all form fields

---

## 7. State Management

### 7.1 Stores (Zustand 5)

| Store | Purpose | Key Details |
|---|---|---|
| `useStore` | Services, deps, config, AI, theme, mode | Merged services = inferred + manual. Registers service getter with graphStore via `registerServiceGetter()` callback. Reactive `stackScore` recalculated after every mutation. |
| `graphStore` | React Flow nodes/edges, excluded services | `persistToConfig` debounced 500ms with serialized write lock. Uses `registerServiceGetter()` to avoid circular dependency. Pushes to historyStore before mutations. |
| `historyStore` | Undo/redo | Past/future stacks, max 50 snapshots |
| `dialogStore` | Promise-based confirm dialogs | Returns button value string |
| `toastStore` | Notifications | Auto-dismiss after 4s |

### 7.2 Critical Invariant: Service-Node 1:1

Every service MUST have a corresponding graph node. Enforced by:
1. `flowInference.ts` creates a node per service
2. `useStore.ensureFlowNodes()` adds nodes for manual services missing from pipeline
3. Deleting a graph node removes the linked service

Layer nodes (type `'layer'`) are organizational and exempt from this invariant.

---

## 8. IPC API (Main-Renderer)

26 methods exposed via `contextBridge`:

```typescript
interface StackWatchAPI {
  // Analysis
  analyzeLocal(folderPath: string): Promise<AnalysisResult>
  analyzeGitHub(repo: string, token: string): Promise<AnalysisResult>
  getStackDiff(folderPath: string): Promise<StackDiffResult | null>
  scanVulnerabilities(deps: Dependency[]): Promise<DepVulnResult[]>
  checkRenewals(services: Service[]): Promise<void>

  // File operations
  openFolder(): Promise<string | null>
  openExternalUrl(url: string): Promise<boolean>
  exportConfig(content: string): Promise<boolean>
  exportServicesMd(content: string): Promise<boolean>
  exportHtml(data: HtmlExportData): Promise<boolean>

  // Configuration
  loadConfig(repoPath: string): Promise<UserConfig | null>
  saveConfig(repoPath: string, config: UserConfig): Promise<void>
  importConfig(): Promise<UserConfig | null>
  checkLinkStatus(config: UserConfig): Promise<LinkStatus>
  relinkLocal(): Promise<string | null>

  // Score history
  getScoreHistory(folderPath: string): Promise<ScoreHistoryEntry[]>
  saveScoreEntry(folderPath: string, entry: ScoreHistoryEntry): Promise<void>

  // AI
  getAISettings(): Promise<AISettings>
  setAISettings(settings: AISettings): Promise<void>
  testAIConnection(provider: AIProvider): Promise<{ ok: boolean; error?: string }>
  getAIPresets(): Promise<AIProvider[]>

  // Scan progress
  onScanProgress(callback: (data: ScanProgressData) => void): () => void
  cancelScan(): void

  // Window
  windowMinimize(): void
  windowMaximize(): void
  windowClose(): void
  windowIsMaximized(): Promise<boolean>
}
```

---

## 9. CLI Specification

### 9.1 Commands

| Command | Description |
|---|---|
| `stackwatch [path]` | Scan a directory (default: cwd) |
| `stackwatch init [path]` | Generate `stackwatch.config.json` from scan |
| `stackwatch badge [path]` | Generate 5 Markdown badges |
| `stackwatch doctor [path]` | Run health checks: config, services, costs, vulns, score |

### 9.2 Flags

| Flag | Description |
|---|---|
| `--json` | Output as JSON |
| `--md` | Output as Markdown |
| `--html` | Output self-contained HTML report |
| `--diff` | Compare with previous scan |
| `--sbom cyclonedx\|spdx` | Output SBOM (CycloneDX 1.5 or SPDX 2.3) |
| `--all` | Include low-confidence and needs-review services |
| `--fail-on-vulns` | Exit code 1 if critical/high vulnerabilities |
| `--fail-on-unreviewed` | Exit code 2 if unreviewed services exist |

---

## 10. GitHub Action

**Composite action** (no Docker — faster startup).

| Inputs | Default | Description |
|---|---|---|
| `path` | `.` | Path to scan |
| `comment` | `true` | Post results as PR comment |

| Outputs | Description |
|---|---|
| `services` | Number of services detected |
| `dependencies` | Number of dependencies found |
| `json` | Full analysis result as JSON |

---

## 11. Security Model

| Area | Implementation |
|---|---|
| Encryption | `safeStorage` delegates to OS keychain (macOS Keychain, Windows DPAPI, Linux libsecret/kwallet). Fallback to unencrypted storage with console warning if keychain unavailable. Auto-migration from legacy deterministic key on startup. |
| IPC validation | `zod` schemas in `electron/validation.ts` validate all IPC handler arguments before any logic. Rejects malformed inputs with structured error messages. |
| CSP | `Content-Security-Policy` via `session.webRequest.onHeadersReceived` (production only) |
| External URLs | IPC `open-external-url` → zod-validated (http/https only) → `shell.openExternal()` |
| Path validation | `validateRepoPath()` checks for `..` traversal via regex before resolving |
| Secrets | GitHub tokens and AI API keys encrypted with `safeStorage` in electron-store, never in config JSON |
| Config encryption | Sensitive fields (`accountEmail`, `owner`, `notes`) stored as `$encrypted:` references in JSON; real values encrypted with `safeStorage` in electron-store |
| Context isolation | `contextIsolation: true`, `nodeIntegration: false`, all IPC via contextBridge |
| Race conditions | `AsyncMutex` (`src/store/mutex.ts`) serializes multi-store mutations (addService, updateService, deleteService). Cross-store communication uses registered callbacks instead of dynamic `import()` to prevent re-initialization races. |
| Error handling | Global `unhandledRejection` and `uncaughtException` handlers in main process prevent crashes; errors logged and shown to user via dialog. |

---

## 12. Stack Score

Binary check system: Score = (passing checks / applicable checks) × 100.

Each check is `pass`, `fail`, or `unchecked`. Unchecked checks don't count toward the score.

### 12.1 Security Checks (5)

| Check | Applies When | Pass | Fail |
|---|---|---|---|
| `NO_CRITICAL_VULNS` | Vuln scan executed | 0 critical vulns | ≥1 critical |
| `NO_HIGH_VULNS` | Vuln scan executed | 0 high vulns | ≥1 high |
| `NO_ZOMBIE_SERVICES` | ≥1 service has zombieStatus | 0 zombies | ≥1 zombie |
| `NO_OVERDUE_RENEWALS` | ≥1 service with manual renewal tracking | None overdue | ≥1 overdue |
| `NO_UPCOMING_RENEWALS` | ≥1 service with manual renewal tracking | None within threshold | ≥1 within threshold |

**Renewal thresholds by billing type:**
- `automatic` + `monthly`: no tracking (excluded)
- `automatic` + `yearly`: 60 days
- `manual` + `monthly`: 7 days
- `manual` + `yearly`: 30 days
- `free`, `one-time`, `usage-based`: no tracking (excluded)

### 12.2 Completeness Checks (3)

| Check | Applies When | Pass | Fail |
|---|---|---|---|
| `ALL_PAID_HAVE_OWNER` | ≥1 paid/trial service | All have owner | ≥1 missing |
| `ALL_PAID_HAVE_BILLING` | ≥1 paid/trial service | All have billing.amount | ≥1 missing |
| `ALL_PAID_HAVE_RENEWAL` | ≥1 paid/trial with recurring period | All have nextDate | ≥1 missing |

Free and unknown-plan services are excluded from completeness checks.

Badge colors: green (>=80), yellow (>=50), red (<50).

---

## 13. Badge System

5 badge types via shields.io URLs:

| Badge | Color Logic |
|---|---|
| Stack Score | Green >=80, yellow >=50, red <50 |
| Services | Gold (`#e2b04a`) |
| Vulnerabilities | Green if 0, red if >0 |
| Dependencies | Blue (`#4a8ab0`) |
| Last Scanned | Gray (`#8090a6`) |

Available as SVG, shields.io URLs, Markdown, and HTML. CLI: `stackwatch badge`.

---

## 14. Build & Distribution

| Platform | Formats |
|---|---|
| macOS | DMG (universal), ZIP (universal) |
| Windows | NSIS installer (x64), Portable (x64) |
| Linux | AppImage (x64), DEB (x64) |

CI builds on push to main and PRs. 29-point validation script checks production builds.

**Release automation**: pushing a version tag (`v*`) triggers the CI release job — builds all platforms, creates GitHub Release with platform binaries attached. Convenience: `npm run release`.

---

## 15. Testing

412 tests across 29 suites (Vitest + @testing-library/react + jsdom).

| Suite | Count | Suite | Count |
|---|---|---|---|
| Heuristic | 32 | graphStore | 27 |
| vulnScanner | 27 | Extractor | 26 |
| Deep Analyzer | 24 | Deduplicator | 23 |
| useStore | 19 | IPC Validation | 18 |
| healthScore | 18 | Flow inference | 17 |
| badge | 17 | TopBar | 13 |
| htmlExporter | 13 | Deep Analyzer (runDeep) | 13 |
| zombieDetector | 12 | monorepo | 12 |
| historyStore | 12 | ServiceCard | 12 |
| billing | 10 | alternativeSuggester | 10 |
| ScanProgress | 9 | scoreHistory | 8 |
| scanDiff | 7 | ContextMenu | 7 |
| DiscardedPanel | 7 | Pipeline | 7 |
| AsyncMutex | 5 | Pipeline Integration | 4 |
| daysUntil | 3 | | |

---

## 16. Version History

### v0.9.0 (current)
- **Security**: `safeStorage` encryption replacing deterministic key derivation (delegates to OS keychain: DPAPI, Keychain, libsecret)
- **Security**: `zod` schemas validate all IPC handler arguments before processing (`electron/validation.ts`)
- **Security**: Race condition fixes — `AsyncMutex` for multi-store operations, registered callbacks replace dynamic `import()` in cross-store communication
- **Security**: `electron-builder` upgraded to v26 (0 HIGH/CRITICAL CVEs in `npm audit`)
- **Stability**: Global `unhandledRejection` and `uncaughtException` handlers prevent main process crashes
- **Stability**: AI API keys encrypted with `safeStorage` (not just electron-store encryption)
- 412 tests across 29 suites (+23 new validation and mutex tests)

### v0.8.0
- ServiceBilling data model replacing legacy cost/renewalDate fields (type, period, amount, currency, nextDate, lastRenewed)
- 8 binary Stack Score checks (5 security + 3 completeness): score = passing/applicable × 100
- Renewal tracking with per-billing-type thresholds (automatic monthly excluded, manual yearly 30d, etc.)
- billing.ts utilities: calculateNextDate, renewService, getRenewalThreshold, getMonthlyAmount
- ScoreBreakdown in Sidebar showing N/M checks passing
- CostsPanel split into auto-renewing vs manual renewal sections
- ServiceForm with billing type/period/amount/nextDate/lastRenewed fields
- 389 tests across 27 suites (+17 new billing and healthScore tests)

### v0.7.0
- Semantic color CSS variables (`--color-danger`, `--color-success`, `--color-warning`, `--color-badge-bg/border-*`) with dark/light variants, replacing ~40 hardcoded hex colors across 15 components
- WCAG AA contrast compliance: `--color-text-secondary` and `--color-text-muted` adjusted to 4.5:1 ratio in both themes
- `TypedStore<StoreSchema>` interface for electron-store (replaces `any` typing)
- Serialized write lock in `graphStore.persistToConfig` preventing race conditions from overlapping debounced writes
- `registerServiceGetter()` callback pattern replacing `require()` circular dependency between graphStore and useStore
- ContextMenu keyboard navigation (ArrowDown/ArrowUp between items, auto-focus first item)
- Unified panel headers, search icon consistency, Tailwind-only hover handlers

### v0.6.0
- Scan progress screen with real-time pipeline updates (CRT animation, phase text, counters) and AbortController cancellation
- Reactive Stack Score recalculation after every service/graph mutation with debounced history persistence
- Blank Stack mode: empty canvas with USER layer node, manual architecture building without a repo

### v0.5.0
- Sensitive field encryption (`$encrypted:` references in config JSON, real values in electron-store)
- Evidence info popover on ServiceCard (score breakdown per evidence type)
- Graph diff visual highlighting (new nodes green, removed nodes grey with fade-out)
- Release automation: CI creates GitHub Release with platform binaries on version tag push

### v0.4.0
- Layer node type for organizational graph nodes (User, Frontend, Backend, grouping)
- Discarded panel: virtualized list of items filtered during analysis with restore capability
- Scan mode dialog: Merge vs Fresh Scan for repos with saved data
- AI false-positive filter (Step 0): reviews ALL services including high-confidence

### v0.3.0
- Static HTML export (self-contained report, CLI `--html`, print-friendly)
- AI stack alternatives (cheaper/open-source suggestions per service)
- Zombie UI badges and activity filter in ServicesPanel
- Doctor modal and CLI subcommand (health checklist with live vuln scan)
- Light/dark theme toggle with CSS variable system

### v0.2.0
- Zombie service detection via git log (active/stale/zombie classification)
- Stack Score history with trend tracking and Recharts line chart modal
- Budget mode in CostsPanel (monthly budget, progress bar, threshold alerts)
- Cost visualization with Recharts horizontal bar chart

### v0.1.0
- Semantic heuristic detection engine with evidence scoring (no hardcoded service lists)
- AI deep analysis: false-positive filter, service context, hidden detection, smart edge types
- CLI with scan, init, badge, `--diff`, `--sbom`, `--fail-on-vulns`, `--fail-on-unreviewed`
- GitHub Action with PR comment posting
- Vulnerability scanning via OSV.dev (8 ecosystems)
- SBOM generation (CycloneDX 1.5, SPDX 2.3)
- Monorepo support (npm, pnpm, lerna, turbo, nx)
- Cross-platform builds (macOS, Windows, Linux)
