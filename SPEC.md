# SPEC.md — StackWatch

> Technical specification document. Source of truth for AI agents and developers.
> Last updated: 2026-03-17 | Status: v0.4.0

---

## 1. Product vision

**StackWatch** is a desktop application (Electron) + CLI + GitHub Action that lets developers visualize, document and monitor all services, dependencies and external accounts that make up any software project — by automatically inferring them from the repository and allowing manual enrichment.

### Problem it solves
Modern projects depend on dozens of external services (hosting, domain, CI/CD, analytics, payments, APIs...) spread across multiple accounts and providers. There is no unified view of the entire ecosystem — what it costs, when things renew, or how it connects.

### Value proposition
- **Smart automatic inference**: detects services via semantic heuristics — no hardcoded service lists
- **Optional AI**: enhances detection with any OpenAI-compatible provider, including free local models (Ollama, LM Studio)
- **Deep AI analysis**: analyzes service usage context, detects hidden services consumed via wrappers, and infers graph edge types
- **Manual enrichment**: user adds what cannot be inferred (credentials, billing accounts, renewal dates, services with no code footprint)
- **Unified view**: dashboard with six panels — services (with confidence levels), dependencies (with vulnerability scanning), discarded items (restore-able), flow graph, costs (with charts), and settings
- **Triple delivery**: desktop app + CLI tool + GitHub Action
- **Portable and offline**: all information lives in the repo itself as versionable JSON
- **Stack Diff**: track how your stack changes between scans
- **SBOM compliance**: generate CycloneDX 1.5 and SPDX 2.3 from dependencies
- **CI gates**: fail pipelines on vulnerabilities or unreviewed services

---

## 2. Tech stack

| Layer | Technology | Rationale |
|---|---|---|
| App shell | Electron 35 | Local fs access + cross-platform packaging |
| UI / renderer | React 19 + Vite 6 | Mature ecosystem, fast HMR |
| Language | TypeScript 5.7 (strict) | Type safety across main/renderer/CLI |
| Styles | Tailwind CSS 4 | Utility-first, no custom CSS files |
| State | Zustand 5 | Lightweight, selector-based, multiple stores |
| Interactive graph | React Flow 11 | Draggable nodes, easy React integration |
| Graph layout | dagre | Hierarchical DAG layout |
| Cost charts | Recharts 3 | React-native charting, dark theme support |
| Dep virtualization | @tanstack/react-virtual | Handles 500+ dependency rows |
| Remote GitHub | Octokit (`@octokit/rest`) | Official client, well documented |
| Local persistence | `electron-store` | Encrypted JSON via deterministic machine key |
| IPC | `contextBridge` + `ipcMain/ipcRenderer` | Secure main ↔ renderer separation |
| .gitignore | `ignore` (npm) | Respect repo exclusions during scan |
| Testing | Vitest + @testing-library/react + jsdom | Fast, React-compatible |
| Build | electron-builder | macOS/Windows/Linux distributables |
| CLI build | tsc (separate tsconfig) | Standalone Node.js binary |
| CI/CD | GitHub Actions | Test → build → validate → artifacts |

---

## 3. Detection architecture

### Analysis pipeline

```
repo (local or GitHub)
    ↓
Evidence extractor  →  Evidence[]  (deterministic, fast)
    ↓
Heuristic classifier  →  HeuristicResult[]  (semantic scoring, no fixed lists)
    ↓
Deduplicator  →  DetectedService[]  (grouped, no duplicates)
    ↓ (if AI configured)
AI filter  →  semantic false-positive removal (keeps only real external services)
    ↓
AI refine  →  validated services (categories fixed, duplicates merged)
    ↓
AI deep analysis  →  usage context + hidden services + smart edge types
    ↓
Zombie detector  →  git log activity per service (stale/zombie/active)
    ↓
Flow inference  →  FlowNode[] + FlowEdge[]  (dagre layout)
    ↓
Merge with stackwatch.config.json  →  user's manual services
    ↓
Dashboard / CLI output / PR comment
```

Additional post-scan steps:
- **Stack Diff**: compare with `.stackwatch/last-scan.json` if `--diff` flag
- **Vulnerability scan**: batch query OSV.dev API (on-demand via UI or `--fail-on-vulns`)
- **SBOM generation**: CycloneDX or SPDX output via `--sbom` flag
- **Snapshot save**: automatically save scan result for future diffs
- **Renewal notifications**: OS desktop alerts for services expiring within 30 days
- **Zombie detection**: cross-reference services with `git log` to find abandoned services (6+ months inactive)
- **Score history**: append health score to `.stackwatch/score-history.json` after each scan (max 100 entries)

