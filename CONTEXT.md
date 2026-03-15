# CONTEXT.md — StackWatch

> Este fichero es memoria viva para agentes de IA (Claude, Copilot, Cursor, etc.).
> Actualízalo después de cada sesión significativa de desarrollo.
> NO es documentación de usuario — es contexto operativo para el agente.

---

## Qué es este proyecto

App de escritorio Electron + React que analiza cualquier proyecto de software (local o GitHub) e infiere todos los servicios externos, dependencias y cuentas que usa el proyecto. Soporta ecosistemas web, Python, Rust, Go, Terraform y más. El resultado se muestra en un dashboard con tres paneles: servicios, dependencias y grafo de flujo.

El fichero de configuración manual del usuario es `stackwatch.config.json` en la raíz del repo analizado (no del repo de la app).

Spec completa: `SPEC.md`

---

## Estado actual del desarrollo

> ⚠️ Actualizar esta sección al inicio de cada sesión.

- **Fase**: v0.1 funcional — scaffolding completo con todos los módulos implementados
- **Último hito**: implementación completa del proyecto (2026-03-15)
  - Scaffolding: package.json, tsconfig, vite.config, tailwind, electron-builder
  - Proceso Electron: main.ts, preload.ts, types.ts con IPC completo
  - 11 analizadores: packageJson, envFile, dockerCompose, githubWorkflows, configFiles, pythonDeps, rustDeps, goDeps, terraform, flowInference, index
  - UI React: Dashboard, ServicesPanel (con ServiceCard y formulario Add), DepsPanel (tabla con filtros/sort/agrupación), FlowGraph (React Flow + dagre layout), Sidebar (colapsable), TopBar (con soporte GitHub)
  - Store Zustand: estado global con análisis local/GitHub, merge de servicios manuales
  - TypeScript compila sin errores (`tsc --noEmit` limpio)
- **WSL support** (2026-03-15):
  - `scripts/launch-electron.js` — detects WSL2 and uses `electron.exe` (Windows binary) directly, bypassing Linux binary entirely — no system libs needed
  - Converts WSL paths (`/mnt/c/...`) to Windows paths (`C:\...`) so `electron.exe` can resolve the app root
  - `npm run dev` now works on Windows native, WSL2, and macOS without manual intervention or library installation
- **Fix: Electron dev launch** (2026-03-15):
  - `npm run dev` now compiles Electron TS files (`tsc -p tsconfig.node.json`) before launching Electron — previously `dist-electron/` was missing, causing silent launch failure
  - Added `window.stackwatch` guards in store (`analyzeLocal`, `analyzeGitHub`, `openFolder`) to show a clear error message instead of crashing when running outside Electron (e.g., opening Vite URL directly in browser)
- **Fix: WSL2 auto-download + CommonJS** (2026-03-15):
  - `scripts/launch-electron.js` now auto-downloads the Windows Electron binary on first run in WSL2 (re-runs `node_modules/electron/install.js` with `npm_config_platform=win32`) — no manual steps needed
  - `tsconfig.node.json` changed from `ESNext`/`bundler` to `CommonJS`/`node` — fixes `ERR_MODULE_NOT_FOUND` caused by missing `.js` extensions in ESM imports; Electron main process runs in Node.js and works natively with CommonJS
  - `npm run dev` now launches successfully on WSL2 end-to-end
- **Feature: multi-ecosystem support** (2026-03-15):
  - Expanded scope from web-only to any software project type
  - 4 new analyzers: pythonDeps (requirements.txt, pyproject.toml, setup.py), rustDeps (Cargo.toml), goDeps (go.mod), terraform (*.tf)
  - Expanded envFile.ts with 25+ new service patterns: AI (OpenAI, Anthropic, HuggingFace...), Mobile (Firebase, App Center...), Data (Snowflake, Pinecone...), Gaming (Steam, Discord...), Messaging (Kafka, RabbitMQ...), Support (Intercom, Zendesk...)
  - 7 new service categories: ai, mobile, gaming, data, messaging, support, infra
  - 5 new dependency ecosystems: go, dart, maven, gradle, gem
  - 32 unit tests passing across 5 test files
  - Both local and GitHub analysis paths updated with new analyzers
- **Próximo paso**: validar build de producción (`npm run build`), añadir analizadores pendientes (pubspec.yaml, Gemfile, pom.xml, build.gradle, k8s, gitlab-ci)

---

