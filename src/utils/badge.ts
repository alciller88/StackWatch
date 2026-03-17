/** Generate a Stack Score badge as SVG string */
export function generateScoreBadgeSvg(score: number, serviceCount: number): string {
  const color = score >= 80 ? '#3d8c5e' : score >= 50 ? '#e2b04a' : '#c05050'
  const labelWidth = 82
  const scoreText = `${score}/100`
  const valueWidth = 54
  const totalWidth = labelWidth + valueWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="a" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <rect rx="3" width="${totalWidth}" height="20" fill="#555"/>
  <rect rx="3" x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
  <rect rx="3" width="${totalWidth}" height="20" fill="url(#a)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">Stack Score</text>
    <text x="${labelWidth / 2}" y="14">Stack Score</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${scoreText}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${scoreText}</text>
  </g>
</svg>`
}

/** Generate shields.io URL for Stack Score badge */
export function getScoreBadgeUrl(score: number): string {
  const color = score >= 80 ? 'brightgreen' : score >= 50 ? 'yellow' : 'red'
  return `https://img.shields.io/badge/Stack_Score-${score}%2F100-${color}`
}

/** Generate full badge markdown with score */
export function getScoreBadgeMarkdown(score: number, serviceCount: number): string {
  const color = score >= 80 ? 'brightgreen' : score >= 50 ? 'yellow' : 'red'
  return `![Stack Score: ${score}/100](https://img.shields.io/badge/Stack_Score-${score}%2F100-${color}) ![Services: ${serviceCount}](https://img.shields.io/badge/StackWatch-${serviceCount}%20services-gold)`
}

/** Generate full badge HTML with score */
export function getScoreBadgeHtml(score: number, serviceCount: number): string {
  const color = score >= 80 ? 'brightgreen' : score >= 50 ? 'yellow' : 'red'
  return `<a href="https://github.com/alciller88/StackWatch"><img src="https://img.shields.io/badge/Stack_Score-${score}%2F100-${color}" alt="Stack Score: ${score}/100" /></a> <a href="https://github.com/alciller88/StackWatch"><img src="https://img.shields.io/badge/StackWatch-${serviceCount}%20services-gold" alt="Analyzed with StackWatch" /></a>`
}

// --- Vulnerabilities badge ---

/** Generate shields.io URL for vulnerabilities badge */
export function getVulnBadgeUrl(vulnCount: number): string {
  const color = vulnCount === 0 ? '3d8c5e' : 'c05050'
  return `https://img.shields.io/badge/Vulnerabilities-${vulnCount}_found-${color}`
}

/** Generate vulnerabilities badge as Markdown */
export function getVulnBadgeMarkdown(vulnCount: number): string {
  const url = getVulnBadgeUrl(vulnCount)
  return `![Vulnerabilities: ${vulnCount} found](${url})`
}

/** Generate vulnerabilities badge as HTML */
export function getVulnBadgeHtml(vulnCount: number): string {
  const url = getVulnBadgeUrl(vulnCount)
  return `<a href="https://github.com/alciller88/StackWatch"><img src="${url}" alt="Vulnerabilities: ${vulnCount} found" /></a>`
}

// --- Dependencies badge ---

/** Generate shields.io URL for dependencies badge */
export function getDepsBadgeUrl(depCount: number): string {
  return `https://img.shields.io/badge/Dependencies-${depCount}_tracked-4a8ab0`
}

/** Generate dependencies badge as Markdown */
export function getDepsBadgeMarkdown(depCount: number): string {
  const url = getDepsBadgeUrl(depCount)
  return `![Dependencies: ${depCount} tracked](${url})`
}

/** Generate dependencies badge as HTML */
export function getDepsBadgeHtml(depCount: number): string {
  const url = getDepsBadgeUrl(depCount)
  return `<a href="https://github.com/alciller88/StackWatch"><img src="${url}" alt="Dependencies: ${depCount} tracked" /></a>`
}

// --- Last scanned badge ---

/** Generate shields.io URL for last scanned badge */
export function getScannedBadgeUrl(date: string): string {
  // Shields.io interprets hyphens as separators; escape with double dash
  const escaped = date.replace(/-/g, '--')
  return `https://img.shields.io/badge/Scanned-${escaped}-8090a6`
}

/** Generate last scanned badge as Markdown */
export function getScannedBadgeMarkdown(date: string): string {
  const url = getScannedBadgeUrl(date)
  return `![Scanned: ${date}](${url})`
}

/** Generate last scanned badge as HTML */
export function getScannedBadgeHtml(date: string): string {
  const url = getScannedBadgeUrl(date)
  return `<a href="https://github.com/alciller88/StackWatch"><img src="${url}" alt="Scanned: ${date}" /></a>`
}