### 3.1 Evidence extractor (`extractor.ts`)

Walks the repo recursively (max 15 levels, respects .gitignore) and extracts raw signals:

| Type | Source | How |
|---|---|---|
| `npm_package` | `package.json` (all levels) | Reads dependencies + devDependencies |
| `env_var` | All `.env*` files | Parses key=value, detects credentials |
| `url` | Code files (.ts, .tsx, .js, .jsx, .py, .go, .rs, .rb, .java, .kt, .swift, .dart, .cs, .php) | Regex in API call patterns + constant assignments |
| `import` | Same code files | Regex `from '...'` and `require('...')` |
| `config_file` | Repo root | Presence of vercel.json, firebase.json, fly.toml, etc. |
| `ci_secret` | `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml` | Regex `secrets.NAME` |
| `domain` | All code | Extract domain from URLs |

**Dependency ecosystems** (9): npm, pip (requirements.txt, pyproject.toml, setup.py), cargo, go, composer, gem, maven, gradle, pub (dart)

**Exclusions:** node_modules, dist, .next, build, .git, coverage, vendor + respects .gitignore

### 3.2 Heuristic classifier (`heuristic.ts`)

Classifies evidence using semantic scoring — no hardcoded service allowlists:

**Evidence scoring (base score by type):**

| Evidence type | Base score | Example |
|---|---|---|
| `config_file` | 10 | vercel.json, docker-service:postgres |
| `ci_secret` | 8 | secrets.STRIPE_KEY in CI workflow |
| `env_var` with credential suffix (_KEY, _SECRET, _TOKEN, _API_KEY) | 7 | STRIPE_SECRET_KEY |
| `env_var` with endpoint suffix (_URL, _ENDPOINT, _HOST, _DSN) | 6 | REDIS_URL |
| `url` (external domain) | 5 | https://api.stripe.com/v1 |
| `env_var` (generic) | 2 | GA_MEASUREMENT_ID |
| `import` / `npm_package` | 1 | stripe, @sentry/node |

**Score penalties (applied per evidence):**

| Condition | Penalty | Example |
|---|---|---|
| Config suffix (_ENABLED, _DISABLED, _INTERVAL, _SECONDS, _MINUTES, _POLICY, _ROLLOUT, _LIMIT, _COUNT, _PRICE, _SEATS) | -5 | FEATURE_ENABLED (score 2-5 = -3, discarded) |
| Name is descriptive phrase (>2 words) | -3 | "Vercel Use Botid In Booker" |
| Name contains project name | -10 | MYAPP_SECRET_KEY when project is "myapp" |

**Hard filters (not evidence at all):**
- System/framework variables (NODE_ENV, PORT, HOST, etc.)
- CI/script variable patterns (EXIT_CODE, HEAD_REF, DEVIN_*, COPILOT_*)
- Feature flag patterns (IS_*, DISABLE_*, ENABLE_*, BOOKER_*, *_POLYFILL, *_OBSERVER, *_LOGIN_ENABLED)
- Node.js built-in modules
- Generic names (admin, api, config, etc.)

**Classification details:**
- **Environment variables:** Extracts service name by removing common prefixes (NEXT_PUBLIC_, VITE_, REACT_APP_, etc.) and suffixes
- **External URLs:** Extracts domain, strips common subdomains (api., app., cdn.)
- **npm packages:** Any package passes with score 1 (no allowlist). Deduplicator discards npm-only services via threshold
- **Config files:** Direct file-to-service mapping (vercel.json → Vercel, firebase.json → Firebase, etc.)
- **Category inference:** Semantic regex against normalized name for 19 categories. SAML → auth, Outlook → auth
- **Project name exclusion:** Score penalty -10 for services matching the project name

### 3.3 Deduplicator (`deduplicator.ts`)

