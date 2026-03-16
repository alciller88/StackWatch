# SPEC.md — StackWatch

> Technical specification document. Source of truth for AI agents and developers.
> Last updated: 2026-03-16 | Status: draft v0.3

---

## 1. Product vision

**StackWatch** is a desktop application (Electron) that lets developers visualize, document and monitor all services, dependencies and external accounts that make up any software project — by automatically inferring them from the repository and allowing manual enrichment.

### Problem it solves
Modern projects depend on dozens of external services (hosting, domain, CI/CD, analytics, payments, APIs...) spread across multiple accounts and providers. There is no unified view of the entire ecosystem.

### Value proposition
- **Smart automatic inference**: detects services via semantic heuristics — no hardcoded service lists
- **Optional AI**: enhances detection of ambiguous cases with any OpenAI-compatible provider, including free local models (Ollama, LM Studio)
- **Deep AI analysis**: when AI is configured, analyzes service usage context, detects hidden services consumed via wrappers, and infers correct graph edge types
- **Manual enrichment**: user adds what cannot be inferred (credentials, billing accounts, renewal dates, services with no code footprint)
- **Unified view**: dashboard with three panels — services (with confidence levels), dependencies and flow graph
- **Portable and offline**: all information lives in the repo itself as versionable text files

---

## 2. Tech stack

| Layer | Technology | Rationale |
|---|---|---|
| App shell | Electron | Local fs access + cross-platform packaging |
| UI / renderer | React + Vite | Mature ecosystem, fast HMR |
| Styles | Tailwind CSS | Utility-first, no custom CSS |
| Interactive graph | React Flow | Draggable nodes, easy React integration |
| Dependency analysis | Node.js (main process) | Direct fs access without CORS |
| Remote GitHub | Octokit (`@octokit/rest`) | Official client, well documented |
| Local persistence | `electron-store` | Encryptable JSON, no SQLite needed |
| IPC | `contextBridge` + `ipcMain/ipcRenderer` | Secure main ↔ renderer separation |
| .gitignore | `ignore` (npm) | Respect repo exclusions during recursive scan |

### Project folder structure

```
stackwatch/
├── electron/
│   ├── main.ts              # Main process, IPC handlers
│   ├── preload.ts           # Secure bridge to renderer
│   ├── types.ts             # Shared types (Service, Evidence, AIProvider, etc.)
│   ├── analyzers/
│   │   ├── extractor.ts     # Extracts raw evidence from repo (recursive, respects .gitignore)
│   │   ├── heuristic.ts     # Classifies evidence by semantics (no fixed lists)
│   │   ├── deduplicator.ts  # Groups and deduplicates detected services
│   │   ├── flowInference.ts # Infers architecture flow graph
│   │   └── index.ts         # Orchestrates the full pipeline: extract → classify → dedup → AI → flow
│   └── ai/
│       ├── provider.ts      # OpenAI-compatible client + provider presets
│       └── deepAnalyzer.ts  # Deep AI analysis: context, hidden detection, edge inference
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── ServicesPanel/    # ServiceCard with confidence badges, "Needs Review" section
│   │   ├── DepsPanel/
│   │   ├── FlowGraph/       # Interactive graph with context menus, inline editing
│   │   ├── TopBar/           # Import/export, re-analyze, GitHub connect
│   │   └── Settings/        # AI provider configuration
│   ├── store/               # Global state (Zustand) — useStore + graphStore
│   └── main.tsx
├── stackwatch.config.json   # User manual config (versionable)
└── CONTEXT.md               # Living context for agents
```

---

## 3. Detection architecture (v0.3)

### Two-layer analysis pipeline

```
repo (local or GitHub)
    ↓
Evidence extractor  →  Evidence[]  (deterministic, fast)
    ↓
Heuristic classifier  →  HeuristicResult[]  (semantic, no fixed lists)
    ↓
Deduplicator  →  DetectedService[]  (grouped, no duplicates)
    ↓ (if AI configured)
Deep AI analysis  →  enriched services + hidden services + smart edge types
    ↓
Merge with stackwatch.config.json  →  user's manual services
    ↓
Dashboard: services panel + flow graph with confidence levels
```

### 3.1 Evidence extractor (`extractor.ts`)

Walks the repo recursively and extracts raw signals:

| Type | Source | How |
|---|---|---|
| `npm_package` | `package.json` (all levels) | Reads dependencies + devDependencies |
| `env_var` | All `.env*` files in the repo | Parses key=value |
| `url` | Code files (.ts, .tsx, .js, .jsx, .py, .go, .rs) | Regex in API call patterns + constant assignments |
| `import` | Same code files | Regex `from '...'` and `require('...')` |
| `config_file` | Repo root | Presence of vercel.json, firebase.json, fly.toml, etc. |
| `ci_secret` | `.github/workflows/*.yml`, `.gitlab-ci.yml` | Regex `secrets.NAME` |
| `domain` | All code | Extract domain from URLs |

**Exclusions:** node_modules, dist, .next, build, .git, coverage + respects .gitignore

### 3.2 Heuristic classifier (`heuristic.ts`)

Classifies evidence using semantics, with no hardcoded lists:

