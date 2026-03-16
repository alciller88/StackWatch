# CONTEXT.md — StackWatch

> This file is living memory for AI agents (Claude, Copilot, Cursor, etc.).
> Update it after each significant development session.
> NOT user documentation — this is operational context for the agent.

---

## What this project is

Electron + React desktop app that analyzes any software project (local or GitHub) and infers all external services, dependencies and accounts the project uses. Supports web, Python, Rust, Go, Terraform ecosystems and more. Results are displayed in a dashboard with three panels: services, dependencies and flow graph.

The user's manual configuration file is `stackwatch.config.json` in the root of the analyzed repo (not the app's repo).

Full spec: `SPEC.md`

---

## Current development state

> ⚠️ Update this section at the start of each session.

- **Phase**: v0.3.1 — deep AI analysis
- **Latest milestone**: deep AI analysis (2026-03-16)
  - **FEAT:** when AI is configured, the pipeline runs deep analysis with three capabilities:
    - **Usage context**: for each detected service, AI reads the code and explains how it's used, its criticality, and detects warnings (hardcoded credentials, etc.)
    - **Hidden service detection**: AI reads priority files (lib/, services/, api/) and finds services consumed via wrappers or SDKs that heuristic analysis missed
    - **Graph edge inference**: AI determines the correct connection type (data/auth/payment/webhook) based on usage context
  - **ARCH:** new `electron/ai/deepAnalyzer.ts` with `runDeepAnalysis()` orchestrating all three capabilities in parallel
  - **UI:** ServiceCard shows usage context (quote), criticality (critical/important/optional with colors), and AI warnings
  - **UX:** TopBar shows "AI analysis..." during analysis when AI is active; without AI, behavior is identical to before
  - **TYPES:** new types `ServiceContext`, `DeepAnalysisResult` in both layers; `AnalysisResult.deepAnalysis` optional
  - **CONTROL:** max 5 files/service, 500 lines/file, 10 files for hidden detection, batches of 3 concurrent calls
  - 58 tests passing (heuristic: 13, deduplicator: 6, extractor: 26, pipeline: 4, flowInference: 9)
- **Previous milestones**:
  - v0.3.0: interactive flow graph (context menus, node editing, custom connections, graphStore)
  - v0.2.5: fix API detection in constants and env vars with KEY/SECRET/TOKEN suffixes
  - v0.2.4: fix own project name filtering + import config
  - v0.2.3: extractor filters only real network calls, IGNORED_DOMAINS expanded, api.* exception, process.env URL detection
  - v0.2.2: bug fixes, code deduplication, extractor tests
  - v0.2.1: recommended AI providers + manual service form
  - v0.2: complete reengineering of detection system — semantic heuristics + optional AI
  - v0.1: complete scaffolding, 11 hardcoded analyzers, full React UI, WSL support
  - Multi-ecosystem: Python, Rust, Go, Terraform
  - WSL2 auto-download of Electron binary
  - CommonJS fix for Electron main process
- **Next step**: validate production build (`npm run build`), UI component tests

---

## Architecture decisions (do not reopen without reason)

| Decision | Rejected alternative | Reason |
|---|---|---|
| Semantic heuristics without fixed maps | Hardcoded per-service maps | Scalability — detects new services without code changes |
| Optional AI with silent fallback | AI required | App must work 100% offline without config |
| OpenAI-compatible API for AI | Provider-specific SDKs | One format covers Ollama, LM Studio, Groq, OpenAI, Mistral, Custom |
| electron-store for AI settings | Manual JSON file | Integrated with Electron, no manual I/O |
| `ignore` (npm) for .gitignore | Manual regex | Edge cases handled, it's the standard |
| `electron-store` for persistence | SQLite | Sufficient for v1, no native dependency |
| React Flow for the graph | D3.js | Better DX with React, native React nodes |
| Zustand for global state | Redux / Context | Less boilerplate, sufficient for the scale |
| Separate graphStore from main store | Single store | Interactive graph has its own state (nodes, edges, excluded) with a different lifecycle |
| Node positions in config.graph | electron-store | Positions should be versioned with the repo, not global to the system |
| Inline panel over modal/drawer | Modal | Doesn't interrupt the visual flow of the graph |
| Deep AI analysis enriches instead of replacing | AI replaces heuristics | Heuristics are fast and work offline; AI is complementary |
| Three AI capabilities in parallel | Sequential | Minimizes total latency, each step is independent |

---

## Project conventions

- **Strict TypeScript** across the entire codebase (`strict: true`)
- **Naming**: camelCase for variables/functions, PascalCase for components and types
- **Imports**: absolute paths from `src/` configured in `tsconfig.json`
- **IPC**: all channels defined in `electron/preload.ts`, never expose `ipcRenderer` directly
- **Analysis**: pipeline flow extract → classify → dedup → (AI) → flow. Each step is pure and testable.
- **No secrets in the repo**: GitHub token and AI API key are stored with `electron-store`

---

## Key files the agent must know

```
SPEC.md                              ← full specification (v0.3)
CONTEXT.md                           ← this file
electron/types.ts                    ← all types: Service, Evidence, AIProvider, ServiceContext, etc.
electron/main.ts                     ← entry point + IPC handlers (analysis + AI settings)
electron/preload.ts                  ← IPC bridge (12 channels)
electron/analyzers/extractor.ts      ← evidence extraction from repo
electron/analyzers/heuristic.ts      ← semantic classification
electron/analyzers/deduplicator.ts   ← grouping and deduplication
electron/analyzers/index.ts          ← full pipeline orchestrator
electron/analyzers/flowInference.ts  ← flow graph inference
electron/ai/provider.ts              ← OpenAI-compatible AI client + presets
electron/ai/deepAnalyzer.ts          ← deep analysis: context, hidden detection, edge inference
src/store/useStore.ts                ← global Zustand state (services, deps, config, deepAnalysis)
src/store/graphStore.ts              ← interactive graph state (nodes, edges, excluded)
src/components/Settings/Settings.tsx ← AI configuration
src/components/ServicesPanel/        ← panel with confidence badges + AI context
src/components/FlowGraph/            ← interactive graph with context menus
src/components/FlowGraph/ContextMenu.tsx  ← generic context menu
src/components/FlowGraph/NodeEditPanel.tsx ← inline node edit panel
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
3. Add tab button in the sidebar/navigation
4. Add panel rendering in the main layout

---

## What NOT to do (lessons learned)

- **Do not use hardcoded service maps** — the heuristic system classifies by semantics
- **Do not use `nodeIntegration: true`** in webPreferences — all IPC via `contextBridge`
- **Do not parse `.env` with custom regex** — use line-by-line parsing with split on `=`
- **Do not block the main process** with synchronous analysis — use `fs.promises`
- **Do not hardcode paths** — always use `path.join`
- **Do not assume AI is available** — always fallback to heuristic results

---

## Product context (for UX decisions)

- **Target user**: any developer or small team managing a software project
- **Main pain point**: not knowing which services are active, which are paid, when they renew
- **Primary use case**: open the app at the start of the day to see the project's status
- **Secondary use case**: onboarding a new developer to the team

---

## Open questions (for future sessions)

- Monorepo support in v1 or v2?
- Renewal alerts as OS notifications?
- Should `stackwatch.config.json` be encrypted or stored in plain text in the repo?

---

## How to use this file as an agent

1. **Read this file first** at the start of every session to understand project state
2. **Check "Current development state"** to know what was done last and what's next
3. **Check "Architecture decisions"** before proposing structural changes
4. **Check "What NOT to do"** to avoid known pitfalls
5. **Update this file** after making significant changes — keep the living memory current