Groups related detections of the same service and applies score-based confidence:
- Name-based grouping (case-insensitive, prefix matching)
- **Best-score-per-type:** Tracks the highest score per unique evidence type (import and npm_package count as one type). 50 imports of framer-motion = score 1, not 50.
- **Final score** = sum of best scores across unique evidence types. Example: Sentry with env_var(6) + ci_secret(8) + import(1) = 15
- **Score thresholds:** `< 6` → discard, `6-10` → low confidence + needsReview (grey zone, AI validates), `> 10` → high confidence (no AI needed)
- Preferred category from strongest evidence
- **Brand collapse:** "BrandName + descriptor" entries collapse into "BrandName" (e.g., "Cloudflare Sitekey" + "Cloudflare Turnstile" → "Cloudflare"). Handles variant spellings (Dockerhub → Docker Hub).
- **Generic entry removal:** Removes generic entries (Database, Email From, Email Server, etc.) when a specific service exists in the same category

### 3.4 Monorepo support (`monorepo.ts`)

Detects 5 monorepo types:
- npm workspaces (array and object formats)
- pnpm-workspace.yaml
- lerna.json
- turbo.json (Turborepo)
- nx.json (Nx)

Resolves simple glob patterns (e.g., `packages/*`). Scans each workspace package separately and merges results.

### 3.5 AI analysis (`ai/deepAnalyzer.ts`)

Only runs if the user configures an AI provider. Five capabilities:

0. **False-positive filter** (`filterFalsePositivesWithAI`): Reviews ALL services including high-confidence — catches generic names (OAuth2, Connect, Embed, Docs) that pass scoring with strong evidence but aren't real products. Skips if >100 services. Reports `aiFilteredCount` in `AnalysisResult`.
0b. **Service refinement** (`refineServicesWithAI`): Only processes medium/low confidence services. High confidence services are not sent to AI. Fixes categories, adjusts confidence, removes false positives, merges duplicates.
1. **Service context**: For each detected service, reads relevant code files and determines usage description, criticality level (critical/important/optional), and warnings (hardcoded secrets, missing error handling).
2. **Hidden service detection**: Reads priority files (lib/, services/, api/) and finds services consumed via wrappers or custom SDKs that heuristic analysis missed.
3. **Smart graph edges**: Determines correct edge type (data/auth/payment/webhook) based on actual service usage context.
4. **Stack alternatives** (`alternativeSuggester.ts`): For paid/trial/high-confidence services, suggests 1-2 cheaper or open-source alternatives with reason, type (cheaper/open-source/self-hosted), and estimated savings. Single AI call, silent fallback.

**Provider presets (3):**
- **Local** (Ollama / LM Studio) — localhost, no API key needed
- **Cloud (Groq)** — free tier, fast inference
- **Custom** — any OpenAI-compatible endpoint (OpenAI, Mistral, Anthropic, etc.)

If AI fails at any point, silent fallback to heuristic results. Checkpoint/restore ensures no data loss.

**Token control:** max 5 files/service, 500 lines/file, 10 files for hidden detection, batches of 3 concurrent calls, 60s timeout.

### 3.6 Vulnerability scanner (`vulnScanner.ts`)

Batch queries the OSV.dev API for known vulnerabilities:
- Maps 8 ecosystems: npm, PyPI, crates.io, Go, Packagist, RubyGems, Maven, Pub
- Batches of 100 dependencies per request
- Severity mapping from CVSS scores (critical/high/medium/low/unknown)
- Max 5 vulnerabilities per dependency
- Graceful failure on network errors

### 3.7 Stack Diff (`stackDiff.ts`)

Compares two scan snapshots:
- Saves snapshots to `.stackwatch/last-scan.json` in the scanned repo
- Computes added/removed/changed services
- Computes added/removed dependencies
- Available via CLI (`--diff`) and IPC (`get-stack-diff`)

### 3.8 SBOM generator (`sbom.ts`)

Generates Software Bill of Materials from detected dependencies:
- **CycloneDX 1.5** (JSON): standard SBOM format with PURLs
- **SPDX 2.3** (JSON): alternative standard with deterministic namespace
- Maps all 8 ecosystems to PURL types
- No external dependencies — pure JSON generation
- Available via CLI (`--sbom cyclonedx|spdx`) and IPC (`generate-sbom`)

### 3.9 Zombie detector (`zombieDetector.ts`)

Detects potentially abandoned services by cross-referencing with git history:
- For each inferred service, collects its evidence files (`inferredFrom` + matching evidences)
- Runs `git log -1 --format=%aI` per file to get last commit date (cached to avoid duplicate calls)
- Takes the most recent date across all evidence files as `lastActivityDate`
- Classifies: **active** (<90 days), **stale** (90-179 days), **zombie** (180+ days)
- Only runs for local repos (not GitHub — requires git log access)
- Silent fallback if git is unavailable or repo is not a git repo
- Enriches `Service` objects with `lastActivityDate`, `daysSinceActivity`, `zombieStatus`

