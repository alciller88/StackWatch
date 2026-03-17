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
