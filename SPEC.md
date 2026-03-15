# SPEC.md — StackWatch

> Documento de especificación técnica. Fuente de verdad para agentes de IA y desarrolladores.
> Última actualización: 2026-03-15 | Estado: borrador v0.1

---

## 1. Visión del producto

**StackWatch** es una aplicación de escritorio (Electron) que permite a desarrolladores visualizar, documentar y monitorizar todos los servicios, dependencias y cuentas externas que componen un proyecto web, infiriéndolos automáticamente desde el repositorio y permitiendo enriquecer esa información manualmente.

### Problema que resuelve
Los proyectos modernos dependen de decenas de servicios externos (hosting, dominio, CI/CD, analytics, pagos, APIs...) distribuidos en múltiples cuentas y proveedores. No existe una vista unificada de todo ese ecosistema.

### Propuesta de valor
- **Inferencia automática**: detecta servicios leyendo `package.json`, `.env.example`, `docker-compose.yml`, workflows de CI y otros ficheros del repo.
- **Enriquecimiento manual**: el usuario añade lo que no se puede inferir (contraseñas, cuentas de pago, fechas de renovación, servicios sin rastro en el código).
- **Vista unificada**: dashboard con tres paneles — servicios, dependencias y grafo de flujo de la aplicación.
- **Portable y offline**: toda la información vive en el propio repo como ficheros de texto versionables.

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

### Estructura de carpetas del proyecto

```
stackwatch/
├── electron/
│   ├── main.ts          # Proceso principal, IPC handlers
│   ├── preload.ts       # Bridge seguro al renderer
│   └── analyzers/       # Módulos de análisis (uno por tipo de fichero)
│       ├── packageJson.ts
│       ├── envFile.ts
│       ├── dockerCompose.ts
│       └── githubWorkflows.ts
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   ├── ServicesPanel/
│   │   ├── DepsPanel/
│   │   └── FlowGraph/
│   ├── store/           # Estado global (Zustand)
│   └── main.tsx
├── stackwatch.config.json   # Config manual del usuario (versionable)
└── CONTEXT.md                  # Contexto vivo para agentes (ver sección 6)
```

---

## 3. Funcionalidades

### 3.1 Análisis automático del repositorio

El motor de análisis corre en el proceso principal de Electron y parsea los siguientes ficheros:

| Fichero | Qué extrae |
|---|---|
| `package.json` | Dependencias npm (prod + dev), scripts |
| `.env` / `.env.example` | Variables de entorno → detecta servicios por nombre de variable |
| `docker-compose.yml` | Servicios, puertos, imágenes |
| `.github/workflows/*.yml` | CI/CD, servicios de terceros usados |
| `vercel.json` / `netlify.toml` | Plataforma de despliegue |
| `next.config.js` / `vite.config.ts` | Framework, plugins, redirects |

**Detección de servicios por patrón de variable de entorno:**

```
STRIPE_*          → Stripe (pagos)
SENDGRID_*        → SendGrid (email)
TWILIO_*          → Twilio (SMS)
DATABASE_URL      → Base de datos (detecta tipo por prefijo: postgres://, mysql://, mongodb://)
NEXT_PUBLIC_GA_*  → Google Analytics
SENTRY_*          → Sentry (monitoring)
AWS_*             → Amazon Web Services
VERCEL_*          → Vercel
GITHUB_TOKEN      → GitHub API
```

### 3.2 Configuración manual (`stackwatch.config.json`)

Fichero JSON versionable en la raíz del repo donde el usuario declara servicios que no se pueden inferir:

```json
{
  "version": "1",
  "project": {
    "name": "Mi proyecto web",
    "description": "Descripción breve"
  },
  "services": [
    {
      "id": "namecheap-domain",
      "name": "Namecheap",
      "category": "domain",
      "plan": "paid",
      "cost": { "amount": 12, "currency": "USD", "period": "yearly" },
      "renewalDate": "2026-09-01",
      "accountEmail": "admin@example.com",
      "notes": "Dominio principal miproyecto.com",
      "url": "https://namecheap.com"
    }
  ],
  "accounts": [
    {
      "id": "outlook-transactional",
      "provider": "Microsoft Outlook",
      "purpose": "Email transaccional",
      "accountEmail": "noreply@miproyecto.com"
    }
  ]
}
```