### 3.10 Score history (`scoreHistory.ts`)

Persists health scores to `.stackwatch/score-history.json` after each scan:
- Stores `{ timestamp, score, breakdown, serviceCount, depCount }` entries
- Maximum 100 entries (oldest trimmed)
- Used by CLI to show score trends (up/down/unchanged from last scan)
- Available via IPC `get-score-history` for future UI charting
- Same `.stackwatch/` directory as Stack Diff snapshots

### 3.11 Flow inference (`flowInference.ts`)

Generates a 4-layer hierarchical architecture graph from detected services:
- **Layer 1**: user node (always present as entry point, type: 'layer', layerColor: '#e2b04a')
- **Layer 2**: frontend layer node (only if hosting/cdn services detected, layerColor: '#4a8ab0') and backend layer node (if backend-category services exist, layerColor: '#6b4ab0'). Both have no serviceId, use type: 'layer'. A frontend→backend edge is added when both exist.
- **Layer 3**: intermediate grouping layer nodes (e.g. Auth Layer, Data Layer, type: 'layer') — created only for category groups with 2+ services
- **Layer 4**: individual service nodes (type: 'database'/'cdn'/'external')
- Category routing: frontend-bound (hosting, cdn, auth, analytics, support), backend-bound (database, storage, payments, email, monitoring, messaging, cicd, infra), 'other' (with url → backend, without → frontend)
- Creates typed edges: data, auth, payment, webhook
- Dagre hierarchical layout (top-to-bottom, ranksep 120, nodesep 80). Layer nodes use 200x56 dimensions, service nodes 180x60.
- Layer nodes are organizational — no serviceId, no confidence badges, can be created/edited/deleted by user via context menu.

### 3.12 HTML exporter (`exporters/htmlExporter.ts`)

Generates a self-contained HTML report from analysis results:
- Complete dark-themed HTML document with inline CSS (no external dependencies)
- Sections: Stack Score (big number + 4 progress bars), services grouped by category (collapsible `<details>`), cost summary with optional budget progress, dependencies grouped by ecosystem, service graph connections table
- XSS prevention: all user data HTML-escaped via `esc()` helper
- Print-friendly: `@media print` rules with white background
- Mobile-responsive layout
- Available via CLI (`--html > report.html`) and IPC (`export-html` with save dialog)

### 3.13 Manual configuration (`stackwatch.config.json`)

The user can add services manually from the UI with an expanded form: name, category, plan, cost, renewal date, account email, owner, notes, URL. Persisted with `source: "manual"`.

The `stackwatch init` CLI command generates this file from scan results.

---

## 4. Data model

### Service

```typescript
interface Service {
  id: string
  name: string
  category: ServiceCategory  // 19 categories
  plan: 'free' | 'paid' | 'trial' | 'unknown'
  source: 'inferred' | 'manual'
  confidence?: 'high' | 'medium' | 'low'
  needsReview?: boolean
  confidenceReasons?: string[]
  evidenceSummary?: EvidenceSummary[]  // best evidence per type with scores
  inferredFrom?: string
  cost?: { amount: number; currency: string; period: 'monthly' | 'yearly' }
  renewalDate?: string
  accountEmail?: string
  owner?: string
  notes?: string
  url?: string
  aiContext?: ServiceContext
  lastActivityDate?: string          // ISO date from git log
  daysSinceActivity?: number         // days since last commit touching evidence files
  zombieStatus?: 'active' | 'stale' | 'zombie'  // active <90d, stale 90-179d, zombie 180d+
}
```

### 19 service categories

`domain`, `hosting`, `cicd`, `database`, `auth`, `payments`, `email`, `analytics`, `monitoring`, `cdn`, `storage`, `infra`, `ai`, `mobile`, `gaming`, `data`, `messaging`, `support`, `other`

### DiscardedItem

```typescript
interface DiscardedItem {
  name: string
  reason: 'low_score' | 'ai_filter' | 'generic_term'
  score: number
  evidences: { type: string; value: string; file: string }[]
  category?: ServiceCategory
}
```

### Evidence (internal)

```typescript
interface Evidence {
  type: 'npm_package' | 'env_var' | 'url' | 'import' | 'config_file' | 'ci_secret' | 'domain'
  value: string
  file: string
  line?: number
}
```

