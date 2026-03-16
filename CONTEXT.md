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

- **Fase**: v0.3.1 — análisis profundo con IA
- **Último hito**: deep AI analysis (2026-03-16)
  - **FEAT:** cuando la IA está configurada, el pipeline ejecuta análisis profundo con tres capacidades:
    - **Contexto de uso**: para cada servicio detectado, la IA lee el código y explica cómo se usa, su criticidad, y detecta warnings (credenciales hardcoded, etc.)
    - **Detección de servicios ocultos**: la IA lee ficheros prioritarios (lib/, services/, api/) y encuentra servicios consumidos via wrappers o SDKs que la heurística no detectó
    - **Inferencia de aristas del grafo**: la IA determina el tipo de conexión correcto (data/auth/payment/webhook) basándose en el contexto de uso
  - **ARCH:** nuevo `electron/ai/deepAnalyzer.ts` con `runDeepAnalysis()` que orquesta las tres capacidades en paralelo
  - **UI:** ServiceCard muestra contexto de uso (quote), criticidad (critical/important/optional con colores), y warnings de la IA
  - **UX:** TopBar muestra "AI analysis..." durante análisis con IA activa; sin IA, comportamiento idéntico al anterior
  - **TYPES:** nuevos tipos `ServiceContext`, `DeepAnalysisResult` en ambas capas; `AnalysisResult.deepAnalysis` opcional
  - **CONTROL:** máx 5 ficheros/servicio, 500 líneas/fichero, 10 ficheros para detección oculta, batches de 3 llamadas concurrentes
  - 58 tests passing (heuristic: 13, deduplicator: 6, extractor: 26, pipeline: 4, flowInference: 9)
- **Hitos anteriores**:
  - v0.3.0: grafo de flujo interactivo (context menus, node editing, custom connections, graphStore)
  - v0.2.5: fix detección de APIs en constantes y env vars con sufijos KEY/SECRET/TOKEN
  - v0.2.4: fix own project name filtering + import config
  - v0.2.3: extractor filtra solo llamadas de red reales, IGNORED_DOMAINS ampliado, excepción api.*, process.env URL detection
  - v0.2.2: purga de bugs, eliminación de duplicación, tests del extractor
  - v0.2.1: proveedores IA recomendados + formulario de servicios manuales
  - v0.2: reingeniería completa del sistema de detección — heurística semántica + IA opcional
  - v0.1: scaffolding completo, 11 analizadores hardcodeados, UI React completa, WSL support
  - Multi-ecosistema: Python, Rust, Go, Terraform
  - WSL2 auto-download de Electron binary
  - CommonJS fix para Electron main process
- **Próximo paso**: validar build de producción (`npm run build`), tests de componentes UI

---

## Decisiones de arquitectura tomadas (no reabrir sin motivo)

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Heurística semántica sin mapas fijos | Mapas hardcodeados por servicio | Escalabilidad — detecta servicios nuevos sin actualizar código |
| IA opcional con fallback silencioso | IA requerida | La app debe funcionar 100% offline sin config |
| OpenAI-compatible API para IA | SDK específicos por proveedor | Un solo formato cubre Ollama, LM Studio, Groq, OpenAI, Mistral, Custom |
| electron-store para AI settings | Fichero JSON manual | Integrado con Electron, sin I/O manual |
| `ignore` (npm) para .gitignore | Regex manual | Edge cases resueltos, es el estándar |
| `electron-store` para persistencia | SQLite | Suficiente para v1, sin dependencia nativa |
| React Flow para el grafo | D3.js | Mejor DX con React, nodos React nativos |
| Zustand para estado global | Redux / Context | Menos boilerplate, suficiente para la escala |
| graphStore separado del store principal | Un solo store | El grafo interactivo tiene estado propio (nodes, edges, excluded) con ciclo de vida diferente |
| Posiciones de nodo en config.graph | electron-store | Las posiciones deben versionarse con el repo, no ser globales al sistema |
| Panel inline sobre modal/drawer | Modal | No interrumpe el flujo visual del grafo |
| Deep analysis con IA enriquece en lugar de reemplazar | IA reemplaza heurística | La heurística es rápida y funciona offline; la IA es complementaria |
| Tres capacidades de IA en paralelo | Secuencial | Minimiza latencia total, cada paso es independiente |

---

## Convenciones del proyecto

- **TypeScript estricto** en todo el codebase (`strict: true`)
- **Nomenclatura**: camelCase para variables/funciones, PascalCase para componentes y tipos
- **Imports**: rutas absolutas desde `src/` configuradas en `tsconfig.json`
- **IPC**: todos los canales definidos en `electron/preload.ts`, nunca exponer `ipcRenderer` directamente
- **Análisis**: flujo extract → classify → dedup → (AI) → flow. Cada paso es puro y testeable.
- **Sin secretos en el repo**: el token de GitHub y la API key de IA se guardan con `electron-store`

---

## Ficheros clave que el agente debe conocer

```
SPEC.md                              ← especificación completa (v0.2)
CONTEXT.md                           ← este fichero
electron/types.ts                    ← todos los tipos: Service, Evidence, AIProvider, etc.
electron/main.ts                     ← entry point + IPC handlers (análisis + AI settings)
electron/preload.ts                  ← bridge IPC (11 canales)
electron/analyzers/extractor.ts      ← extracción de evidencias del repo
electron/analyzers/heuristic.ts      ← clasificación semántica
electron/analyzers/deduplicator.ts   ← agrupación y deduplicación
electron/analyzers/index.ts          ← orquestador del pipeline completo
electron/analyzers/flowInference.ts  ← inferencia de grafo de flujo
electron/ai/provider.ts              ← cliente IA OpenAI-compatible + presets
electron/ai/deepAnalyzer.ts          ← análisis profundo: contexto, detección oculta, aristas
src/store/useStore.ts                ← estado global Zustand (servicios, deps, config)
src/store/graphStore.ts              ← estado del grafo interactivo (nodes, edges, excluded)
src/components/Settings/Settings.tsx ← configuración de IA
src/components/ServicesPanel/        ← panel con badges de confianza
src/components/FlowGraph/            ← grafo interactivo con context menus
src/components/FlowGraph/ContextMenu.tsx  ← menú contextual genérico
src/components/FlowGraph/NodeEditPanel.tsx ← panel inline de edición de nodos
```

---

## Lo que NO hacer (lecciones aprendidas)

- **No usar mapas hardcodeados de servicios** — el sistema heurístico clasifica por semántica
- **No usar `nodeIntegration: true`** en webPreferences — todo IPC via `contextBridge`
- **No parsear `.env` con regex casero** — usar parseo line-by-line con split en `=`
- **No bloquear el proceso principal** con análisis síncronos — usar `fs.promises`
- **No hardcodear rutas** — usar `path.join` siempre
- **No asumir IA disponible** — siempre fallback al resultado heurístico

---

## Contexto de producto (para decisiones de UX)

- **Usuario objetivo**: cualquier desarrollador o equipo pequeño que gestiona un proyecto de software
- **Dolor principal**: no saber qué servicios están activos, cuáles son de pago, cuándo renuevan
- **Caso de uso más frecuente**: abrir la app al empezar el día para ver el estado del proyecto
- **Caso de uso secundario**: incorporar a un nuevo desarrollador al equipo

---

## Preguntas abiertas (para próximas sesiones)

- ¿Soporte para monorepos en v1 o v2?
- ¿Alertas de renovación como notificaciones del sistema operativo?
- ¿El `stackwatch.config.json` se cifra o va en claro al repo?