- **Environment variables:** Extracts service name by removing common prefixes (NEXT_PUBLIC_, VITE_, etc.) and suffixes (_KEY, _SECRET, _URL, etc.). High confidence if it's a credential or endpoint.
- **External URLs:** Extracts domain, strips common subdomains (api., app., cdn.). High confidence if contains `/api/`.
- **npm packages:** Ignores utilities, frameworks and dev tools. Extracts service name from package name.
- **Config files:** Direct file-to-service mapping (vercel.json → Vercel, etc.)
- **Category inference:** Semantic regex against normalized name for 19 categories.

### 3.3 Deep AI analysis (`ai/deepAnalyzer.ts`)

Only runs if the user configures an AI provider. Three capabilities executed in parallel:

1. **Service context**: For each detected service, reads relevant code files and determines usage description, criticality level (critical/important/optional), and warnings (hardcoded secrets, missing error handling).
2. **Hidden service detection**: Reads priority files (lib/, services/, api/) and finds services consumed via wrappers or custom SDKs that heuristic analysis missed.
3. **Smart graph edges**: Determines correct edge type (data/auth/payment/webhook) based on actual service usage context.

**Preconfigured providers:**
- Ollama (local, free) — `localhost:11434`
- LM Studio (local, free) — `localhost:1234`
- Groq (fast, free tier)
- OpenAI — `gpt-4o-mini`
- Mistral — `mistral-small-latest`
- Anthropic — `claude-haiku-4-5`
- Custom (any OpenAI-compatible endpoint)

If AI fails, silent fallback to heuristic results.

**Token control:** max 5 files/service, 500 lines/file, 10 files for hidden detection, batches of 3 concurrent calls.

### 3.4 Manual configuration (`stackwatch.config.json`)

The user can add services manually from the UI with an expanded form: name, category, plan, cost, renewal date, account email, notes, URL. Persisted with `source: "manual"`.

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
  inferredFrom?: string
  cost?: { amount: number; currency: string; period: 'monthly' | 'yearly' }
  renewalDate?: string
  accountEmail?: string
  notes?: string
  url?: string
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

interface DeepAnalysisResult {
  serviceContexts: ServiceContext[]
  hiddenServices: Service[]
  inferredEdgeTypes: { serviceId: string; flowType: FlowEdge['flowType']; reason: string }[]
}
```

### Dependency, FlowNode, FlowEdge

No changes from v0.1.

---

## 5. UI — Confidence levels

### Services panel
- `high` → normal card, no extra badge
- `medium` → yellow "review" badge
- `low` → orange "incomplete" badge + warning icon + tooltip with reason
- "Needs Review" section at the top of the panel if any services have `needsReview: true`
- When deep AI analysis is available, cards show usage context quote, criticality badge, and warnings

### Flow graph
- Nodes with `confidence: 'low'` → dashed border + orange color + "?" marker
- Tooltip on hover with detection reason
- Interactive: right-click context menus for nodes, edges, and canvas
- Inline edit panel for node properties (name, type, category, plan, URL, notes)
- Drag-from-handle to create edges; snap to grid (16px)
- Edge types colored by flow type (data/auth/payment/webhook)

### Settings
- Toggle "Enhance analysis with AI" (disabled by default)
- Provider dropdown (presets + Custom)
- API Key field (hidden for Ollama and LM Studio)
- Base URL and Model fields (editable for Custom/Local)
- "Test Connection" button
- Privacy note for local providers

---

## 6. IPC communication (main ↔ renderer)

```typescript
interface StackWatchAPI {
  analyzeLocal(folderPath: string): Promise<AnalysisResult>
  analyzeGitHub(repo: string, token: string): Promise<AnalysisResult>
  openFolder(): Promise<string | null>
  loadConfig(repoPath: string): Promise<UserConfig | null>
  saveConfig(repoPath: string, config: UserConfig): Promise<void>
  getAISettings(): Promise<AISettings>
  setAISettings(settings: AISettings): Promise<void>
  testAIConnection(provider: AIProvider): Promise<{ ok: boolean; error?: string }>
  getAIPresets(): Promise<AIProvider[]>
  importConfig(repoPath: string): Promise<string | null>
  exportConfig(content: string): Promise<boolean>
  exportServicesMd(content: string): Promise<boolean>
}
```

---

## 7. Out of scope (v1)

- Push notifications / email alerts for renewals
- Multi-project (v1 manages one project at a time)
- Integration with service billing APIs
- Dependency vulnerability detection
- Monorepo support

---

## 8. Acceptance criteria (v0.3)

- [x] Without any configuration, StackWatch detects services semantically — zero hardcoded lists
- [x] Variables like TWITTER_API_KEY or GA_MEASUREMENT_ID generate entries with high/medium confidence even if the service is not in any list
- [x] User can add services manually from the UI — persisted in stackwatch.config.json
- [x] AI configuration accepts any OpenAI-compatible provider including Ollama and LM Studio without API key
- [x] If AI fails, the app shows heuristic results without errors
- [x] Flow graph shows confidence indicators (dashed borders for low confidence)
- [x] Interactive flow graph with context menus, node editing, and custom connections
- [x] Deep AI analysis provides service context, hidden detection, and smart edge types
- [x] 58 tests passing for heuristic, deduplication, extraction, pipeline, and flow inference