### Dependency

```typescript
interface Dependency {
  name: string
  version: string
  type: 'npm' | 'pip' | 'cargo' | 'go' | 'composer' | 'gem' | 'maven' | 'gradle' | 'pub'
  dev?: boolean
}
```

### FlowNode / FlowEdge

```typescript
interface FlowNode {
  id: string
  label: string
  type: 'user' | 'frontend' | 'api' | 'database' | 'external' | 'layer'
  category?: ServiceCategory
  serviceId?: string
  layerColor?: string  // border color for layer nodes
}

interface FlowEdge {
  id: string
  source: string
  target: string
  flowType?: 'data' | 'auth' | 'payment' | 'webhook'
}
```

### Vulnerability / DepVulnResult

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

### StackDiffResult

```typescript
interface StackDiffResult {
  added: { name: string; category: string }[]
  removed: { name: string; category: string }[]
  changed: { name: string; field: string; previousValue: string; newValue: string }[]
  addedDeps: { name: string; version: string }[]
  removedDeps: { name: string; version: string }[]
  timestamp: string
  previousTimestamp: string
}
```

### ScoreHistoryEntry

```typescript
interface ScoreHistoryEntry {
  timestamp: string           // ISO date
  score: number               // 0-100
  breakdown: {
    servicesWithCost: number
    servicesWithOwner: number
    servicesReviewed: number
    graphCompleteness: number
  }
  serviceCount: number
  depCount: number
}
```

### AIProvider / AISettings

```typescript
interface AIProvider {
  name: string
  baseUrl: string
  model: string
  apiKey?: string
}

interface AISettings {
  enabled: boolean
  provider: AIProvider
}
```

### ServiceContext / DeepAnalysisResult

```typescript
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

interface AlternativeSuggestion {
  serviceId: string
  serviceName: string
  alternatives: Alternative[]
}

interface DeepAnalysisResult {
  serviceContexts: ServiceContext[]
  hiddenServices: Service[]
  inferredEdgeTypes: { serviceId: string; flowType: FlowEdge['flowType']; reason: string }[]
  alternativeSuggestions?: AlternativeSuggestion[]
}
```

### UserConfig

```typescript
interface UserConfig {
  version: string
  source?: StackSource
  project?: { name?: string; description?: string }
  services: Service[]
  accounts?: { service: string; email?: string; notes?: string }[]
  graph?: GraphConfig
  budget?: { monthly: number; currency: string; alertThreshold?: number }  // default threshold: 80%
}
```

---

## 5. UI specification

### 5.1 Design system

- **Theme**: dark/light toggle via CSS custom properties (`src/themes.ts`). Dark: `#0a0c0f` primary, `#0d1017` secondary, `#e2b04a` accent. Light: `#f5f6f8` primary, `#ffffff` secondary, `#c4962e` accent. Persisted in `localStorage('stackwatch-theme')`. Applied via `useTheme` hook on `document.documentElement`.
- **Typography**: IBM Plex Mono (primary), IBM Plex Sans (headings) — bundled locally
- **Minimum font size**: 10px
- **Border radius**: `rounded-none` (industrial aesthetic)
- **Hover**: Tailwind `hover:` classes only (no JS handlers)
- **External links**: all via IPC `open-external-url` (no `window.open()`, no `<a target="_blank">`)

### 5.2 Panels

| Panel | Component | Features |
|---|---|---|
| **Dashboard** | `Dashboard.tsx` | Quick start guide, features grid, keyboard shortcuts, demo mode CTA |
| **Services** | `ServicesPanel/` | Card grid (responsive), search, filters (19 categories, 4 plans, activity status), add/edit form, "Needs Review" section, confidence badges, zombie badges |
| **Dependencies** | `DepsPanel/` | Virtualized table, sort by name/type, group by ecosystem, vulnerability scanning button |
| **Discarded** | `DiscardedPanel/` | Virtualized list of items discarded during analysis, search, reason filter (low_score/ai_filter/generic_term), collapsible evidences, restore to manual service |
| **Flow** | `FlowGraph/` | React Flow canvas, minimap, controls, legend, context menus (node/edge/pane), inline node edit panel, dagre layout |
| **Costs** | `CostsPanel/` | Monthly/yearly totals, breakdown by category, horizontal bar chart (Recharts), renewal alerts with days countdown, budget mode with progress bar |
| **Settings** | `Settings/` | AI provider selector (3 presets), API key field, model/URL config, test connection, scan mode toggle, theme toggle (dark/light), share section, about section |

