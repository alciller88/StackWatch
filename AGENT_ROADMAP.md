# StackWatch — Roadmap de implementacion (generado por reunion de 5 agentes)

Fecha: 2026-03-18 | Version analizada: v0.6.0 | 372 tests pasando

---

## FASE 1: BUGS CRITICOS Y DEUDA TECNICA (Prioridad inmediata)

### 1.1 Fix: Race condition en persistToConfig
**Archivo:** `src/store/graphStore.ts` (linea ~543-593)
**Problema:** El debounce de 500ms hace load -> merge -> save. Si dos operaciones rapidas entran al timer, el primer save se pierde porque el segundo loadConfig lee datos sin el primer save.
**Solucion:** Implementar una cola de escritura serializada o mutex. Nunca hacer load-then-save con debounce sin lock.

### 1.2 Fix: GitHub scan no persiste snapshot ni score
**Archivos:** `electron/main.ts` (lineas 355-378), `src/store/useStore.ts` (lineas 335-446)
**Problema:** `analyze-github` del IPC no llama a `saveScanSnapshot` ni `appendScoreEntry` como si lo hace `analyze-local`.
**Solucion:** Igualar la logica post-scan de GitHub con local.

### 1.3 Fix: Toast animation sin keyframes
**Archivos:** `src/components/Toast.tsx`, `src/index.css`
**Problema:** Clase `animate-in` usada pero `@keyframes animate-in` no existe.
**Solucion:** Definir `@keyframes slideIn` o `fadeIn` en index.css.

### 1.4 Refactor: Tipar `store` en main.ts
**Archivo:** `electron/main.ts` (linea 15)
**Problema:** `let store: any` pierde seguridad de tipos.
**Solucion:** Reemplazar con el tipo correcto de electron-store.

### 1.5 Refactor: Eliminar dependencia circular graphStore <-> useStore
**Archivo:** `src/store/graphStore.ts` (linea 46)
**Problema:** `require('./useStore')` dinamico es fragil.
**Solucion:** Event bus, store unificado, o parametro inyectado.

### 1.6 Refactor: Extraer logica comun analyzeLocal/analyzeGitHub
**Archivo:** `src/store/useStore.ts`
**Problema:** `analyzeLocal` (lineas 188-333) y `analyzeGitHub` (lineas 335-446) comparten mucha logica duplicada.
**Solucion:** Extraer `processAnalysisResult()` comun.

### 1.7 Fix: setTimeout de scan diff sin cleanup
**Archivo:** `src/store/useStore.ts` (linea ~298)
**Problema:** setTimeout de 3s para limpiar diff no se cancela si hay re-scan antes.
**Solucion:** Guardar el timer ID y hacer clearTimeout en cleanup.

---

## FASE 2: UI/UX FIXES (Calidad visual y accesibilidad)

### 2.1 Accesibilidad: aria-labels en inputs de busqueda
**Archivos:** `ServicesPanel.tsx`, `DepsPanel.tsx`, `DiscardedPanel.tsx`
**Accion:** Agregar `aria-label="Buscar servicios/dependencias/descartados"` a cada input.

### 2.2 Extraer colores hardcodeados a CSS variables
**Archivos:** Todos los componentes de panels/cards + `src/themes.ts`
**Colores a extraer:**
- `#c05050` -> `--color-danger`
- `#3d8c5e` -> `--color-success`
- `#2a1e0a`, `#6b3d0a` -> `--color-badge-bg-warning`
- `#1a3a1a`, `#2a5a2a` -> `--color-badge-bg-success`
- `#1a1520`, `#4a2040` -> `--color-badge-bg-danger`
**Crear variantes para dark y light en ambos temas.**

### 2.3 Unificar headers de paneles
**Archivos:** `DiscardedPanel.tsx` (h2 text-[11px]), `CostsPanel.tsx` (h1 text-xs)
**Accion:** Estandarizar todos a `h2` con `text-sm font-medium text-[var(--color-text-primary)]`.

### 2.4 Agregar icono de busqueda al DiscardedPanel
**Archivo:** `DiscardedPanel.tsx`
**Accion:** Agregar icono de lupa como en ServicesPanel y DepsPanel para consistencia.

### 2.5 Normalizar estrategia de estilos
**Archivos:** `NodeEditPanel.tsx`, `FlowGraph.tsx` (empty state), `ScanProgress.tsx`
**Accion:** Migrar inline `style={{}}` a clases Tailwind. Solo usar `style` para CSS variables dinamicas.

### 2.6 Mejorar contraste WCAG
**Archivo:** `src/themes.ts`
**Accion:** Ajustar `--color-text-secondary` y `--color-text-muted` para cumplir ratio 4.5:1 en ambos temas.

