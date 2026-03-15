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

- **Fase**: v0.2 — detección heurística inteligente + IA opcional
- **Último hito**: reingeniería completa del sistema de detección (2026-03-15)
  - **ELIMINADOS:** Todos los analizadores con mapas hardcodeados (packageJson.ts, envFile.ts, dockerCompose.ts, githubWorkflows.ts, configFiles.ts, pythonDeps.ts, rustDeps.ts, goDeps.ts, terraform.ts + sus tests)
  - **NUEVO:** Arquitectura de detección en dos capas:
    - `electron/analyzers/extractor.ts` — extrae evidencias en bruto del repo (recursivo, respeta .gitignore con librería `ignore`)
    - `electron/analyzers/heuristic.ts` — clasifica evidencias por semántica sin listas fijas. 19 categorías de servicio.
    - `electron/analyzers/deduplicator.ts` — agrupa y deduplica servicios, merge de grupos relacionados por prefijo
    - `electron/analyzers/index.ts` — orquesta: extract → classify → dedup → (optional AI) → flow inference
  - **NUEVO:** `electron/ai/provider.ts` — cliente OpenAI-compatible con 5 presets (Ollama, LM Studio, Groq, OpenAI, Mistral) + Custom. Test de conexión. Fallback silencioso si falla.
  - **NUEVO:** `src/components/Settings/Settings.tsx` — panel de configuración de IA con toggle, selector de proveedor, API key, base URL, modelo, botón "Test Connection"
  - **ACTUALIZADO:** Service type con `confidence`, `needsReview`, `confidenceReasons`
  - **ACTUALIZADO:** ServicesPanel con sección "Needs Review" al inicio, formulario Add Service expandido (url, cost, renewal, email, notes)
  - **ACTUALIZADO:** ServiceCard con badges de confianza (amarillo "review", naranja "incomplete")
  - **ACTUALIZADO:** FlowGraph con bordes discontinuos y color naranja para nodos de baja confianza
  - **ACTUALIZADO:** Sidebar con navegación a Settings, Zustand store con AI settings
  - **ACTUALIZADO:** electron/main.ts con IPC handlers para AI settings via electron-store
  - **ACTUALIZADO:** electron/preload.ts con 3 nuevos canales IPC (getAISettings, setAISettings, testAIConnection)
  - 19 tests passing (heuristic: 13, deduplicator: 6)
- **Hitos anteriores**:
  - v0.1: scaffolding completo, 11 analizadores hardcodeados, UI React completa, WSL support
  - Multi-ecosistema: Python, Rust, Go, Terraform
  - WSL2 auto-download de Electron binary
  - CommonJS fix para Electron main process
- **Próximo paso**: validar build de producción (`npm run build`), añadir más tests para el extractor

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
electron/preload.ts                  ← bridge IPC (8 canales)
electron/analyzers/extractor.ts      ← extracción de evidencias del repo
electron/analyzers/heuristic.ts      ← clasificación semántica
electron/analyzers/deduplicator.ts   ← agrupación y deduplicación
electron/analyzers/index.ts          ← orquestador del pipeline completo
electron/analyzers/flowInference.ts  ← inferencia de grafo de flujo
electron/ai/provider.ts              ← cliente IA OpenAI-compatible
src/store/useStore.ts                ← estado global Zustand
src/components/Settings/Settings.tsx ← configuración de IA
src/components/ServicesPanel/        ← panel con badges de confianza
src/components/FlowGraph/            ← grafo con indicadores de confianza
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
