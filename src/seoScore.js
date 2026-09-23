export const SCORE_WEIGHTS = {
  titleMissing: 15,
  metaDescMissing: 15,
  h1Missing: 12,
  noindex: 20,
  titleTooLong: 5,
  titleTooShort: 3,
  metaDescTooLong: 5,
  metaDescTooShort: 3,
  multipleH1: 7,
  imageAltMissing: 2,
  ogMissing: 5,
  noSchema: 8,
  missingCanonical: 4,
  noHttps: 6,
  missingViewport: 4,
  poorHeadingStructure: 5,
  missingKeywords: 0,
  emptyHref: 1,
  highExternalLinks: 2,
  oversizedImages: 1,
  blockingScripts: 2,
  missingLanguage: 2,
  lowWordCount: 3
}

/**
 * Check if a URL is a valid webpage that can be analyzed.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidWebPage(url) {
  if (!url) return false

  const invalidProtocols = ['chrome:', 'chrome-extension:', 'about:', 'edge:', 'moz-extension:']
  if (invalidProtocols.some(protocol => url.startsWith(protocol))) {
    return false
  }

  const restrictedDomains = [
    'chromewebstore.google.com',
    'chrome.google.com/webstore',
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:'
  ]

  if (restrictedDomains.some(domain => url.includes(domain))) {
    return false
  }

  return true
}

/**
 * Turn collected page data into a score, issue list, and deduction breakdown.
 * @param {object | null} seoData
 */