### 5.3 Shared components

| Component | Purpose |
|---|---|
| `TitleBar` | Custom frameless titlebar with window controls (min/max/close) |
| `TopBar` | Import/export/share, repo path, link status, GitHub connect, re-analyze |
| `Sidebar` | Panel navigation (6 items), Stack Score display (clickable → history), theme toggle, version, collapsible |
| `ScoreHistoryPanel` | Modal with Recharts line chart showing score history, trend stats, min/max/average |
| `DoctorModal` | Health check modal: config, services, costs, vulns, score breakdown with pass/fail/warn icons |
| `ConfirmDialog` | Promise-based modal with focus trap, ARIA roles |
| `Toast` | Auto-dismiss notifications (success/error/info), 4s timeout |
| `Skeleton` | Skeleton loaders for all panels during analysis |
| `ErrorBoundary` | React error boundary with fallback UI |
| `OnboardingTutorial` | 6-step walkthrough after first scan |
| `GitHubModal` | GitHub repo connection with real-time format validation |

### 5.4 Accessibility

- ARIA roles: `menu`, `menuitem`, `alertdialog`, `switch`, `status`
- Focus trap in modals and tutorials
- Focus restore on dialog close
- Keyboard navigation: Escape closes menus/dialogs, Enter/Space activates cards
- `aria-label` on icon-only buttons
- `aria-current="page"` on active sidebar item
- `aria-live="polite"` on toasts
- `htmlFor` labels on all form fields

### 5.5 Confidence levels in UI

| Level | Card style | Flow node style |
|---|---|---|
| **High** | Normal card, green border | Solid border |
| **Medium** | Yellow "review" badge | Normal border |
| **Low** | Orange "incomplete" badge + warning icon | Dashed border + orange color + "?" marker |

Services with `needsReview: true` appear in a dedicated section at top of Services panel.

---

## 6. State management

### Stores (Zustand 5)

| Store | Purpose | Key details |
|---|---|---|
| `useStore` | Global state: services, deps, config, AI settings, analysis state | Merged services = inferred + manual + confidence overrides |
| `graphStore` | React Flow nodes/edges, excluded services | `persistToConfig` debounced 500ms. Pushes to historyStore before mutations. |
| `historyStore` | Undo/redo | Past/future stacks, max 50 snapshots. Captures nodes + edges + services. |
| `dialogStore` | Promise-based confirm dialogs | Returns button value string |
| `toastStore` | Notifications | Auto-dismiss after 4s |

### Critical invariant: Service ↔ Graph Node 1:1

Every service MUST have a corresponding graph node. Enforced by:
1. `flowInference.ts` creates a node per service
2. `useStore.ensureFlowNodes()` adds nodes for manual services missing from pipeline
3. Deleting a graph node also removes the linked service

---

## 7. IPC communication (main ↔ renderer)

