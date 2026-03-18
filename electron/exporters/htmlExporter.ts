import type { HtmlExportData, Service } from '../../shared/types'

export type { HtmlExportData }

const CATEGORY_LABELS: Record<string, string> = {
  hosting: 'Hosting', database: 'Database', auth: 'Auth', payments: 'Payments',
  email: 'Email', analytics: 'Analytics', monitoring: 'Monitoring', cdn: 'CDN',
  storage: 'Storage', cicd: 'CI/CD', infra: 'Infrastructure', ai: 'AI',
  messaging: 'Messaging', domain: 'Domain', mobile: 'Mobile', gaming: 'Gaming',
  data: 'Data', support: 'Support', other: 'Other',
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function scoreColor(score: number): string {
  if (score >= 80) return '#3d8c5e'
  if (score >= 50) return '#e2b04a'
  return '#c94a4a'
}

function confidenceColor(conf: string | undefined): string {
  if (conf === 'high') return '#3d8c5e'
  if (conf === 'medium') return '#e2b04a'
  return '#c97a3a'
}

function planBadge(plan: string): string {
  const colors: Record<string, string> = {
    free: '#3d8c5e',
    paid: '#e2b04a',
    trial: '#7a8ba6',
    unknown: '#555',
  }
  const bg = colors[plan] ?? '#555'
  return `<span class="badge" style="background:${bg}">${esc(plan)}</span>`
}

function zombieBadge(status: string | undefined): string {
  if (!status || status === 'active') return ''
  const color = status === 'zombie' ? '#c94a4a' : '#c97a3a'
  return ` <span class="badge" style="background:${color}">${esc(status)}</span>`
}

function progressBar(label: string, pct: number): string {
  const color = scoreColor(pct)
  return `<div class="progress-row">
    <span class="progress-label">${esc(label)}</span>
    <div class="progress-track">
      <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <span class="progress-value">${pct}%</span>
  </div>`
}

function getMonthlyCost(s: Service): number {
  if (!s.billing || !s.billing.amount || s.billing.amount <= 0) return 0
  return s.billing.period === 'yearly' ? s.billing.amount / 12 : s.billing.amount
}

function formatCurrency(amount: number, currency?: string): string {
  const sym = currency === 'EUR' ? 'EUR ' : '$'
  return `${sym}${amount.toFixed(2)}`
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k) ?? []
    list.push(item)
    map.set(k, list)
  }
  return map
}

