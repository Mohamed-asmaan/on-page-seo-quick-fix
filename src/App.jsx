import { useState, useEffect, useMemo, useCallback } from 'react'
import './App.css'
import { calculateSeoScore, isValidWebPage } from './seoScore.js'

const CATEGORIES = ['pageBasics', 'headings', 'images', 'links', 'schema', 'social', 'resources']

function hasExtensionApi() {
  return typeof chrome !== 'undefined' && Boolean(chrome.tabs) && Boolean(chrome.runtime) && Boolean(chrome.scripting)
}

const PREVIEW_SEO_DATA = {
  url: 'https://example.com/preview',
  security: 'HTTPS',
  title: { text: 'On Page SEO Quick Fix preview', length: 29 },
  metaDescription: { text: 'Sample page used so the checker can run in a normal browser without Chrome extension APIs.', length: 90 },
  metaKeywords: { text: '', present: false },
  metaPublisher: { text: 'Example Publisher', present: true },
  metaAuthor: { text: 'Example Author', present: true },
  metaLanguage: 'en',
  viewport: { present: true },
  wordCount: 420,
  headings: {
    ordered: [
      { text: 'Preview page', level: 1, tag: 'h1' },
      { text: 'What this checker looks at', level: 2, tag: 'h2' },
      { text: 'Page basics', level: 3, tag: 'h3' }
    ],
    h1: [{ text: 'Preview page', level: 1, tag: 'h1' }],
    h2: [{ text: 'What this checker looks at', level: 2, tag: 'h2' }],
    h3: [{ text: 'Page basics', level: 3, tag: 'h3' }],
    h4: [],
    h5: [],
    h6: []
  },
  images: {
    total: 2,
    missingAlt: 1,
    withAlt: 1,
    oversized: 0,
    list: [
      { src: 'hero.png', alt: 'Hero image', hasAlt: true, oversized: false },
      { src: 'logo.png', alt: 'No alt text', hasAlt: false, oversized: false }
    ]
  },
  links: { internal: 4, external: 2, nofollow: 0, emptyHref: 0, total: 6 },
  canonical: { url: 'https://example.com/preview', present: true },
  robots: { index: true, follow: true, present: true, content: 'index, follow' },
  openGraph: { title: 'On Page SEO Quick Fix', description: 'Preview description', image: '', url: 'https://example.com/preview', type: 'website' },
  twitter: { card: '', title: '', description: '', image: '' },
  jsonLd: { scripts: [], count: 0 },
  resources: { stylesheets: 1, headStylesheets: 1, scripts: 2, blockingScripts: 1, images: 2 }
}