24 methods exposed via `contextBridge`:

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

  // AI
  getAISettings(): Promise<AISettings>
  setAISettings(settings: AISettings): Promise<void>
  testAIConnection(provider: AIProvider): Promise<{ ok: boolean; error?: string }>
  getAIPresets(): Promise<AIProvider[]>

  // Window
  windowMinimize(): void
  windowMaximize(): void
  windowClose(): void
  windowIsMaximized(): Promise<boolean>
}
```

---

## 8. CLI specification

### Commands

| Command | Description |
|---|---|
| `stackwatch [path]` | Scan a directory (default: cwd) |
| `stackwatch init [path]` | Generate `stackwatch.config.json` from scan |
| `stackwatch badge [path]` | Generate 5 copy-pasteable Markdown badges |
| `stackwatch doctor [path]` | Run health checks: config, services, costs, vulns, score |

### Flags

| Flag | Description |
|---|---|
| `--json` | Output scan results as JSON |
| `--md` | Output scan results as Markdown |
| `--diff` | Compare with previous scan (loads `.stackwatch/last-scan.json`) |
| `--sbom cyclonedx` | Output CycloneDX 1.5 SBOM as JSON |
| `--sbom spdx` | Output SPDX 2.3 SBOM as JSON |
| `--html` | Output self-contained HTML report (pipe to file) |
| `--all` | Show all services including low-confidence and needs-review |
| `--fail-on-vulns` | Exit code 1 if critical/high vulnerabilities found |
| `--fail-on-unreviewed` | Exit code 2 if unreviewed services exist |
| `--help` | Show help text |
| `--version` | Show version |

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Critical/high vulnerabilities found (with `--fail-on-vulns`) |
| 2 | Unreviewed services found (with `--fail-on-unreviewed`) |

---

## 9. GitHub Action specification

### Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | Path to scan |
| `comment` | `true` | Post results as PR comment |

### Outputs

| Output | Description |
|---|---|
| `services` | Number of services detected |
| `dependencies` | Number of dependencies found |
| `json` | Full analysis result as JSON |

### Behavior
- Composite action (no Docker — faster startup)
- Installs dependencies, builds CLI, runs scan
- Posts/updates PR comment with scan results (avoids duplicates)

---

## 10. Security model

| Area | Implementation |
|---|---|
| **Encryption** | Deterministic key from `app.getPath('userData')` for electron-store. Auto-recovery on corrupted store. |
| **CSP** | Production-only Content-Security-Policy via `session.webRequest.onHeadersReceived` |
| **External URLs** | All via IPC `open-external-url` → `shell.openExternal()` with protocol validation (http/https only) |
| **Path validation** | `validateRepoPath()` checks raw input for `..` traversal via regex before resolving |
| **Secrets** | GitHub tokens and AI API keys in encrypted electron-store, never in config JSON |
| **Context isolation** | `contextIsolation: true`, `nodeIntegration: false`, all IPC via contextBridge |

---

## 11. Build & distribution

| Platform | Formats |
|---|---|
| macOS | DMG (universal), ZIP (universal) |
| Windows | NSIS installer (x64), Portable (x64) |
| Linux | AppImage (x64), DEB (x64) |

CI builds on push to main and PRs. 29-point validation script checks production builds.

---

## 12. Stack Score

Composite health metric (0-100):

| Component | Weight | What it measures |
|---|---|---|
| Costs documented | 30% | Services with cost.amount > 0 |
| Owner assigned | 25% | Services with owner field |
| Services reviewed | 25% | Services with needsReview !== true |
| Graph completeness | 20% | Non-user nodes with at least one connection |

Badge colors: green (≥80), yellow (≥50), red (<50).

---

## 13. Badge system

5 badge types generated via shields.io URLs:

| Badge | Color logic |
|---|---|
| Stack Score | Green ≥80, yellow ≥50, red <50 |
| Services | Gold (#e2b04a) |
| Vulnerabilities | Green if 0, red if >0 |
| Dependencies | Blue (#4a8ab0) |
| Last Scanned | Gray (#8090a6) |

Available as SVG (inline), shields.io URLs, Markdown, and HTML formats. CLI command `stackwatch badge` outputs all 5 as copy-pasteable Markdown.

---

## 14. Testing

355 tests across 24 suites. Vitest + @testing-library/react + jsdom.

| Suite | Count | Location |
|---|---|---|
| graphStore | 27 | `src/store/__tests__/` |
| vulnScanner | 27 | `electron/analyzers/__tests__/` |
| Extractor | 26 | `electron/analyzers/__tests__/` |
| Deep Analyzer | 24 | `electron/ai/__tests__/` |
| badge | 17 | `src/utils/__tests__/` |
| htmlExporter | 13 | `electron/exporters/__tests__/` |
| Deep Analyzer (runDeep) | 13 | `electron/ai/__tests__/` |
| Heuristic | 32 | `electron/analyzers/__tests__/` |
| TopBar | 13 | `src/components/TopBar/__tests__/` |
| zombieDetector | 12 | `electron/analyzers/__tests__/` |
| monorepo | 12 | `electron/analyzers/__tests__/` |
| historyStore | 12 | `src/store/__tests__/` |
| healthScore | 11 | `src/utils/__tests__/` |
| alternativeSuggester | 10 | `electron/ai/__tests__/` |
| ServiceCard | 12 | `src/components/ServicesPanel/__tests__/` |
| scanDiff | 7 | `src/utils/__tests__/` |
| useStore | 15 | `src/store/__tests__/` |
| Flow inference | 9 | `electron/analyzers/__tests__/` |
| scoreHistory | 8 | `electron/analyzers/__tests__/` |
| ContextMenu | 7 | `src/components/FlowGraph/__tests__/` |
| DiscardedPanel | 7 | `src/components/DiscardedPanel/__tests__/` |
| Deduplicator | 23 | `electron/analyzers/__tests__/` |
| Pipeline | 7 | `electron/analyzers/__tests__/` |
| daysUntil | 3 | `src/utils/__tests__/` |

---

## 15. Acceptance criteria (v0.4)

- [x] Without any configuration, StackWatch detects services semantically — zero hardcoded lists
- [x] Variables like TWITTER_API_KEY or GA_MEASUREMENT_ID generate entries with high/medium confidence
- [x] User can add services manually from the UI — persisted in stackwatch.config.json
- [x] AI configuration accepts any OpenAI-compatible provider including local models without API key
- [x] If AI fails, the app shows heuristic results without errors
- [x] Flow graph shows confidence indicators (dashed borders for low confidence)
- [x] Interactive flow graph with context menus, node editing, and custom connections
- [x] Deep AI analysis provides service context, hidden detection, and smart edge types
- [x] 284 tests passing across 22 suites
- [x] CLI with scan, init, badge, doctor, --diff, --sbom, --html, --fail-on-vulns, --fail-on-unreviewed
- [x] GitHub Action posts PR comments with scan results
- [x] Monorepo support (npm, pnpm, lerna, turbo, nx)
- [x] Vulnerability detection via OSV.dev API (8 ecosystems)
- [x] SBOM generation (CycloneDX 1.5, SPDX 2.3)
- [x] Stack Diff between scans
- [x] Desktop renewal notifications (OS-level, 30-day window)
- [x] Cost visualization with bar chart (Recharts)
- [x] macOS / Windows / Linux distributable builds
- [x] 29-point production build validation
- [x] Zombie service detection via git log (active/stale/zombie classification)
- [x] Stack Score history with trend tracking (.stackwatch/score-history.json)
- [x] `stackwatch doctor` CLI command (config, services, costs, vulns, score checklist)
- [x] Budget mode in CostsPanel (monthly budget, progress bar, threshold alerts)
- [x] Score history UI (Recharts line chart modal, trend stats, min/max/average)
- [x] Light/dark theme toggle (CSS variables, localStorage persistence, Settings + Sidebar controls)
- [x] Static HTML export (self-contained report, CLI --html flag, IPC export-html, print-friendly)
- [x] AI stack alternatives (cheaper/open-source suggestions per service, Step D in deep analysis)
- [x] Zombie UI badges and activity filter in ServicesPanel
- [x] Doctor modal in desktop app (health checklist with live vuln scan)
- [x] 43 new tests: zombieDetector (12), scoreHistory (8), htmlExporter (13), alternativeSuggester (10)
- [x] Semantic evidence scoring system: base scores by evidence type, score penalties, score-based confidence thresholds
- [x] Brand collapse deduplication: multi-evidence per brand → single entry
- [x] CLI `--all` flag to show low-confidence and needs-review services
- [x] npm packages pass through without allowlist — deduplicator discards npm-only via score threshold
- [x] AI false-positive filter (Step 0): semantic validation before AI refine, silent fallback, aiFilteredCount metric
- [x] 3 new tests for filterFalsePositivesWithAI (valid response, malformed JSON, network error)
- [x] Scan mode dialog: Merge (keep manual services + graph positions) vs Fresh Scan (discard all) before re-scanning repos with saved data
- [x] 5 new tests for ScanModeDialog (no saved data skips dialog, shows dialog on saved data, cancel aborts, merge keeps manual, fresh discards manual)
- [x] Discarded panel: virtualized list of items filtered during analysis (low_score, ai_filter, generic_term), with search, reason filter, and restore to manual service
- [x] Backend: deduplicator tracks discarded items (low_score, generic_term), pipeline tracks AI-filtered items, included in AnalysisResult
- [x] 10 new tests: DiscardedPanel (7), deduplicator discarded tracking (3)
- [x] Layer node type: organizational nodes (User, Frontend, Backend, grouping) use type: 'layer' with layerColor, 200x56 dimensions, uppercase bold styling
- [x] "Add layer node" in pane context menu, layer-specific icons per label (User/Frontend/Backend), no confidence badges on layer nodes
- [x] Evidence info popover on ServiceCard: "?" button showing score breakdown per evidence type, total score, confidence level
- [x] Graph diff visual: new nodes highlighted green (3s), removed nodes grey with strikethrough (3s fade-out) after re-scan
- [x] EvidenceSummary type: best evidence per type with scores, populated in deduplicator
- [x] 9 new tests: scanDiff (7), ServiceCard evidence popover (2)