### 2.7 Navegacion por flechas en menus
**Archivos:** TopBar (export/share menus), FlowGraph (context menu), ServicesPanel (filtros)
**Accion:** Implementar ArrowDown/ArrowUp, role="radiogroup" en filtros.

---

## FASE 3: FEATURES DE ALTO IMPACTO (Producto)

### 3.1 Redefinir Stack Score con metricas objetivas
**Nuevo calculo sugerido:**
- Base 100, restar puntos por:
  - Vulnerabilidades criticas abiertas: -20 pts cada una
  - Servicios con renovacion < 7 dias sin accion: -10 pts
  - Servicios zombie activos: -5 pts
  - Dependencias con CVE alta: -3 pts
- Bonus por:
  - 100% servicios con owner: +10 pts
  - 0 vulns: +10 pts
  - Costos documentados: +5 pts

### 3.2 PR Diff en GitHub Action
**Archivo:** GitHub Action + CLI
**Accion:** Comparar scan de PR branch vs base branch. Mostrar solo cambios: "+1 nuevo servicio (Stripe)", "-1 servicio removido (Mailgun)". No listar todos los servicios.

### 3.3 Pre-popular datos de servicios conocidos
**Nuevo archivo:** `shared/serviceDefaults.ts`
**Accion:** Diccionario de ~50 servicios populares con tier free/paid, pricing estimado, URL del dashboard, categoria. Cuando se detecta "Stripe", auto-rellenar "$0 (free tier) o $25+/mes".

### 3.4 License Audit Panel
**Nuevo panel** que muestre licencias de todas las dependencias.
- Detectar incompatibilidades (GPL en proyecto MIT)
- Generar archivo NOTICE/ATTRIBUTION automaticamente
- Alertar sobre licencias restrictivas

### 3.5 Busqueda global Ctrl+K
**Nuevo componente** que busque simultaneamente en servicios, dependencias y nodos del grafo.
**Atajos adicionales:** Ctrl+1 a Ctrl+5 para navegar entre paneles.

### 3.6 Notificacion OS al terminar scan
**Archivo:** `electron/main.ts`
**Accion:** Si la ventana no tiene foco cuando el scan termina, mostrar notificacion nativa del OS.

---

## FASE 4: CRECIMIENTO Y DISTRIBUCION (Marketing)

### 4.1 Landing page stackwatch.dev
- Hero section con `npx stackwatch ./my-project` + GIF
- Features grid, comparativa con alternativas
- Boton de descarga + "Zero install. One command."
- Galeria de Stack Scores de proyectos populares
- Desplegar en Vercel/Netlify

### 4.2 Publicar Action en GitHub Marketplace
- Screenshots profesionales
- Documentacion completa
- Keywords SEO

### 4.3 Badges clickeables
- El badge enlaza al reporte publico del proyecto
- Pagina `stackwatch.dev/report/usuario/proyecto`

### 4.4 VS Code Extension
- Panel lateral con Stack Score y servicios detectados
- Alertas de vulnerabilidades inline
- Hover sobre imports con info del servicio

### 4.5 Slack/Discord webhooks
- Notificacion cuando servicio vence en 7 dias
- Alerta de vuln critica detectada
- Nuevo servicio detectado en scan
- Resumen semanal del stack

---

## FASE 5: MOONSHOTS (Futuro)

### 5.1 "Ask your Stack" — Chat IA conversacional
Chatbot integrado para preguntar en lenguaje natural sobre el stack.

### 5.2 Team Stack — Vista multi-proyecto
Dashboard que agrega multiples repos: costos totales, vulns totales, servicios compartidos.

### 5.3 Dependency Heartbeat — Monitor continuo
Daemon/tray app que monitorea CVEs, cambios de mantenedor, paquetes abandonados.

### 5.4 Vendor Lock-in Score
Score de dificultad de migracion por servicio, basado en puntos de integracion y APIs propietarias.

### 5.5 Stack Intelligence Network
Red anonimizada de escaneos que alimenta inteligencia colectiva sobre stacks.

---

## TESTS PENDIENTES (para agente QA)

Componentes sin cobertura de tests que deben cubrirse:
- `cli/index.ts` (CRITICO — se distribuye via npm)
- `electron/main.ts` (IPC handlers)
- `src/components/FlowGraph/FlowGraph.tsx`
- `src/components/Settings/Settings.tsx`
- `src/components/CostsPanel/CostsPanel.tsx`
- `src/components/Dashboard/Dashboard.tsx`
- `src/components/DepsPanel/DepsPanel.tsx`
- `src/components/Sidebar/Sidebar.tsx`
- `src/components/Toast.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/GitHubModal.tsx`
- `src/components/OnboardingTutorial.tsx`
- `src/store/dialogStore.ts`
- `src/store/toastStore.ts`