export function generateHtmlReport(data: HtmlExportData): string {
  const {
    projectName, services, dependencies, flowNodes, flowEdges,
    score, passingChecks, totalChecks, checks, generatedAt, budget,
  } = data

  const date = generatedAt.split('T')[0]
  const totalMonthly = services.reduce((sum, s) => sum + getMonthlyCost(s), 0)
  const totalYearly = totalMonthly * 12
  const paidCount = services.filter(s => s.plan === 'paid').length

  // --- Services section ---
  const servicesByCategory = groupBy(services, s => s.category)
  let servicesHtml = ''
  for (const [cat, list] of servicesByCategory) {
    const label = CATEGORY_LABELS[cat] ?? cat
    let rows = ''
    for (const s of list) {
      const cost = s.billing && s.billing.amount && s.billing.amount > 0
        ? esc(formatCurrency(getMonthlyCost(s), s.billing.currency)) + '/mo'
        : '--'
      const confColor = confidenceColor(s.confidence)
      rows += `<tr>
        <td>${esc(s.name)}${zombieBadge(s.zombieStatus)}</td>
        <td>${planBadge(s.plan)}</td>
        <td><span class="conf-dot" style="background:${confColor}"></span> ${esc(s.confidence ?? 'medium')}</td>
        <td>${cost}</td>
        <td>${esc(s.owner ?? '--')}</td>
      </tr>`
    }
    servicesHtml += `<details open>
      <summary>${esc(label)} <span class="count">(${list.length})</span></summary>
      <table>
        <thead><tr><th>Service</th><th>Plan</th><th>Confidence</th><th>Cost</th><th>Owner</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`
  }

  // --- Costs section ---
  const costByCategory = groupBy(
    services.filter(s => getMonthlyCost(s) > 0),
    s => s.category,
  )
  let costRows = ''
  for (const [cat, list] of costByCategory) {
    const label = CATEGORY_LABELS[cat] ?? cat
    const catTotal = list.reduce((sum, s) => sum + getMonthlyCost(s), 0)
    costRows += `<tr><td>${esc(label)}</td><td>${list.length}</td><td>${formatCurrency(catTotal)}</td></tr>`
  }

  let budgetHtml = ''
  if (budget && budget.monthly > 0) {
    const pct = Math.min(100, Math.round((totalMonthly / budget.monthly) * 100))
    const color = pct >= 100 ? '#c94a4a' : pct >= 80 ? '#e2b04a' : '#3d8c5e'
    budgetHtml = `<div class="budget">
      <h3>Budget</h3>
      <div class="progress-row">
        <span class="progress-label">${formatCurrency(totalMonthly)} / ${formatCurrency(budget.monthly, budget.currency)}</span>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="progress-value">${pct}%</span>
      </div>
    </div>`
  }

  // --- Dependencies section ---
  const depsByEcosystem = groupBy(dependencies, d => d.ecosystem)
  let depsHtml = ''
  for (const [eco, list] of depsByEcosystem) {
    let rows = ''
    for (const d of list) {
      rows += `<tr><td>${esc(d.name)}</td><td>${esc(d.version)}</td><td>${esc(d.type)}</td></tr>`
    }
    depsHtml += `<details>
      <summary>${esc(eco)} <span class="count">(${list.length})</span></summary>
      <table>
        <thead><tr><th>Name</th><th>Version</th><th>Type</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`
  }

  // --- Graph section ---
  let graphHtml = ''
  if (flowEdges.length > 0) {
    let connectionRows = ''
    for (const edge of flowEdges) {
      const srcNode = flowNodes.find(n => n.id === edge.source)
      const tgtNode = flowNodes.find(n => n.id === edge.target)
      const srcLabel = srcNode ? srcNode.label : edge.source
      const tgtLabel = tgtNode ? tgtNode.label : edge.target
      connectionRows += `<tr>
        <td>${esc(srcLabel)}</td>
        <td class="arrow-cell">&rarr;</td>
        <td>${esc(tgtLabel)}</td>
        <td><span class="flow-type">${esc(edge.flowType)}</span>${edge.label ? ' ' + esc(edge.label) : ''}</td>
      </tr>`
    }
    graphHtml = `<table>
      <thead><tr><th>Source</th><th></th><th>Target</th><th>Flow Type</th></tr></thead>
      <tbody>${connectionRows}</tbody>
    </table>`
  } else if (flowNodes.length > 0) {
    graphHtml = `<p class="muted">No connections mapped yet. ${flowNodes.length} node(s) detected.</p>`
  } else {
    graphHtml = `<p class="muted">No graph data available.</p>`
  }

  // --- Full HTML ---
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>StackWatch Report -- ${esc(projectName)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0c0f;color:#c8ccd4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;line-height:1.6;padding:2rem;max-width:960px;margin:0 auto}
a{color:#e2b04a;text-decoration:none}
a:hover{text-decoration:underline}

header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;padding-bottom:1.5rem;border-bottom:1px solid #1e2230;margin-bottom:2rem}
header h1{font-size:1.4rem;font-weight:600;color:#e8e8e8}
header .meta{font-size:0.75rem;color:#7a8ba6;text-align:right}
.score-badge{display:inline-flex;align-items:center;gap:0.5rem;padding:0.25rem 0.75rem;border:1px solid #1e2230;border-radius:3px;font-size:0.8rem;color:#c8ccd4}
.score-badge .score-num{font-size:1.1rem;font-weight:700}

section{margin-bottom:2.5rem}
section>h2{font-size:1rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#7a8ba6;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid #1e2230}

.big-score{text-align:center;margin:1rem 0 1.5rem}
.big-score .number{font-size:3.5rem;font-weight:700;line-height:1}
.big-score .out-of{font-size:1rem;color:#7a8ba6}

.progress-row{display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem}
.progress-label{width:120px;font-size:0.8rem;color:#c8ccd4;flex-shrink:0}
.progress-track{flex:1;height:8px;background:#1a1d26;border-radius:4px;overflow:hidden}
.progress-fill{height:100%;border-radius:4px;transition:width 0.3s}
.progress-value{width:40px;text-align:right;font-size:0.8rem;color:#7a8ba6;flex-shrink:0}

details{margin-bottom:0.75rem;border:1px solid #1e2230;border-radius:3px;background:#0d1017}
details>summary{cursor:pointer;padding:0.6rem 0.75rem;font-size:0.85rem;font-weight:600;color:#e8e8e8;list-style:none;display:flex;align-items:center;gap:0.5rem}
details>summary::-webkit-details-marker{display:none}
details>summary::before{content:'>';display:inline-block;width:1em;font-size:0.7rem;color:#7a8ba6;transition:transform 0.15s}
details[open]>summary::before{transform:rotate(90deg)}
details .count{font-weight:400;color:#7a8ba6;font-size:0.8rem}

table{width:100%;border-collapse:collapse;font-size:0.8rem}
thead th{text-align:left;padding:0.4rem 0.75rem;color:#7a8ba6;font-weight:500;border-bottom:1px solid #1e2230;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em}
tbody td{padding:0.4rem 0.75rem;border-bottom:1px solid #13161d}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:#111420}
.arrow-cell{color:#7a8ba6;text-align:center;width:2rem}

.badge{display:inline-block;padding:0.1rem 0.5rem;border-radius:2px;font-size:0.7rem;color:#0a0c0f;font-weight:600;text-transform:uppercase;letter-spacing:0.03em}
.conf-dot{display:inline-block;width:6px;height:6px;border-radius:50%;vertical-align:middle;margin-right:2px}
.flow-type{display:inline-block;padding:0.05rem 0.4rem;background:#1a1d26;border-radius:2px;font-size:0.7rem;color:#7a8ba6}

.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem}
.summary-card{background:#0d1017;border:1px solid #1e2230;border-radius:3px;padding:1rem;text-align:center}
.summary-card .label{font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:#7a8ba6;margin-bottom:0.25rem}
.summary-card .value{font-size:1.5rem;font-weight:700;color:#e8e8e8}

.budget{margin-top:1rem}
.budget h3{font-size:0.8rem;color:#7a8ba6;margin-bottom:0.5rem}

.muted{color:#7a8ba6;font-size:0.85rem;font-style:italic}

footer{margin-top:3rem;padding-top:1rem;border-top:1px solid #1e2230;font-size:0.7rem;color:#555;text-align:center}

@media print{
  body{background:#fff;color:#222;padding:1rem}
  header{border-bottom-color:#ddd}
  section>h2{color:#555;border-bottom-color:#ddd}
  details{border-color:#ddd;background:#f8f8f8}
  details>summary{color:#222}
  details>summary::before{color:#999}
  .progress-track{background:#e8e8e8}
  table{font-size:0.75rem}
  thead th{color:#555;border-bottom-color:#ddd}
  tbody td{border-bottom-color:#eee}
  tbody tr:hover{background:transparent}
  .summary-card{background:#f8f8f8;border-color:#ddd}
  .summary-card .value{color:#222}
  .big-score .out-of{color:#555}
  footer{color:#999;border-top-color:#ddd}
  .flow-type{background:#e8e8e8;color:#555}
}

@media(max-width:640px){
  body{padding:1rem}
  header{flex-direction:column;align-items:flex-start}
  header .meta{text-align:left}
  .progress-label{width:80px;font-size:0.7rem}
  .summary-grid{grid-template-columns:1fr 1fr}
}
</style>
</head>
<body>
<header>
  <div>
    <h1>${esc(projectName)}</h1>
    <div class="score-badge">Stack Score: <span class="score-num" style="color:${scoreColor(score)}">${score}</span>/100</div>
  </div>
  <div class="meta">Generated ${esc(date)}<br>by StackWatch</div>
</header>

<main>
<section id="score">
  <h2>Stack Score</h2>
  <div class="big-score">
    <div class="number" style="color:${scoreColor(score)}">${score}</div>
    <div class="out-of">out of 100</div>
  </div>
  <div class="progress-row">
    <span class="progress-label">${passingChecks}/${totalChecks} checks passing</span>
    <div class="progress-track">
      <div class="progress-fill" style="width:${totalChecks > 0 ? Math.round((passingChecks / totalChecks) * 100) : 0}%;background:${scoreColor(score)}"></div>
    </div>
    <span class="progress-value">${totalChecks > 0 ? Math.round((passingChecks / totalChecks) * 100) : 0}%</span>
  </div>
  ${checks.map(c => `<div class="progress-row">
    <span class="progress-label">${c.status === 'pass' ? '&#10003;' : c.status === 'fail' ? '&#10007;' : '--'} ${esc(c.label)}</span>
  </div>`).join('\n  ')}
</section>

<section id="services">
  <h2>Services (${services.length})</h2>
  ${servicesHtml || '<p class="muted">No services detected.</p>'}
</section>

<section id="costs">
  <h2>Costs</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Monthly</div>
      <div class="value">${formatCurrency(totalMonthly)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Yearly</div>
      <div class="value">${formatCurrency(totalYearly)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Paid Services</div>
      <div class="value">${paidCount}</div>
    </div>
  </div>
  ${costRows ? `<table>
    <thead><tr><th>Category</th><th>Count</th><th>Monthly Total</th></tr></thead>
    <tbody>${costRows}</tbody>
  </table>` : '<p class="muted">No cost data available.</p>'}
  ${budgetHtml}
</section>

<section id="dependencies">
  <h2>Dependencies (${dependencies.length})</h2>
  ${depsHtml || '<p class="muted">No dependencies detected.</p>'}
</section>

<section id="graph">
  <h2>Service Graph</h2>
  ${graphHtml}
</section>
</main>

<footer>
  Generated by StackWatch -- ${esc(date)}
</footer>
</body>
</html>`
}
