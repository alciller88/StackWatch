import { describe, it, expect } from 'vitest'
import {
  generateScoreBadgeSvg,
  getScoreBadgeUrl,
  getScoreBadgeMarkdown,
  getScoreBadgeHtml,
} from '../badge'

describe('generateScoreBadgeSvg', () => {
  it('returns a valid SVG string', () => {
    const svg = generateScoreBadgeSvg(75, 5)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('includes the score text', () => {
    const svg = generateScoreBadgeSvg(85, 10)
    expect(svg).toContain('85/100')
  })

  it('includes "Stack Score" label', () => {
    const svg = generateScoreBadgeSvg(50, 3)
    expect(svg).toContain('Stack Score')
  })

  it('uses green for scores >= 80', () => {
    const svg = generateScoreBadgeSvg(80, 5)
    expect(svg).toContain('#3d8c5e')
  })

  it('uses yellow for scores >= 50 and < 80', () => {
    const svg = generateScoreBadgeSvg(50, 5)
    expect(svg).toContain('#e2b04a')
  })

  it('uses red for scores < 50', () => {
    const svg = generateScoreBadgeSvg(49, 5)
    expect(svg).toContain('#c05050')
  })
})

describe('getScoreBadgeUrl', () => {
  it('returns a shields.io URL with score', () => {
    const url = getScoreBadgeUrl(90)
    expect(url).toBe('https://img.shields.io/badge/Stack_Score-90%2F100-brightgreen')
  })

  it('uses brightgreen for scores >= 80', () => {
    expect(getScoreBadgeUrl(80)).toContain('brightgreen')
  })

  it('uses yellow for scores >= 50 and < 80', () => {
    expect(getScoreBadgeUrl(79)).toContain('yellow')
    expect(getScoreBadgeUrl(50)).toContain('yellow')
  })

  it('uses red for scores < 50', () => {
    expect(getScoreBadgeUrl(49)).toContain('red')
    expect(getScoreBadgeUrl(0)).toContain('red')
  })
})

describe('getScoreBadgeMarkdown', () => {
  it('returns markdown image syntax with score badge', () => {
    const md = getScoreBadgeMarkdown(85, 12)
    expect(md).toContain('![Stack Score: 85/100]')
    expect(md).toContain('https://img.shields.io/badge/Stack_Score-85%2F100-brightgreen')
  })

  it('includes service count badge', () => {
    const md = getScoreBadgeMarkdown(60, 7)
    expect(md).toContain('![Services: 7]')
    expect(md).toContain('7%20services')
    expect(md).toContain('gold')
  })

  it('uses correct color for low score', () => {
    const md = getScoreBadgeMarkdown(30, 2)
    expect(md).toContain('red')
  })
})

describe('getScoreBadgeHtml', () => {
  it('returns HTML anchor tags with img elements', () => {
    const html = getScoreBadgeHtml(90, 5)
    expect(html).toContain('<a href=')
    expect(html).toContain('<img src=')
    expect(html).toContain('alt="Stack Score: 90/100"')
  })

  it('links to the StackWatch GitHub repo', () => {
    const html = getScoreBadgeHtml(70, 3)
    expect(html).toContain('https://github.com/alciller88/StackWatch')
  })

  it('includes service count badge', () => {
    const html = getScoreBadgeHtml(50, 8)
    expect(html).toContain('8%20services')
    expect(html).toContain('alt="Analyzed with StackWatch"')
  })

  it('uses correct color based on score', () => {
    expect(getScoreBadgeHtml(80, 1)).toContain('brightgreen')
    expect(getScoreBadgeHtml(65, 1)).toContain('yellow')
    expect(getScoreBadgeHtml(20, 1)).toContain('red')
  })
})