function App() {
  const [seoData, setSeoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [invalidTab, setInvalidTab] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [theme, setTheme] = useState(() => {
    // Load theme from localStorage or default to 'dark'
    const savedTheme = localStorage.getItem('seo-checker-theme')
    return savedTheme || 'dark'
  })

  // Save theme preference and apply it
  useEffect(() => {
    localStorage.setItem('seo-checker-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  // Handle closing side panel globally
  const handleClosePanel = useCallback(async () => {
    try {
      if (!hasExtensionApi()) return
      // Notify background to close side panel in all windows
      await chrome.runtime.sendMessage({ type: 'CLOSE_SIDE_PANEL' })
    } catch (error) {
      console.error('Error closing side panel:', error)
    }
  }, [])

  // Extract collectSEOData function so it can be called from multiple places
  const collectSEOData = useCallback(async (tabId = null) => {
    try {
      setLoading(true)
      setError(null)
      setInvalidTab(false)

      if (!hasExtensionApi()) {
        setPreviewMode(true)
        setSeoData(PREVIEW_SEO_DATA)
        setLoading(false)
        return
      }

      setPreviewMode(false)
      
      // Get tab - use provided tabId or query for active tab
      let tab
      if (tabId) {
        tab = await chrome.tabs.get(tabId)
      } else {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        tab = activeTab
      }
      
      if (!tab?.id) {
        setInvalidTab(true)
        setLoading(false)
        return
      }

      // Check if tab URL is valid for SEO analysis
      if (!isValidWebPage(tab.url)) {
        setInvalidTab(true)
        setLoading(false)
        return
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const data = {
              url: window.location.href,
              security: window.location.protocol === 'https:' ? 'HTTPS' : 'HTTP',
              title: { text: document.title || '', length: document.title?.length || 0 },
              metaDescription: { text: '', length: 0 },
              metaKeywords: { text: '', present: false },
              metaPublisher: { text: '', present: false },
              metaAuthor: { text: '', present: false },
              metaLanguage: document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') || 'Not set',
              viewport: { present: false },
              wordCount: document.body ? document.body.innerText.trim().split(/\s+/).filter(word => word.length > 0).length : 0,
              headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
              images: { total: 0, missingAlt: 0, withAlt: 0, oversized: 0, list: [] },
              links: { internal: 0, external: 0, nofollow: 0, emptyHref: 0, total: 0 },
              canonical: { url: '', present: false },
              robots: { index: true, follow: true, present: false, content: '' },
              openGraph: { title: '', description: '', image: '', url: '', type: '' },
              twitter: { card: '', title: '', description: '', image: '' },
              jsonLd: { scripts: [], count: 0 },
              resources: {
                stylesheets: 0,
                headStylesheets: 0,
                scripts: 0,
                blockingScripts: 0,
                images: 0
              }
            }

            const origin = window.location.origin

            // Meta description
            const metaDesc = document.querySelector('meta[name="description"]')
            if (metaDesc) {
              data.metaDescription.text = metaDesc.getAttribute('content') || ''
              data.metaDescription.length = data.metaDescription.text.length
            }

            // Meta keywords
            const metaKeywords = document.querySelector('meta[name="keywords"]')
            if (metaKeywords) {
              data.metaKeywords.text = metaKeywords.getAttribute('content') || ''
              data.metaKeywords.present = true
            }

            // Meta publisher
            const metaPublisher = document.querySelector('meta[name="publisher"]') || document.querySelector('meta[property="article:publisher"]')
            if (metaPublisher) {
              data.metaPublisher.text = metaPublisher.getAttribute('content') || ''
              data.metaPublisher.present = true
            }

            // Meta author
            const metaAuthor = document.querySelector('meta[name="author"]') || document.querySelector('meta[property="article:author"]')
            if (metaAuthor) {
              data.metaAuthor.text = metaAuthor.getAttribute('content') || ''
              data.metaAuthor.present = true
            }

            // Viewport meta tag
            const viewport = document.querySelector('meta[name="viewport"]')
            if (viewport) {
              data.viewport.present = true
            }

            // Headings with hierarchy - collect in document order
            const allHeadings = []
            const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
            headingElements.forEach(heading => {
              const level = parseInt(heading.tagName.charAt(1))
              allHeadings.push({
                text: heading.textContent.trim(),
                level: level,
                tag: heading.tagName.toLowerCase()
              })
            })
            
            // Store both ordered list and by level for compatibility
            data.headings = {
              ordered: allHeadings,
              h1: allHeadings.filter(h => h.level === 1),
              h2: allHeadings.filter(h => h.level === 2),
              h3: allHeadings.filter(h => h.level === 3),
              h4: allHeadings.filter(h => h.level === 4),
              h5: allHeadings.filter(h => h.level === 5),
              h6: allHeadings.filter(h => h.level === 6)
            }

            // Images with detailed info
            document.querySelectorAll('img').forEach(img => {
              data.images.total++
              const alt = img.getAttribute('alt')
              const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
              const naturalWidth = img.naturalWidth || 0
              const naturalHeight = img.naturalHeight || 0
              const hasAlt = alt && alt.trim()
              
              if (hasAlt) {
                data.images.withAlt++
              } else {
                data.images.missingAlt++
              }

              // Check for oversized images (larger than 2000px in any dimension)
              const isOversized = naturalWidth > 2000 || naturalHeight > 2000
              if (isOversized) {
                data.images.oversized++
              }

              data.images.list.push({
                src: src.substring(src.lastIndexOf('/') + 1) || 'No src',
                alt: alt || 'No alt text',
                hasAlt: hasAlt,
                oversized: isOversized
              })
            })

            // Links with detailed analysis
            document.querySelectorAll('a[href]').forEach(link => {
              data.links.total++
              const href = link.getAttribute('href')
              const rel = link.getAttribute('rel') || ''

              if (!href || href.trim() === '' || href === '#') {
                data.links.emptyHref++
              } else if (rel.includes('nofollow')) {
                data.links.nofollow++
              } else if (href.startsWith('http')) {
                try {
                  new URL(href, window.location.href).origin === origin
                    ? data.links.internal++
                    : data.links.external++
                } catch {
                  // Ignore links with a malformed href.
                }
              } else {
                data.links.internal++
              }
            })

            // Canonical
            const canonical = document.querySelector('link[rel="canonical"]')
            if (canonical) {
              data.canonical.url = canonical.getAttribute('href') || ''
              data.canonical.present = true
            }

            // Robots meta
            const robotsMeta = document.querySelector('meta[name="robots"]')
            if (robotsMeta) {
              data.robots.present = true
              const content = (robotsMeta.getAttribute('content') || '').toLowerCase()
              data.robots.content = robotsMeta.getAttribute('content') || 'index, follow'
              data.robots.index = !content.includes('noindex')
              data.robots.follow = !content.includes('nofollow')
            } else {
              data.robots.content = 'index, follow'
            }

            // Open Graph tags
            const ogProps = ['title', 'description', 'image', 'url', 'type']
            ogProps.forEach(prop => {
              const meta = document.querySelector(`meta[property="og:${prop}"]`)
              if (meta) data.openGraph[prop] = meta.getAttribute('content') || ''
            })

            // Twitter/X tags
            const twitterCard = document.querySelector('meta[name="twitter:card"]') || document.querySelector('meta[property="twitter:card"]')
            if (twitterCard) data.twitter.card = twitterCard.getAttribute('content') || ''
            
            const twitterTitle = document.querySelector('meta[name="twitter:title"]') || document.querySelector('meta[property="twitter:title"]')
            if (twitterTitle) data.twitter.title = twitterTitle.getAttribute('content') || ''
            
            const twitterDesc = document.querySelector('meta[name="twitter:description"]') || document.querySelector('meta[property="twitter:description"]')
            if (twitterDesc) data.twitter.description = twitterDesc.getAttribute('content') || ''
            
            const twitterImage = document.querySelector('meta[name="twitter:image"]') || document.querySelector('meta[property="twitter:image"]')
            if (twitterImage) data.twitter.image = twitterImage.getAttribute('content') || ''

            // JSON-LD structured data
            document.querySelectorAll('script[type="application/ld+json"]').forEach((script, idx) => {
              data.jsonLd.count++
              try {
                const json = JSON.parse(script.textContent)
                data.jsonLd.scripts.push({ index: idx + 1, type: json['@type'] || 'Unknown', valid: true })
              } catch {
                data.jsonLd.scripts.push({ index: idx + 1, type: 'Invalid JSON', valid: false })
              }
            })

            // Resources analysis
            // Stylesheets
            const allStylesheets = document.querySelectorAll('link[rel="stylesheet"]')
            data.resources.stylesheets = allStylesheets.length
            const headStylesheets = document.head.querySelectorAll('link[rel="stylesheet"]')
            data.resources.headStylesheets = headStylesheets.length

            // Scripts
            const allScripts = document.querySelectorAll('script[src]')
            data.resources.scripts = allScripts.length
            // Check for blocking scripts (scripts in head without async/defer)
            const headScripts = document.head.querySelectorAll('script[src]')
            headScripts.forEach(script => {
              if (!script.hasAttribute('async') && !script.hasAttribute('defer')) {
                data.resources.blockingScripts++
              }
            })

            // Images count (already counted above)
            data.resources.images = data.images.total

            return data
          }
        })

        if (results?.[0]?.result) {
          const data = results[0].result
          // Ensure all required fields exist with defaults
          if (!data.resources) {
            data.resources = {
              stylesheets: 0,
              headStylesheets: 0,
              scripts: 0,
              blockingScripts: 0,
              images: data.images?.total || 0
            }
          }
          if (!data.images?.list) {
            data.images = { ...data.images, list: [], oversized: 0 }
          }
          if (!data.twitter) {
            data.twitter = { card: '', title: '', description: '', image: '' }
          }
          if (!data.viewport) {
            data.viewport = { present: false }
          }
          // Ensure headings.ordered exists for hierarchy display
          if (!data.headings?.ordered && data.headings) {
            const ordered = []
            for (let i = 1; i <= 6; i++) {
              if (data.headings[`h${i}`]) {
                data.headings[`h${i}`].forEach(h => {
                  ordered.push({ ...h, tag: `h${i}`, level: i })
                })
              }
            }
            data.headings.ordered = ordered
          }
          setSeoData(data)
        } else {
          setError('No data collected from page')
        }
      } catch (err) {
        // Check if error is due to invalid tab or restricted page
        const errorMessage = err.message || ''
        const isRestrictedError = 
          errorMessage.includes('Cannot access') ||
          errorMessage.includes('Cannot execute') ||
          errorMessage.includes('cannot be scripted') ||
          errorMessage.includes('extensions gallery') ||
          errorMessage.includes('chrome-extension://') ||
          errorMessage.includes('chrome://')
        
        if (isRestrictedError) {
          setInvalidTab(true)
        } else {
          setError(errorMessage || 'Failed to collect SEO data')
        }
      } finally {
        setLoading(false)
      }
  }, [])

  // Initial data collection on mount
  useEffect(() => {
    collectSEOData()

    if (!hasExtensionApi()) return
    
    // Notify background that side panel is ready
    chrome.runtime.sendMessage({ type: 'SIDE_PANEL_READY' }).catch(() => {
      // Background might not be ready, that's okay
    })
  }, [collectSEOData])

  // Listen for tab changes from background script
  useEffect(() => {
    if (!hasExtensionApi()) return

    const messageListener = (message, sender, sendResponse) => {
      if (message.type === 'TAB_CHANGED') {
        // Tab changed, collect new data
        collectSEOData(message.tabId)
        sendResponse({ success: true })
      } else if (message.type === 'SIDE_PANEL_CLOSE') {
        // Side panel should close (though Chrome handles this automatically)
        sendResponse({ success: true })
      }
      return true // Keep message channel open for async response
    }

    chrome.runtime.onMessage.addListener(messageListener)

    // Also listen to tab activation directly (as backup)
    const tabActivationListener = async (activeInfo) => {
      // Small delay to ensure tab is fully loaded
      setTimeout(() => {
        collectSEOData(activeInfo.tabId)
      }, 100)
    }

    chrome.tabs.onActivated.addListener(tabActivationListener)

    // Listen to tab updates (URL changes)
    const tabUpdateListener = async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        collectSEOData(tabId)
      }
    }

    chrome.tabs.onUpdated.addListener(tabUpdateListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
      chrome.tabs.onActivated.removeListener(tabActivationListener)
      chrome.tabs.onUpdated.removeListener(tabUpdateListener)
    }
  }, [collectSEOData])

  const scoreData = useMemo(() => calculateSeoScore(seoData), [seoData])

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const getSectionIssues = useCallback((category) => {
    return scoreData.issues.filter(issue => issue.category === category)
  }, [scoreData.issues])

  const getSectionStatus = useCallback((category) => {
    const issues = getSectionIssues(category)
    const critical = issues.filter(i => i.type === 'critical').length
    const warnings = issues.filter(i => i.type === 'warning').length
    const hints = issues.filter(i => i.type === 'hint').length

    if (critical) return { type: 'critical', count: critical, text: `${critical} critical` }
    if (warnings) return { type: 'warning', count: warnings, text: `${warnings} warning${warnings > 1 ? 's' : ''}` }
    if (hints) return { type: 'hint', count: hints, text: `${hints} hint${hints > 1 ? 's' : ''}` }
    return { type: 'perfect', text: 'Perfect' }
  }, [getSectionIssues])

  if (loading) {
    return (
      <div className={`seo-checker theme-${theme}`}>
        <div className="header">
          <h1>On Page SEO Quick Fix</h1>
          <div className="header-actions">
            <button className="refresh-button" onClick={() => collectSEOData()} title="Refresh SEO data">
              ↻
            </button>
            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="close-button" onClick={handleClosePanel} title="Close side panel (closes in all tabs)">
              ✕
            </button>
          </div>
        </div>
        <div className="loading-state">Loading SEO data...</div>
      </div>
    )
  }
  
  if (invalidTab) {
    return (
      <div className={`seo-checker theme-${theme}`}>
        <div className="header">
          <h1>On Page SEO Quick Fix</h1>
          <div className="header-actions">
            <button className="refresh-button" onClick={() => collectSEOData()} title="Refresh SEO data">
              ↻
            </button>
            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="close-button" onClick={handleClosePanel} title="Close side panel (closes in all tabs)">
              ✕
            </button>
          </div>
        </div>
        <div className="invalid-tab-state">
          <div className="invalid-tab-icon">🌐</div>
          <h2>Please Open a Website</h2>
          <p>This extension analyzes SEO data from web pages.</p>
          <p>Please navigate to a website to get started.</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={`seo-checker theme-${theme}`}>
        <div className="header">
          <h1>On Page SEO Quick Fix</h1>
          <div className="header-actions">
            <button className="refresh-button" onClick={() => collectSEOData()} title="Refresh SEO data">
              ↻
            </button>
            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="close-button" onClick={handleClosePanel} title="Close side panel (closes in all tabs)">
              ✕
            </button>
          </div>
        </div>
        <div className="error-state">Error: {error}</div>
      </div>
    )
  }
  
  if (!seoData) {
    return (
      <div className={`seo-checker theme-${theme}`}>
        <div className="header">
          <h1>On Page SEO Quick Fix</h1>
          <div className="header-actions">
            <button className="refresh-button" onClick={() => collectSEOData()} title="Refresh SEO data">
              ↻
            </button>
            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="close-button" onClick={handleClosePanel} title="Close side panel (closes in all tabs)">
              ✕
            </button>
          </div>
        </div>
        <div className="error-state">No SEO data available</div>
      </div>
    )
  }

  const getScoreColor = (score) => {
    if (score >= 80) return '#4caf50'
    if (score >= 60) return '#ff9800'
    return '#f44336'
  }

  return (
    <div className={`seo-checker theme-${theme}`}>
      <div className="header">
        <h1>On Page SEO Quick Fix</h1>
        <div className="header-actions">
          <button className="refresh-button" onClick={() => collectSEOData()} title="Refresh SEO data">
            ↻
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="close-button" onClick={handleClosePanel} title="Close side panel (closes in all tabs)">
            ✕
          </button>
        </div>
      </div>

      {previewMode && (
        <div className="preview-banner">
          Preview mode. Load the built extension in Chrome to analyze a live page.
        </div>
      )}

      <div className="score-section">
        <div className="score-container">
          <div className="score-display">
            <div className="score-number" style={{ color: getScoreColor(scoreData.score) }}>
              {scoreData.score}
            </div>
            <div className="score-label">Overall Score</div>
          </div>
          {scoreData.warnings > 0 && (
            <div className="score-badge warning">
              <span className="badge-dot"></span>
              {scoreData.warnings} WARNING{scoreData.warnings > 1 ? 'S' : ''}
            </div>
          )}
          {scoreData.critical > 0 && (
            <div className="score-badge critical">
              <span className="badge-dot"></span>
              {scoreData.critical} CRITICAL
            </div>
          )}
        </div>
        <button 
          className="score-breakdown-link" 
          onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
        >
          How is this score calculated?
        </button>
        {showScoreBreakdown && scoreData.breakdown && (
          <div className="score-breakdown">
            <div className="breakdown-header">
              <h3>Score Calculation Breakdown</h3>
              <button className="breakdown-close" onClick={() => setShowScoreBreakdown(false)}>×</button>
            </div>
            <div className="breakdown-content">
              {scoreData.breakdown.map((item, index) => (
                <div key={index} className="breakdown-item">
                  <div className="breakdown-factor">{item.factor}</div>
                  <div className="breakdown-details">
                    <div className={`breakdown-deduction ${item.deduction === 0 ? 'positive' : 'negative'}`}>
                      {item.deduction > 0 ? `-${item.deduction}` : '✓'}
                    </div>
                    <div className="breakdown-reason">{item.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="categories">
        {CATEGORIES.map(category => {
          const categoryTitles = {
            pageBasics: 'Page Basics',
            headings: 'Headings',
            images: 'Images',
            links: 'Links',
            schema: 'Schema',
            social: 'Social',
            resources: 'Resources'
          }
          return (
            <CategorySection
              key={category}
              title={categoryTitles[category]}
              status={getSectionStatus(category)}
              expanded={expandedSections[category]}
              onToggle={() => toggleSection(category)}
              data={seoData}
              issues={getSectionIssues(category)}
            />
          )
        })}
      </div>
    </div>
  )
}

function CategorySection({ title, status, expanded, onToggle, data, issues }) {
  const getStatusIcon = () => {
    if (status.type === 'critical') return '🔴'
    if (status.type === 'warning') return '▲'
    if (status.type === 'hint') return 'ℹ️'
    return '✓'
  }

  return (
    <div className="category-section">
      <div className="category-header" onClick={onToggle}>
        <div className="category-title">
          <span className="category-arrow">{expanded ? '▼' : '▶'}</span>
          <span>{title}</span>
        </div>
        <div className="category-status">
          <span className={`status-badge ${status.type}`}>
            {getStatusIcon()} {status.text}
          </span>
        </div>
      </div>
      {expanded && (
        <div className="category-content">
          {renderIssues(issues)}
          {renderCategoryDetails(title, data, issues)}
        </div>
      )}
    </div>
  )
}

function renderIssues(issues) {
  if (issues.length === 0) return null

  return (
    <div className="issues-container">
      {issues.map((issue, idx) => {
        const getIssueIcon = () => {
          if (issue.type === 'critical') return '🔴'
          if (issue.type === 'warning') return '⚠️'
          return 'ℹ️'
        }

        const getIssueTitle = () => {
          if (issue.text.includes('Title is too long')) return 'Title is too long'
          if (issue.text.includes('Meta description is too long')) return 'Meta description is too long'
          if (issue.text.includes('Missing meta keywords')) return 'Missing meta keywords'
          if (issue.text.includes('Missing ALT attributes') || issue.text.includes('missing alt text')) return 'Missing ALT attributes'
          if (issue.text.includes('High number of external links')) return 'High number of external links'
          if (issue.text.includes('No structured data found')) return 'No structured data found'
          if (issue.text.includes('Incomplete X (Twitter)')) return 'Incomplete X (Twitter) meta tags'
          if (issue.text.includes('Blocking scripts')) return 'Blocking scripts in <head>'
          return issue.text.split('.')[0]
        }

        const getIssueDescription = () => {
          if (issue.text.includes('Title should not exceed')) return 'Title should not exceed 60 characters'
          if (issue.text.includes('Description should not exceed')) return 'Description should not exceed 160 characters'
          if (issue.text.includes('Google ignores meta keywords')) return 'Google ignores meta keywords, but some other search engines and SEO tools may still use them.'
          if (issue.text.includes('missing alt text')) return 'Add ALT text to all images for better accessibility and SEO.'
          if (issue.text.includes('High number of external links')) {
            const match = issue.text.match(/about (\d+) would be typical/)
            return match ? `This page has more outbound links than expected for its length (about ${match[1]} would be typical).` : issue.text
          }
          if (issue.text.includes('Add structured data')) return 'Add structured data to help search engines better understand your content.'
          if (issue.text.includes('Add JSON-LD')) return 'No structured data found. Add JSON-LD to help search engines better understand your content.'
          if (issue.text.includes('Add all required meta tags')) return 'Add all required meta tags to help social media platforms better understand your content.'
          if (issue.text.includes('Use async or defer')) return 'Use async or defer on scripts to prevent blocking page rendering.'
          return issue.text
        }

        return (
          <div key={idx} className={`issue-banner ${issue.type}`}>
            <div className="issue-banner-content">
              <div className="issue-icon">{getIssueIcon()}</div>
              <div className="issue-text">
                <div className="issue-title">{getIssueTitle()}</div>
                <div className="issue-description">{getIssueDescription()}</div>
                <a href="#" className="learn-more-link" onClick={(e) => e.preventDefault()}>Learn more →</a>
              </div>
            </div>
            <div className={`issue-badge ${issue.type}`}>
              {issue.type === 'critical' ? 'Critical' : issue.type === 'warning' ? 'Warning' : 'Hint'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderHeadingsHierarchy(headings) {
  if (!headings || headings.length === 0) return null

  const hierarchy = []
  const stack = [] // Stack to track parent headings

  headings.forEach((heading) => {
    const currentLevel = heading.level
    
    // Pop stack until we find the parent (or stack is empty)
    while (stack.length > 0 && stack[stack.length - 1].level >= currentLevel) {
      stack.pop()
    }
    
    // Calculate indentation based on stack depth
    const indent = stack.length
    
    hierarchy.push({
      ...heading,
      indent: indent
    })
    
    // Push current heading to stack
    stack.push(heading)
  })

  return (
    <div className="headings-tree">
      {hierarchy.map((heading, index) => (
        <div 
          key={index} 
          className={`heading-tree-item heading-level-${heading.level}`}
          style={{ paddingLeft: `${heading.indent * 24}px` }}
        >
          <span className="heading-tag">{heading.tag.toUpperCase()}</span>
          <span className="heading-text">{heading.text}</span>
        </div>
      ))}
    </div>
  )
}

function renderCategoryDetails(title, data, issues) {
  const details = {
    'Page Basics': (
      <div className="details">
        <div className="detail-section">
          <div className="detail-row">
            <strong>Title</strong>
            <div className="detail-value">
              {data.title.text || 'Not set'}
              {issues.some(i => i.text.includes('Title is too long')) && <span className="field-warning-icon">▲</span>}
            </div>
          </div>
          <div className="detail-row">
            <strong>Description</strong>
            <div className="detail-value">
              {data.metaDescription.text || 'Not set'}
              {issues.some(i => i.text.includes('Meta description is too long')) && <span className="field-warning-icon">▲</span>}
            </div>
          </div>
          <div className="detail-row">
            <strong>URL</strong>
            <div className="detail-value">{data.url || 'Not set'}</div>
          </div>
          <div className="detail-row">
            <strong>Security</strong>
            <div className="detail-value security-https">{data.security || 'Not set'}</div>
          </div>
          <div className="detail-row">
            <strong>Canonical</strong>
            <div className="detail-value">{data.canonical.present ? data.canonical.url : 'Not set'}</div>
          </div>
          <div className="detail-row">
            <strong>Robots</strong>
            <div className="detail-value">{data.robots.content || 'index, follow'}</div>
          </div>
          <div className="detail-row">
            <strong>Keywords</strong>
            <div className="detail-value">
              {data.metaKeywords.present ? data.metaKeywords.text : 'Not set'}
              {!data.metaKeywords.present && <span className="field-hint-icon">ℹ️</span>}
            </div>
          </div>
          <div className="detail-row">
            <strong>Publisher</strong>
            <div className="detail-value">{data.metaPublisher.present ? data.metaPublisher.text : 'Not set'}</div>
          </div>
          <div className="detail-row">
            <strong>Author</strong>
            <div className="detail-value">{data.metaAuthor.present ? data.metaAuthor.text : 'Not set'}</div>
          </div>
          <div className="detail-row">
            <strong>Language</strong>
            <div className="detail-value">{data.metaLanguage || 'Not set'}</div>
          </div>
          <div className="detail-row">
            <strong>Word Count</strong>
            <div className="detail-value">{data.wordCount || 0}</div>
          </div>
        </div>
      </div>
    ),
    'Headings': (
      <div className="details">
        <div className="detail-section">
          <div className="headings-summary">
            <strong>Total headings: {(data.headings.ordered || []).length || (data.headings.h1.length + data.headings.h2.length + data.headings.h3.length + data.headings.h4.length + data.headings.h5.length + data.headings.h6.length)} • H1-H6 distribution</strong>
          </div>
          <div className="headings-distribution">
            <div className="heading-count-box">
              <div className="heading-count-number">{(data.headings.ordered || []).filter(h => h.level === 1).length || data.headings.h1.length}</div>
              <div className="heading-count-label">H1</div>
            </div>
            <div className="heading-count-box">
              <div className="heading-count-number">{(data.headings.ordered || []).filter(h => h.level === 2).length || data.headings.h2.length}</div>
              <div className="heading-count-label">H2</div>
            </div>
            <div className="heading-count-box">
              <div className="heading-count-number">{(data.headings.ordered || []).filter(h => h.level === 3).length || data.headings.h3.length}</div>
              <div className="heading-count-label">H3</div>
            </div>
            <div className="heading-count-box">
              <div className="heading-count-number">{(data.headings.ordered || []).filter(h => h.level === 4).length || data.headings.h4.length}</div>
              <div className="heading-count-label">H4</div>
            </div>
            <div className="heading-count-box">
              <div className="heading-count-number">{(data.headings.ordered || []).filter(h => h.level === 5).length || data.headings.h5.length}</div>
              <div className="heading-count-label">H5</div>
            </div>
            <div className="heading-count-box">
              <div className="heading-count-number">{(data.headings.ordered || []).filter(h => h.level === 6).length || data.headings.h6.length}</div>
              <div className="heading-count-label">H6</div>
            </div>
          </div>
          <div className="headings-hierarchy">
            {renderHeadingsHierarchy(data.headings.ordered || [])}
          </div>
        </div>
      </div>
    ),
    'Images': (
      <div className="details">
        <div className="detail-section">
          <div className="images-stats">
            <div className="stat-item">
              <strong>{data.images.total}</strong> Total Images
            </div>
            <div className="stat-item">
              <strong>{data.images.missingAlt}</strong> Missing Alt
            </div>
            <div className="stat-item">
              <strong>{data.images.oversized}</strong> Oversized
            </div>
          </div>
          {data.images.list && data.images.list.length > 0 && (
            <div className="images-table">
              <div className="table-header">
                <div className="table-col">Image</div>
                <div className="table-col">Alt Text</div>
              </div>
              {data.images.list.slice(0, 20).map((img, i) => (
                <div key={i} className="table-row">
                  <div className="table-col image-name">
                    <span className="clipboard-icon">📋</span>
                    {img.src}
                  </div>
                  <div className={`table-col ${img.hasAlt ? 'has-alt' : 'no-alt'}`}>
                    {img.hasAlt ? img.alt : 'No alt text'}
                    {!img.hasAlt && <span className="alt-badge">NO ALT</span>}
                  </div>
                </div>
              ))}
              {data.images.list.length > 20 && (
                <div className="table-footer">... and {data.images.list.length - 20} more images</div>
              )}
            </div>
          )}
        </div>
      </div>
    ),
    'Links': (
      <div className="details">
        <div className="detail-section">
          <div className="links-stats">
            <div className="stat-item">
              <strong>{data.links.total}</strong> Total Links
            </div>
            <div className="stat-item">
              <strong>{data.links.internal}</strong> Internal Links <span className="stat-percentage">({data.links.total > 0 ? Math.round((data.links.internal / data.links.total) * 100) : 0}% of total)</span>
            </div>
            <div className="stat-item">
              <strong>{data.links.external}</strong> External Links <span className="stat-percentage">({data.links.total > 0 ? Math.round((data.links.external / data.links.total) * 100) : 0}% of total)</span>
            </div>
          </div>
        </div>
      </div>
    ),
    'Schema': (
      <div className="details">
        <div className="detail-section">
          {data.jsonLd.count > 0 ? (
            <div className="schema-info">
              <div className="detail-row">
                <strong>JSON-LD Scripts Found:</strong>
                <div className="detail-value">{data.jsonLd.count}</div>
              </div>
              {data.jsonLd.scripts.map((s, i) => (
                <div key={i} className="detail-row">
                  <div className="detail-value">
                    {s.type} {s.valid ? '✓' : '✗ Invalid JSON'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="schema-hint-box">
              <div className="hint-icon">ℹ️</div>
              <div className="hint-text">No structured data found. Add JSON-LD to help search engines better understand your content.</div>
            </div>
          )}
        </div>
      </div>
    ),
    'Social': (
      <div className="details">
        <div className="detail-section">
          <div className="social-section-header">
            <div className="social-title-with-icon">
              <span className="og-icon">🔗</span>
              <span>Open Graph</span>
            </div>
            <div className={`social-status ${(data.openGraph.title || data.openGraph.description || data.openGraph.image) ? 'present' : 'not-present'}`}>
              {(data.openGraph.title || data.openGraph.description || data.openGraph.image) ? 'PRESENT' : 'NOT PRESENT'}
            </div>
          </div>
          <div className="social-tags">
            <div className="detail-row">
              <strong>og:title</strong>
              <div className="detail-value">{data.openGraph.title || 'Not set'}</div>
            </div>
            <div className="detail-row">
              <strong>og:description</strong>
              <div className="detail-value">{data.openGraph.description || 'Not set'}</div>
            </div>
            <div className="detail-row">
              <strong>og:image</strong>
              <div className="detail-value">{data.openGraph.image || 'Not set'}</div>
            </div>
            <div className="detail-row">
              <strong>og:type</strong>
              <div className="detail-value">{data.openGraph.type || 'Not set'}</div>
            </div>
          </div>
          <div className="social-section-header" style={{ marginTop: '24px' }}>
            <div className="social-title-with-icon">
              <span className="twitter-icon">𝕏</span>
              <span>X (Twitter) Tags</span>
            </div>
            <div className={`social-status ${data.twitter.card ? 'present' : 'not-present'}`}>
              {data.twitter.card ? 'PRESENT' : 'NOT PRESENT'}
            </div>
          </div>
          <div className="social-tags">
            <div className="detail-row">
              <strong>twitter:card</strong>
              <div className="detail-value">{data.twitter.card || 'Not set'}</div>
            </div>
            {data.twitter.title && (
              <div className="detail-row">
                <strong>twitter:title</strong>
                <div className="detail-value">{data.twitter.title}</div>
              </div>
            )}
            {data.twitter.description && (
              <div className="detail-row">
                <strong>twitter:description</strong>
                <div className="detail-value">{data.twitter.description}</div>
              </div>
            )}
            {data.twitter.image && (
              <div className="detail-row">
                <strong>twitter:image</strong>
                <div className="detail-value">{data.twitter.image}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    'Resources': (
      <div className="details">
        <div className="detail-section">
          <div className="resources-stats-row">
            <div className="resource-stat">
              <strong>{data.resources.stylesheets}</strong> Stylesheets
            </div>
            <div className="resource-stat">
              <strong>{data.resources.scripts}</strong> Scripts
            </div>
            <div className="resource-stat">
              <strong>{data.resources.images}</strong> Images
            </div>
          </div>
          <div className="resources-stats-row">
            <div className="resource-stat">
              <strong>{data.resources.headStylesheets}</strong> Head Stylesheets
            </div>
            <div className="resource-stat">
              <strong>{data.resources.blockingScripts}</strong> Blocking Scripts
              {data.resources.blockingScripts > 0 && <span className="blocking-badge">BLOCKING SCRIPTS</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }
  return details[title] || null
}

export default App