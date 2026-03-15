# CONTEXT.md — StackWatch

> Este fichero es memoria viva para agentes de IA (Claude, Copilot, Cursor, etc.).
> Actualízalo después de cada sesión significativa de desarrollo.
> NO es documentación de usuario — es contexto operativo para el agente.

---

## Qué es este proyecto

App de escritorio Electron + React que analiza un repositorio (local o GitHub) e infiere todos los servicios externos, dependencias y cuentas que usa el proyecto. El resultado se muestra en un dashboard con tres paneles: servicios, dependencias y grafo de flujo.

El fichero de configuración manual del usuario es `stackwatch.config.json` en la raíz del repo analizado (no del repo de la app).

Spec completa: `SPEC.md`

---

## Estado actual del desarrollo

> ⚠️ Actualizar esta sección al inicio de cada sesión.

- **Fase**: scaffolding inicial — aún no hay código
- **Último hito**: definición de arquitectura y spec
- **Próximo paso**: crear proyecto Electron + React con Vite, estructura de carpetas según SPEC §2

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
electron/analyzers/              ← módulos de análisis, uno por tipo de fichero
src/store/                       ← estado global Zustand
src/components/FlowGraph/        ← panel más complejo, usa React Flow
```

---

## Patrones a seguir

### Añadir un nuevo analizador

1. Crear `electron/analyzers/miAnalizador.ts`
2. Exportar función `analyze(content: string): Partial<AnalysisResult>`
3. Importar y llamar en `electron/analyzers/index.ts`
4. Añadir tests unitarios en `electron/analyzers/__tests__/miAnalizador.test.ts`

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

- **Usuario objetivo**: desarrollador individual o equipo pequeño que gestiona un SaaS / proyecto web propio
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
