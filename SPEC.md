# SPEC.md — StackWatch

> Documento de especificación técnica. Fuente de verdad para agentes de IA y desarrolladores.
> Última actualización: 2026-03-15 | Estado: borrador v0.2

---

## 1. Visión del producto

**StackWatch** es una aplicación de escritorio (Electron) que permite a desarrolladores visualizar, documentar y monitorizar todos los servicios, dependencias y cuentas externas que componen cualquier proyecto de software, infiriéndolos automáticamente desde el repositorio y permitiendo enriquecer esa información manualmente.

### Problema que resuelve
Los proyectos modernos dependen de decenas de servicios externos (hosting, dominio, CI/CD, analytics, pagos, APIs...) distribuidos en múltiples cuentas y proveedores. No existe una vista unificada de todo ese ecosistema.

### Propuesta de valor
- **Inferencia automática inteligente**: detecta servicios mediante heurística semántica — sin listas hardcodeadas de servicios
- **IA opcional**: mejora la detección de casos ambiguos con cualquier proveedor OpenAI-compatible, incluyendo modelos locales gratuitos (Ollama, LM Studio)
- **Enriquecimiento manual**: el usuario añade lo que no se puede inferir (contraseñas, cuentas de pago, fechas de renovación, servicios sin rastro en el código)
- **Vista unificada**: dashboard con tres paneles — servicios (con niveles de confianza), dependencias y grafo de flujo
- **Portable y offline**: toda la información vive en el propio repo como ficheros de texto versionables

---

## 2. Stack técnico

| Capa | Tecnología | Justificación |
|---|---|---|
| Shell de app | Electron | Acceso a fs local + empaquetado multiplataforma |
| UI / renderer | React + Vite | Ecosistema maduro, HMR rápido |
| Estilos | Tailwind CSS | Utilidad, sin CSS custom |
| Grafo interactivo | React Flow | Nodos arrastrables, fácil integración con React |
| Análisis de deps | Node.js (main process) | Acceso directo a fs sin CORS |
| GitHub remoto | Octokit (`@octokit/rest`) | Cliente oficial, bien documentado |
| Persistencia local | `electron-store` | JSON cifrable, sin necesidad de SQLite |
| IPC | `contextBridge` + `ipcMain/ipcRenderer` | Separación segura main ↔ renderer |
| .gitignore | `ignore` (npm) | Respetar exclusiones del repo en el escaneo recursivo |

### Estructura de carpetas del proyecto

```
stackwatch/
├── electron/
│   ├── main.ts              # Proceso principal, IPC handlers
│   ├── preload.ts           # Bridge seguro al renderer
│   ├── types.ts             # Tipos compartidos (Service, Evidence, AIProvider, etc.)
│   ├── analyzers/
│   │   ├── extractor.ts     # Extrae evidencias en bruto del repo (recursivo, respeta .gitignore)
│   │   ├── heuristic.ts     # Clasifica evidencias por semántica (sin listas fijas)
│   │   ├── deduplicator.ts  # Agrupa y deduplica servicios detectados
│   │   ├── flowInference.ts # Infiere grafo de flujo de la arquitectura
│   │   └── index.ts         # Orquesta el flujo completo: extract → classify → dedup → AI → flow
│   └── ai/
│       └── provider.ts      # Cliente OpenAI-compatible + presets de proveedores
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── ServicesPanel/    # ServiceCard con badges de confianza, sección "Needs Review"
│   │   ├── DepsPanel/
│   │   ├── FlowGraph/       # Nodos con indicadores de confianza (borde discontinuo)
│   │   └── Settings/        # Configuración de proveedor de IA
│   ├── store/               # Estado global (Zustand) + AI settings
│   └── main.tsx
├── stackwatch.config.json   # Config manual del usuario (versionable)
└── CONTEXT.md               # Contexto vivo para agentes
```

---

## 3. Arquitectura de detección (v0.2)

### Flujo de análisis en dos capas

```
repo (local o GitHub)
    ↓
Extractor de evidencias  →  Evidence[]  (determinista, rápido)
    ↓
Clasificador heurístico  →  HeuristicResult[]  (semántica, sin listas fijas)
    ↓
Deduplicador             →  DetectedService[]  (agrupado, sin duplicados)
    ↓ (si IA configurada)
Mejora con IA            →  DetectedService[]  (solo casos ambiguos)
    ↓
Merge con stackwatch.config.json  →  servicios manuales del usuario
    ↓
Dashboard: panel servicios + grafo de flujo con niveles de confianza
```

### 3.1 Extractor de evidencias (`extractor.ts`)

Recorre el repo recursivamente y extrae señales en bruto:

| Tipo | Fuente | Cómo |
|---|---|---|
| `npm_package` | `package.json` (todos los niveles) | Lee dependencies + devDependencies |
| `env_var` | Todos los `.env*` del repo | Parsea key=value |
| `url` | Ficheros de código (.ts, .tsx, .js, .jsx, .py, .go, .rs) | Regex `https?://...` |
| `import` | Mismos ficheros de código | Regex `from '...'` y `require('...')` |
| `config_file` | Raíz del repo | Presencia de vercel.json, firebase.json, fly.toml, etc. |
| `ci_secret` | `.github/workflows/*.yml`, `.gitlab-ci.yml` | Regex `secrets.NOMBRE` |
| `domain` | Todo el código | Extraer dominio de URLs |

**Exclusiones:** node_modules, dist, .next, build, .git, coverage + respeta .gitignore

### 3.2 Clasificador heurístico (`heuristic.ts`)

Clasifica las evidencias usando semántica, sin ninguna lista hardcodeada:

- **Variables de entorno:** Extrae nombre del servicio eliminando prefijos genéricos (NEXT_PUBLIC_, VITE_, etc.) y sufijos (_KEY, _SECRET, _URL, etc.). Confianza alta si es credencial o endpoint.
- **URLs externas:** Extrae dominio, quita subdominios comunes (api., app., cdn.). Confianza alta si contiene `/api/`.
- **Paquetes npm:** Ignora utilidades, frameworks y herramientas de dev. Extrae nombre del servicio del nombre del paquete.
- **Config files:** Mapeo directo de fichero a servicio (vercel.json → Vercel, etc.)
- **Inferencia de categoría:** Regex semántica contra el nombre normalizado para 19 categorías.

### 3.3 IA opcional (`ai/provider.ts`)

Solo se ejecuta si el usuario la configura. Actúa sobre evidencias con confianza baja.

**Proveedores preconfigurados:**
- Ollama (local, gratuito) — `localhost:11434`
- LM Studio (local, gratuito) — `localhost:1234`
- Groq (rápido, tier gratuito)
- OpenAI — `gpt-4o-mini`
- Mistral — `mistral-small-latest`
- Custom (cualquier endpoint OpenAI-compatible)

Si la IA falla, fallback silencioso al resultado heurístico.

### 3.4 Configuración manual (`stackwatch.config.json`)

El usuario puede añadir servicios manualmente desde la UI con formulario expandido: nombre, categoría, plan, coste, fecha de renovación, email de cuenta, notas, URL. Se persisten con `source: "manual"`.

---

## 4. Modelo de datos

### Service

```typescript
interface Service {
  id: string
  name: string
  category: ServiceCategory  // 19 categorías
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

### Evidence (interno)

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

### Dependency, FlowNode, FlowEdge

Sin cambios respecto a v0.1.

---

## 5. UI — Niveles de confianza

### Panel de Servicios
- `high` → tarjeta normal, sin badge extra
- `medium` → badge amarillo "review"
- `low` → badge naranja "incomplete" + icono warning + tooltip con la razón
- Sección "Needs Review" al inicio del panel si hay servicios con `needsReview: true`

### Grafo de flujo
- Nodos `confidence: 'low'` → borde discontinuo + color naranja + "?" marker
- Tooltip en hover con razón de detección

### Settings
- Toggle "Enhance analysis with AI" (desactivado por defecto)
- Dropdown proveedor (presets + Custom)
- Campo API Key (oculto para Ollama y LM Studio)
- Campo Base URL y Model (editables para Custom/Local)
- Botón "Test Connection"
- Nota sobre privacidad de proveedores locales

---

## 6. Comunicación IPC (main ↔ renderer)

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
}
```

---

## 7. Fuera de alcance (v1)

- Notificaciones push / alertas por email de renovaciones
- Multi-proyecto (v1 gestiona un proyecto a la vez)
- Integración con APIs de facturación de servicios
- Detección de vulnerabilidades en dependencias
- Soporte para monorepos

---

## 8. Criterios de aceptación (v0.2)

- [x] Sin ninguna configuración, StackWatch detecta servicios por semántica — cero listas hardcodeadas
- [x] Variables como TWITTER_API_KEY o GA_MEASUREMENT_ID generan entradas con confianza high/medium aunque el servicio no esté en ninguna lista
- [x] El usuario puede añadir servicios manualmente desde la UI — se persisten en stackwatch.config.json
- [x] La configuración de IA acepta cualquier proveedor OpenAI-compatible incluyendo Ollama y LM Studio sin API key
- [x] Si la IA falla, la app muestra el resultado heurístico sin errores
- [x] El grafo de flujo muestra indicadores de confianza (bordes discontinuos para low confidence)
- [x] 19 tests passing para heurística y deduplicación