## Decisiones de arquitectura tomadas (no reabrir sin motivo)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| `electron-store` para persistencia | SQLite | Suficiente para v1, sin dependencia nativa |
| React Flow para el grafo | D3.js | Mejor DX con React, nodos React nativos |
| Octokit para GitHub | fetch directo | Rate limiting, auth y paginación ya resueltos |
| Zustand para estado global | Redux / Context | Menos boilerplate, suficiente para la escala |
| Vite como bundler del renderer | CRA / webpack | Más rápido, mejor soporte ESM |

---

## Convenciones del proyecto

- **TypeScript estricto** en todo el codebase (`strict: true`)
- **Nomenclatura**: camelCase para variables/funciones, PascalCase para componentes y tipos
- **Imports**: rutas absolutas desde `src/` configuradas en `tsconfig.json`
- **IPC**: todos los canales definidos en `electron/preload.ts`, nunca exponer `ipcRenderer` directamente
- **Análisis**: cada analizador es una función pura `analyze(content: string): Partial<AnalysisResult>` — fácil de testear
- **Sin secretos en el repo**: el token de GitHub lo guarda `electron-store` en el keychain del sistema

---

## Ficheros clave que el agente debe conocer

```
SPEC.md                          ← especificación completa
CONTEXT.md                       ← este fichero
stackwatch.config.json        ← config manual del usuario (en el repo analizado)
electron/main.ts                 ← entry point del proceso principal
electron/preload.ts              ← bridge IPC
electron/analyzers/              ← módulos de análisis, uno por tipo de fichero/ecosistema
electron/analyzers/__tests__/    ← tests unitarios para analizadores
src/store/                       ← estado global Zustand
scripts/launch-electron.js       ← launcher con detección WSL
src/components/FlowGraph/        ← panel más complejo, usa React Flow
```

---

## Patrones a seguir

### Añadir un nuevo analizador

1. Crear `electron/analyzers/miAnalizador.ts`
2. Exportar función `analyze(content: string): Partial<AnalysisResult>` — función pura, sin I/O
3. Importar y llamar en `electron/analyzers/index.ts` (análisis local) y en `electron/main.ts` (análisis GitHub)
4. Añadir tests unitarios en `electron/analyzers/__tests__/miAnalizador.test.ts`
5. Para ecosistemas no-npm: añadir el ecosistema al tipo `Dependency['ecosystem']` en ambos `types.ts` y en `ecosystemUrls` de `DepsPanel.tsx`

### Añadir un nuevo servicio a la detección automática

Editar el mapa de patrones en `electron/analyzers/envFile.ts`:

```typescript
const SERVICE_PATTERNS: Record<string, ServiceMeta> = {
  'STRIPE_': { name: 'Stripe', category: 'payments' },
  // añadir aquí
}
```

### Añadir un panel nuevo al dashboard

1. Crear carpeta en `src/components/NuevoPanel/`
2. Registrar ruta en `src/App.tsx`
3. Añadir entrada en la navegación lateral `src/components/Sidebar/`

---

## Lo que NO hacer (lecciones aprendidas)

- **No usar `nodeIntegration: true`** en webPreferences — es inseguro. Todo IPC via `contextBridge`.
- **No parsear `.env` con regex casero** — usar la librería `dotenv` para evitar edge cases.
- **No bloquear el proceso principal** con análisis síncronos de ficheros grandes — usar `fs.promises`.
- **No hardcodear rutas** — usar `path.join` siempre, la app corre en macOS, Windows y Linux.

---

## Contexto de producto (para decisiones de UX)

- **Usuario objetivo**: cualquier desarrollador o equipo pequeño que gestiona un proyecto de software (web, mobile, data/ML, backend, infra, gaming...)
- **Dolor principal**: no saber qué servicios están activos, cuáles son de pago, cuándo renuevan
- **Caso de uso más frecuente**: abrir la app al empezar el día para ver el estado del proyecto
- **Caso de uso secundario**: incorporar a un nuevo desarrollador al equipo — exportar el mapa de servicios

---

## Preguntas abiertas (para próximas sesiones)

- ¿El grafo de flujo lo define el usuario manualmente o lo inferimos también? ¿Cómo?
- ¿Soporte para monorepos en v1 o v2?
- ¿Alertas de renovación como notificaciones del sistema operativo?
- ¿El `stackwatch.config.json` se cifra o va en claro al repo? (problema con `accountEmail`)

---

## Cómo usar este fichero como agente

Al inicio de cada sesión:
1. Lee `CONTEXT.md` (este fichero) para entender el estado actual
2. Lee `SPEC.md` para tener el contrato completo
3. Pregunta al usuario qué quiere trabajar hoy
4. Al terminar la sesión, propón al usuario actualizar la sección "Estado actual del desarrollo"