### 3.3 Dashboard — tres paneles

**Panel: Servicios**
- Tarjetas por servicio: nombre, categoría, plan (free/paid), coste, fecha de renovación
- Filtros: por categoría (infra, dev, marketing, pagos, analytics), por tipo (free/paid)
- Alertas visuales: servicios con renovación en menos de 30 días
- Origen del dato: badge "inferido" vs "manual"

**Panel: Dependencias**
- Lista de dependencias npm/pip/cargo con versión
- Indicador de tipo: producción / desarrollo / peer
- Enlace directo a npm/PyPI
- Búsqueda por nombre

**Panel: Grafo de flujo**
- Nodos: usuario, CDN, frontend, API, base de datos, servicios externos
- Aristas: flujo de datos, flujo de autenticación, flujo de pagos (distinguidos por color)
- Nodos arrastrables, layout auto con dagre
- Exportable como PNG / SVG

### 3.4 Fuentes de datos

El usuario puede elegir al abrir la app:

1. **Repo local** — selecciona carpeta, análisis instantáneo vía `fs`
2. **Repo GitHub** — introduce `owner/repo` + token personal, la app clona en memoria vía Octokit

---

## 4. Modelo de datos

### Servicio inferido o manual

```typescript
interface Service {
  id: string
  name: string
  category: 'domain' | 'hosting' | 'cicd' | 'database' | 'auth' | 'payments'
           | 'email' | 'analytics' | 'monitoring' | 'cdn' | 'storage' | 'other'
  plan: 'free' | 'paid' | 'trial' | 'unknown'
  source: 'inferred' | 'manual'          // origen del dato
  inferredFrom?: string                   // ej: ".env.example → STRIPE_KEY"
  cost?: { amount: number; currency: string; period: 'monthly' | 'yearly' }
  renewalDate?: string                    // ISO 8601
  accountEmail?: string
  notes?: string
  url?: string
}
```

### Dependencia

```typescript
interface Dependency {
  name: string
  version: string
  type: 'production' | 'development' | 'peer'
  ecosystem: 'npm' | 'pip' | 'cargo' | 'composer'
  relatedService?: string                 // ej: "stripe" → Service.id "stripe"
}
```

### Nodo del grafo

```typescript
interface FlowNode {
  id: string
  label: string
  type: 'user' | 'cdn' | 'frontend' | 'api' | 'database' | 'external'
  serviceId?: string                      // referencia a Service
}

interface FlowEdge {
  source: string
  target: string
  label?: string
  flowType: 'data' | 'auth' | 'payment' | 'webhook'
}
```

---

## 5. Comunicación IPC (main ↔ renderer)

```typescript
// Canales expuestos via contextBridge
interface ProjectRadarAPI {
  analyzeLocal(folderPath: string): Promise<AnalysisResult>
  analyzeGitHub(repo: string, token: string): Promise<AnalysisResult>
  saveConfig(config: UserConfig): Promise<void>
  loadConfig(): Promise<UserConfig>
  openFolder(): Promise<string | null>   // diálogo nativo de selección
}
```

---

## 6. Fuera de alcance (v1)

- Notificaciones push / alertas por email de renovaciones
- Multi-proyecto (v1 gestiona un proyecto a la vez)
- Integración con APIs de facturación de servicios (Stripe dashboard, AWS Cost Explorer)
- Detección de vulnerabilidades en dependencias (posible v2 vía `npm audit`)
- Soporte para monorepos

---

## 7. Criterios de aceptación (v1)

- [ ] Dado un repo con `package.json` y `.env.example`, la app detecta al menos el 80% de servicios externos presentes
- [ ] El usuario puede añadir/editar servicios manualmente en menos de 30 segundos
- [ ] El grafo de flujo se genera automáticamente a partir del análisis sin configuración manual
- [ ] Los cambios en `stackwatch.config.json` se reflejan en el dashboard sin reiniciar la app
- [ ] La app funciona en macOS, Windows y Linux
