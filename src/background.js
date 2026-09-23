// Background service worker for Chrome extension

// Global side panel state
let sidePanelOpen = false
let currentTabId = null

// Initialize side panel globally (not per-tab)
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    path: 'index.html',
    enabled: true
  }).catch(console.error)
})

// Handle extension icon click - toggle side panel globally
chrome.action.onClicked.addListener((tab) => {
  // CRITICAL: Call sidePanel.open() immediately, synchronously, without any awaits
  // This must be in direct response to the user gesture
  const windowId = tab.windowId
  
  // Set options and open immediately (no async/await before open)
  chrome.sidePanel.setOptions({
    path: 'index.html',
    enabled: true
  }).catch(console.error)
  
  // Open side panel immediately - must be synchronous, no awaits before this
  chrome.sidePanel.open({ windowId: windowId }).catch(console.error)
  
  // Update state
  sidePanelOpen = true
  currentTabId = tab.id
  
  // Notify side panel about the tab (async is fine after open)
  chrome.runtime.sendMessage({
    type: 'TAB_CHANGED',
    tabId: tab.id
  }).catch(() => {
    // Side panel might not be ready yet, that's okay
  })
})

// Function to close side panel globally
async function closeSidePanelGlobally() {
  try {
    // Disable side panel globally (applies to all windows)
    await chrome.sidePanel.setOptions({
      enabled: false
    }).catch(console.error)
    
    // Notify side panel to close
    chrome.runtime.sendMessage({
      type: 'SIDE_PANEL_CLOSE'
    }).catch(() => {
      // Side panel might not be listening, that's okay
    })
  } catch (error) {
    console.error('Error closing side panel globally:', error)
  }
}

// Listen to tab activation changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (sidePanelOpen) {
    currentTabId = activeInfo.tabId
    // Notify side panel about tab change
    chrome.runtime.sendMessage({
      type: 'TAB_CHANGED',
      tabId: activeInfo.tabId
    }).catch(() => {
      // Side panel might not be ready, that's okay
    })
  }
})

// Listen to tab updates (when URL changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (sidePanelOpen && changeInfo.status === 'complete' && tab.active) {
    currentTabId = tabId
    // Notify side panel about tab update
    chrome.runtime.sendMessage({
      type: 'TAB_CHANGED',
      tabId: tabId
    }).catch(() => {
      // Side panel might not be ready, that's okay
    })
  }
})

// When a new window is created, side panel is already enabled globally
// Users can manually open it if needed (can't programmatically open without user gesture)

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SIDE_PANEL_READY') {
    // Side panel is ready, send current tab info
    if (currentTabId) {
      chrome.runtime.sendMessage({
        type: 'TAB_CHANGED',
        tabId: currentTabId
      }).catch(console.error)
    }
    sendResponse({ success: true })
  } else if (message.type === 'SIDE_PANEL_CLOSED') {
    // Side panel was closed, update state
    sidePanelOpen = false
    currentTabId = null
    sendResponse({ success: true })
  } else if (message.type === 'CLOSE_SIDE_PANEL') {
    // Close side panel globally
    closeSidePanelGlobally().then(() => {
      sidePanelOpen = false
      currentTabId = null
      sendResponse({ success: true })
    }).catch((error) => {
      console.error('Error closing side panel:', error)
      sendResponse({ success: false, error: error.message })
    })
    return true // Keep message channel open for async response
  }
  return true // Keep message channel open for async response
})

