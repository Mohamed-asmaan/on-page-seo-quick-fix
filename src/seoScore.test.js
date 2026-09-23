import { calculateSeoScore, isValidWebPage, SCORE_WEIGHTS } from './seoScore.js'

function page(overrides = {}) {
  const base = {
    url: 'https://example.com/',
    security: 'HTTPS',
    title: { text: 'A solid page title for search results', length: 38 },
    metaDescription: { text: 'A'.repeat(140), length: 140 },
    metaKeywords: { text: 'seo, checker', present: true },
    metaLanguage: 'en',
    viewport: { present: true },
    wordCount: 420,
    headings: {
      ordered: [
        { text: 'Main heading', level: 1 },
        { text: 'Section', level: 2 }
      ],
      h1: [{ text: 'Main heading' }],
      h2: [{ text: 'Section' }],
      h3: [],
      h4: [],
      h5: [],
      h6: []
    },
    images: { total: 2, missingAlt: 0, oversized: 0 },
    links: { internal: 4, external: 1, emptyHref: 0, total: 5 },
    canonical: { present: true, url: 'https://example.com/' },
    robots: { present: true, index: true, content: 'index, follow' },
    openGraph: { title: 'Title', description: 'Description', image: 'https://example.com/og.png' },
    twitter: { card: 'summary_large_image', title: 'Title', description: 'Description' },
    jsonLd: { count: 1, scripts: [{ type: 'WebPage', valid: true }] },
    resources: { blockingScripts: 0 }
  }

  const merged = { ...base, ...overrides }
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && base[key]) {
      merged[key] = { ...base[key], ...overrides[key] }
    }
  }
  return merged
}

describe('isValidWebPage', () => {
  test('accepts a normal https page', () => {
    expect(isValidWebPage('https://example.com/pricing')).toBe(true)
  })

  test('rejects empty and restricted browser pages', () => {
    expect(isValidWebPage('')).toBe(false)
    expect(isValidWebPage(null)).toBe(false)
    expect(isValidWebPage('chrome://extensions')).toBe(false)
    expect(isValidWebPage('chrome-extension://abc/popup.html')).toBe(false)
    expect(isValidWebPage('about:blank')).toBe(false)
    expect(isValidWebPage('edge://settings')).toBe(false)
    expect(isValidWebPage('moz-extension://abc/page.html')).toBe(false)
    expect(isValidWebPage('https://chromewebstore.google.com/detail/example')).toBe(false)
    expect(isValidWebPage('https://chrome.google.com/webstore/detail/example')).toBe(false)
  })
})

describe('calculateSeoScore', () => {
  test('returns an empty result when there is no page data', () => {
    expect(calculateSeoScore(null)).toEqual({
      score: 0,
      critical: 0,
      warnings: 0,
      hints: 0,
      issues: [],
      breakdown: []
    })
  })

  test('scores a complete page at 100', () => {
    const result = calculateSeoScore(page())

    expect(result.score).toBe(100)
    expect(result.critical).toBe(0)
    expect(result.warnings).toBe(0)
    expect(result.hints).toBe(0)
    expect(result.totalDeducted).toBe(0)
    expect(result.breakdown[0]).toMatchObject({ factor: 'Base Score', deduction: 0 })
  })

  test('deducts the title weight and marks a missing title as critical', () => {
    const result = calculateSeoScore(page({
      title: { text: '', length: 0 }
    }))

    expect(result.score).toBe(100 - SCORE_WEIGHTS.titleMissing)
    expect(result.critical).toBe(1)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'critical', category: 'pageBasics', text: 'Missing page title' })
    ]))
  })

  test('warns when the title or meta description is outside the recommended length', () => {
    const result = calculateSeoScore(page({
      title: { text: 'Too short', length: 9 },
      metaDescription: { text: 'x'.repeat(180), length: 180 }
    }))

    expect(result.score).toBe(100 - SCORE_WEIGHTS.titleTooShort - SCORE_WEIGHTS.metaDescTooLong)
    expect(result.warnings).toBe(2)
    expect(result.issues.map(issue => issue.text)).toEqual(expect.arrayContaining([
      expect.stringContaining('Title is too short'),
      expect.stringContaining('Meta description is too long')
    ]))
  })

  test('caps missing alt-text deductions at 10 images', () => {
    const result = calculateSeoScore(page({
      images: { total: 20, missingAlt: 15, oversized: 0 }
    }))
    const altIssue = result.breakdown.find(item => item.factor === 'Missing Alt Text')

    expect(altIssue.deduction).toBe(SCORE_WEIGHTS.imageAltMissing * 10)
    expect(result.score).toBe(100 - SCORE_WEIGHTS.imageAltMissing * 10)
  })

  test('treats noindex as a critical deduction', () => {
    const result = calculateSeoScore(page({
      robots: { present: true, index: false, content: 'noindex, nofollow' }
    }))

    expect(result.score).toBe(100 - SCORE_WEIGHTS.noindex)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'critical', text: 'Page set to noindex' })
    ]))
  })

  test('records a missing language as a hint that still costs points', () => {
    const result = calculateSeoScore(page({ metaLanguage: 'Not set' }))

    expect(result.hints).toBe(1)
    expect(result.score).toBe(100 - SCORE_WEIGHTS.missingLanguage)
  })

  test('does not lower the score for a missing keywords hint', () => {
    const result = calculateSeoScore(page({
      metaKeywords: { text: '', present: false }
    }))

    expect(result.hints).toBe(1)
    expect(result.score).toBe(100)
  })

  test('never returns a score below 0', () => {
    const result = calculateSeoScore(page({
      security: 'HTTP',
      title: { text: '', length: 0 },
      metaDescription: { text: '', length: 0 },
      metaLanguage: 'Not set',
      viewport: { present: false },
      wordCount: 40,
      headings: { ordered: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
      images: { total: 20, missingAlt: 20, oversized: 3 },
      links: { internal: 0, external: 12, emptyHref: 4, total: 12 },
      canonical: { present: false, url: '' },
      robots: { present: true, index: false, content: 'noindex' },
      openGraph: { title: '', description: '', image: '' },
      twitter: { card: '', title: '', description: '' },
      jsonLd: { count: 0, scripts: [] },
      resources: { blockingScripts: 3 }
    }))

    expect(result.score).toBe(0)
    expect(result.totalDeducted).toBeGreaterThan(100)
    expect(result.critical).toBeGreaterThan(0)
  })
})