export function calculateSeoScore(seoData) {
  if (!seoData) return { score: 0, critical: 0, warnings: 0, hints: 0, issues: [], breakdown: [] }

  const issues = []
  const breakdown = []
  let score = 100
  let totalDeducted = 0

  if (!seoData.title.text || !seoData.title.length) {
    issues.push({ type: 'critical', category: 'pageBasics', text: 'Missing page title' })
    const deduction = SCORE_WEIGHTS.titleMissing
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Missing Page Title', deduction, max: 100, reason: 'Page title is essential for SEO and user experience' })
  } else if (seoData.title.length > 60) {
    issues.push({ type: 'warning', category: 'pageBasics', text: 'Title is too long. Title should not exceed 60 characters.' })
    const deduction = SCORE_WEIGHTS.titleTooLong
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Title Too Long', deduction, max: 100, reason: `Title is ${seoData.title.length} characters (recommended: 30-60)` })
  } else if (seoData.title.length < 30) {
    issues.push({ type: 'warning', category: 'pageBasics', text: 'Title is too short. Title should be 30-60 characters for optimal SEO.' })
    const deduction = SCORE_WEIGHTS.titleTooShort
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Title Too Short', deduction, max: 100, reason: `Title is ${seoData.title.length} characters (optimal: 30-60, affects SEO visibility)` })
  } else {
    breakdown.push({ factor: 'Page Title', deduction: 0, max: 100, reason: `Title is optimal (${seoData.title.length} characters)` })
  }

  if (!seoData.metaDescription.text || !seoData.metaDescription.length) {
    issues.push({ type: 'critical', category: 'pageBasics', text: 'Missing meta description' })
    const deduction = SCORE_WEIGHTS.metaDescMissing
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Missing Meta Description', deduction, max: 100, reason: 'Meta description is crucial for search results and click-through rates' })
  } else if (seoData.metaDescription.length > 160) {
    issues.push({ type: 'warning', category: 'pageBasics', text: 'Meta description is too long. Description should not exceed 160 characters.' })
    const deduction = SCORE_WEIGHTS.metaDescTooLong
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Meta Description Too Long', deduction, max: 100, reason: `Description is ${seoData.metaDescription.length} characters (recommended: 120-160)` })
  } else if (seoData.metaDescription.length < 120) {
    issues.push({ type: 'warning', category: 'pageBasics', text: 'Meta description is too short. Description should be 120-160 characters for optimal SEO.' })
    const deduction = SCORE_WEIGHTS.metaDescTooShort
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Meta Description Too Short', deduction, max: 100, reason: `Description is ${seoData.metaDescription.length} characters (optimal: 120-160, affects CTR)` })
  } else {
    breakdown.push({ factor: 'Meta Description', deduction: 0, max: 100, reason: `Description is optimal (${seoData.metaDescription.length} characters)` })
  }

  if (!seoData.metaKeywords.present) {
    issues.push({ type: 'hint', category: 'pageBasics', text: 'Missing meta keywords. Google ignores meta keywords, but some other search engines and SEO tools may still use them.' })
  }

  const h1Count = seoData.headings.ordered ? seoData.headings.ordered.filter(h => h.level === 1).length : seoData.headings.h1.length
  const h2Count = seoData.headings.ordered ? seoData.headings.ordered.filter(h => h.level === 2).length : seoData.headings.h2.length
  const totalHeadings = seoData.headings.ordered ? seoData.headings.ordered.length : (seoData.headings.h1.length + seoData.headings.h2.length + seoData.headings.h3.length + seoData.headings.h4.length + seoData.headings.h5.length + seoData.headings.h6.length)

  if (h1Count === 0) {
    issues.push({ type: 'critical', category: 'headings', text: 'Missing H1 tag' })
    const deduction = SCORE_WEIGHTS.h1Missing
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Missing H1 Tag', deduction, max: 100, reason: 'H1 tag is essential for page structure and SEO' })
  } else if (h1Count > 1) {
    issues.push({ type: 'warning', category: 'headings', text: 'Multiple H1 tags found' })
    const deduction = SCORE_WEIGHTS.multipleH1
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Multiple H1 Tags', deduction, max: 100, reason: `Found ${h1Count} H1 tags (should be only 1)` })
  } else {
    breakdown.push({ factor: 'H1 Tag', deduction: 0, max: 100, reason: 'H1 tag is present and properly structured' })
  }

  if (h1Count === 1 && h2Count === 0 && totalHeadings > 1 && seoData.wordCount > 300) {
    issues.push({ type: 'warning', category: 'headings', text: 'Poor heading structure. Page with substantial content should have H2 tags for better organization.' })
    const deduction = SCORE_WEIGHTS.poorHeadingStructure
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Poor Heading Structure', deduction, max: 100, reason: 'Page has content but lacks H2 tags for proper content hierarchy' })
  }

  if (seoData.images.missingAlt > 0) {
    issues.push({ type: 'warning', category: 'images', text: `${seoData.images.missingAlt} image(s) missing alt text` })
    const imageDeduction = SCORE_WEIGHTS.imageAltMissing * Math.min(seoData.images.missingAlt, 10)
    score -= imageDeduction
    totalDeducted += imageDeduction
    const missingPercentage = seoData.images.total > 0 ? Math.round((seoData.images.missingAlt / seoData.images.total) * 100) : 0
    breakdown.push({ factor: 'Missing Alt Text', deduction: imageDeduction, max: 100, reason: `${seoData.images.missingAlt} of ${seoData.images.total} image(s) missing alt (${missingPercentage}% - accessibility & SEO)` })
  } else if (seoData.images.total > 0) {
    breakdown.push({ factor: 'Image Alt Text', deduction: 0, max: 100, reason: `All ${seoData.images.total} image(s) have alt text` })
  }

  if (seoData.images.oversized > 0) {
    issues.push({ type: 'hint', category: 'images', text: `${seoData.images.oversized} oversized image(s) found (larger than 2000px)` })
  }

  if (seoData.links.emptyHref > 0) {
    issues.push({ type: 'hint', category: 'links', text: `${seoData.links.emptyHref} link(s) with empty href` })
  }

  const externalLinkPercentage = seoData.links.total > 0 ? (seoData.links.external / seoData.links.total) * 100 : 0
  const expectedLinks = Math.max(5, Math.floor(seoData.wordCount / 400))
  if (seoData.links.external > expectedLinks && externalLinkPercentage > 30) {
    issues.push({
      type: 'hint',
      category: 'links',
      text: `High number of external links (${seoData.links.external} external links, ${Math.round(externalLinkPercentage)}% of total). About ${expectedLinks} would be typical for this page length.`
    })
  }

  if (!seoData.canonical.present) {
    issues.push({ type: 'warning', category: 'pageBasics', text: 'No canonical tag found. Canonical tag helps prevent duplicate content issues.' })
    const deduction = SCORE_WEIGHTS.missingCanonical
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Missing Canonical Tag', deduction, max: 100, reason: 'Canonical tag prevents duplicate content issues and consolidates page authority' })
  } else {
    breakdown.push({ factor: 'Canonical Tag', deduction: 0, max: 100, reason: 'Canonical tag is present' })
  }

  if (seoData.robots.present && !seoData.robots.index) {
    issues.push({ type: 'critical', category: 'pageBasics', text: 'Page set to noindex' })
    const deduction = SCORE_WEIGHTS.noindex
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Page Set to Noindex', deduction, max: 100, reason: 'Page is blocked from search engine indexing' })
  } else {
    breakdown.push({ factor: 'Robots Meta', deduction: 0, max: 100, reason: 'Page is indexable by search engines' })
  }

  if (seoData.security !== 'HTTPS') {
    issues.push({ type: 'warning', category: 'pageBasics', text: 'Page is not using HTTPS. HTTPS is required for security and SEO ranking.' })
    const deduction = SCORE_WEIGHTS.noHttps
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'No HTTPS', deduction, max: 100, reason: 'HTTPS is required for security and is a ranking factor' })
  } else {
    breakdown.push({ factor: 'HTTPS', deduction: 0, max: 100, reason: 'Page is using secure HTTPS connection' })
  }

  if (!seoData.metaLanguage || seoData.metaLanguage === 'Not set') {
    issues.push({ type: 'hint', category: 'pageBasics', text: 'Missing language declaration. Add lang attribute to help search engines understand content language.' })
    const deduction = SCORE_WEIGHTS.missingLanguage
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Missing Language Tag', deduction, max: 100, reason: 'Language declaration helps search engines serve content to correct audience' })
  } else {
    breakdown.push({ factor: 'Language Tag', deduction: 0, max: 100, reason: `Language is set to ${seoData.metaLanguage}` })
  }

  if (seoData.wordCount > 0 && seoData.wordCount < 300) {
    issues.push({ type: 'warning', category: 'pageBasics', text: 'Low word count. Pages with less than 300 words may struggle to rank well.' })
    const deduction = SCORE_WEIGHTS.lowWordCount
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Low Word Count', deduction, max: 100, reason: `Page has ${seoData.wordCount} words (recommended: 300+ for better SEO)` })
  } else if (seoData.wordCount >= 300) {
    breakdown.push({ factor: 'Content Length', deduction: 0, max: 100, reason: `Page has ${seoData.wordCount} words (good content length)` })
  }

  if (!seoData.viewport || !seoData.viewport.present) {
    issues.push({ type: 'warning', category: 'pageBasics', text: 'Missing viewport meta tag. Viewport tag is essential for mobile responsiveness and SEO.' })
    const deduction = SCORE_WEIGHTS.missingViewport
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Missing Viewport Tag', deduction, max: 100, reason: 'Viewport meta tag is required for mobile-friendly pages (Google ranking factor)' })
  } else {
    breakdown.push({ factor: 'Viewport Tag', deduction: 0, max: 100, reason: 'Viewport meta tag is present (mobile-friendly)' })
  }

  const ogMissing = []
  if (!seoData.openGraph.title) ogMissing.push('og:title')
  if (!seoData.openGraph.description) ogMissing.push('og:description')
  if (!seoData.openGraph.image) ogMissing.push('og:image')
  if (ogMissing.length) {
    issues.push({ type: 'warning', category: 'social', text: `Missing Open Graph tags: ${ogMissing.join(', ')}` })
    const deduction = SCORE_WEIGHTS.ogMissing
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'Missing Open Graph Tags', deduction, max: 100, reason: `Missing: ${ogMissing.join(', ')} (affects social media sharing)` })
  } else {
    breakdown.push({ factor: 'Open Graph Tags', deduction: 0, max: 100, reason: 'All essential Open Graph tags are present' })
  }

  const twitterMissing = []
  if (!seoData.twitter.card) twitterMissing.push('twitter:card')
  if (!seoData.twitter.title && !seoData.openGraph.title) twitterMissing.push('twitter:title')
  if (!seoData.twitter.description && !seoData.openGraph.description) twitterMissing.push('twitter:description')
  if (twitterMissing.length > 0 && (seoData.openGraph.title || seoData.openGraph.description)) {
    issues.push({ type: 'warning', category: 'social', text: 'Incomplete X (Twitter) meta tags. Add all required meta tags to help social media platforms better understand your content.' })
  }

  if (!seoData.jsonLd.count) {
    issues.push({ type: 'warning', category: 'schema', text: 'No structured data found. Add structured data to help search engines better understand your content.' })
    const deduction = SCORE_WEIGHTS.noSchema
    score -= deduction
    totalDeducted += deduction
    breakdown.push({ factor: 'No Structured Data', deduction, max: 100, reason: 'JSON-LD structured data helps search engines understand content better' })
  } else {
    breakdown.push({ factor: 'Structured Data', deduction: 0, max: 100, reason: `${seoData.jsonLd.count} structured data script(s) found` })
  }

  if (seoData.resources.blockingScripts > 0) {
    issues.push({ type: 'hint', category: 'resources', text: 'Blocking scripts in <head>. Use async or defer on scripts to prevent blocking page rendering.' })
  }

  const critical = issues.filter(i => i.type === 'critical').length
  const warnings = issues.filter(i => i.type === 'warning').length
  const hints = issues.filter(i => i.type === 'hint').length

  breakdown.unshift({
    factor: 'Base Score',
    deduction: 0,
    max: 100,
    reason: 'Starting score for a well-optimized page'
  })
  breakdown.push({
    factor: 'Total Deductions',
    deduction: totalDeducted,
    max: 100,
    reason: `Points deducted for ${critical} critical and ${warnings} warning issues`
  })

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    critical,
    warnings,
    hints,
    issues,
    breakdown,
    totalDeducted
  }
}
