// Background service worker for Chrome extension
// Handles coordination between sidepanel, content scripts, and AWS API

// Configuration
const AWS_ENDPOINT = 'https://your-api-gateway-url.amazonaws.com/prod';
const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // milliseconds

// State management
const extensionState = {
  activeTranslations: new Map(),
  cachedTranslations: new Map(),
  rateLimitResets: new Map()
};

// Initialize extension on startup
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

function initializeExtension() {
  // Clear any existing state
  extensionState.activeTranslations.clear();
  extensionState.cachedTranslations.clear();
  
  console.log('AI Page Translator extension initialized');
  console.log('Sidepanel configured to open on action click via manifest');
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'translatePage':
      handleTranslatePage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'processTranslation':
      handleProcessTranslation(message, sender, sendResponse);
      return true;
      
    case 'translateText':
      handleTranslateText(message, sender, sendResponse);
      return true;
      
    case 'pageContentExtracted':
      handlePageContentExtracted(message, sender);
      break;
      
    case 'contentScriptError':
      handleContentScriptError(message, sender);
      break;
      
    case 'updateSummary':
      forwardToSidepanel(message);
      break;
      
    default:
      console.warn('Unknown message action:', message.action);
  }
});

async function handleTranslatePage(message, sender, sendResponse) {
  try {
    const { tabId, sourceLanguage, targetLanguage } = message;
    
    // Check if translation is already in progress
    if (extensionState.activeTranslations.has(tabId)) {
      sendResponse({ success: false, error: 'Translation already in progress' });
      return;
    }
    
    extensionState.activeTranslations.set(tabId, {
      sourceLanguage,
      targetLanguage,
      startTime: Date.now()
    });
    
    // Send message to content script to start translation
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'translatePage',
        sourceLanguage,
        targetLanguage
      });
      
      sendResponse(response);
    } catch (error) {
      extensionState.activeTranslations.delete(tabId);
      throw error;
    }
    
  } catch (error) {
    console.error('Translation page error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleProcessTranslation(message, sender, sendResponse) {
  try {
    const { content, sourceLanguage, targetLanguage, pageUrl } = message;
    
    // Generate cache key
    const cacheKey = `${sourceLanguage}-${targetLanguage}-${hashString(content)}`;
    
    // Check cache first
    if (extensionState.cachedTranslations.has(cacheKey)) {
      const cached = extensionState.cachedTranslations.get(cacheKey);
      sendResponse({ success: true, ...cached });
      return;
    }
    
    // Make parallel API calls for translation and summary
    const [translationResult, summaryResult] = await Promise.allSettled([
      translateContent(content, sourceLanguage, targetLanguage),
      generateSummary(content, targetLanguage, pageUrl)
    ]);
    
    const response = { success: true };
    
    if (translationResult.status === 'fulfilled') {
      response.translations = translationResult.value;
    } else {
      console.error('Translation failed:', translationResult.reason);
    }
    
    if (summaryResult.status === 'fulfilled') {
      response.summary = summaryResult.value;
    } else {
      console.error('Summary generation failed:', summaryResult.reason);
    }
    
    // Cache successful results
    if (response.translations || response.summary) {
      extensionState.cachedTranslations.set(cacheKey, {
        translations: response.translations,
        summary: response.summary,
        timestamp: Date.now()
      });
      
      // Clean old cache entries (keep last 50)
      if (extensionState.cachedTranslations.size > 50) {
        const entries = Array.from(extensionState.cachedTranslations.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        extensionState.cachedTranslations.clear();
        entries.slice(0, 50).forEach(([key, value]) => {
          extensionState.cachedTranslations.set(key, value);
        });
      }
    }
    
    sendResponse(response);
    
  } catch (error) {
    console.error('Process translation error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleTranslateText(message, sender, sendResponse) {
  try {
    const { text, sourceLanguage, targetLanguage } = message;
    
    const translations = await translateContent(text, sourceLanguage, targetLanguage);
    const translatedText = translations[text] || text;
    
    sendResponse({ success: true, translatedText });
    
  } catch (error) {
    console.error('Translate text error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function translateContent(content, sourceLanguage, targetLanguage) {
  const response = await callAWSAPI('/translate', {
    action: 'translate',
    content,
    sourceLanguage,
    targetLanguage,
    model: OPENAI_MODEL
  });
  
  return response.translations || {};
}

async function generateSummary(content, targetLanguage, pageUrl) {
  const response = await callAWSAPI('/summarize', {
    action: 'summarize',
    content,
    targetLanguage,
    pageUrl,
    model: OPENAI_MODEL
  });
  
  return response.summary || {
    title: 'Summary not available',
    points: [
      { emoji: '📄', text: 'Unable to generate summary at this time.' }
    ]
  };
}

async function callAWSAPI(endpoint, data) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${AWS_ENDPOINT}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait and retry
          const resetTime = response.headers.get('X-RateLimit-Reset');
          if (resetTime) {
            extensionState.rateLimitResets.set(endpoint, parseInt(resetTime));
          }
          
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            continue;
          }
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Handle successful response
      if (result.success === false) {
        throw new Error(result.error || 'API request failed');
      }
      
      return result;
      
    } catch (error) {
      console.error(`AWS API call attempt ${attempt} failed:`, error);
      
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
    }
  }
}

function handlePageContentExtracted(message, sender) {
  // Forward content to sidepanel if it's open
  forwardToSidepanel(message);
  
  // Store content for potential translation
  if (sender.tab?.id) {
    extensionState.activeTranslations.set(sender.tab.id, {
      ...extensionState.activeTranslations.get(sender.tab.id),
      content: message.content
    });
  }
}

function handleContentScriptError(message, sender) {
  console.error('Content script error:', message);
  
  // Notify sidepanel of error
  forwardToSidepanel({
    action: 'translationError',
    error: message.error,
    context: message.context
  });
}

async function forwardToSidepanel(message) {
  try {
    // Try to send message to sidepanel through runtime messaging
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    // Sidepanel might not be open, which is fine
    console.debug('Could not forward to sidepanel:', error.message);
  }
}

// Tab management
chrome.tabs.onRemoved.addListener((tabId) => {
  extensionState.activeTranslations.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Clear translation state when page starts loading
    extensionState.activeTranslations.delete(tabId);
  }
});

// Extension lifecycle
chrome.runtime.onSuspend.addListener(() => {
  // Clean up before suspension
  extensionState.activeTranslations.clear();
  console.log('Extension suspended');
});

// Utility functions
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

function isRateLimited(endpoint) {
  const resetTime = extensionState.rateLimitResets.get(endpoint);
  if (!resetTime) return false;
  
  return Date.now() < resetTime * 1000;
}

// Error reporting
function reportError(error, context) {
  console.error(`Background script error in ${context}:`, error);
  
  // Could send to analytics service
  // analytics.reportError(error, context);
}

// Performance monitoring
function measurePerformance(operation, func) {
  return async (...args) => {
    const start = performance.now();
    try {
      const result = await func(...args);
      const duration = performance.now() - start;
      console.debug(`${operation} completed in ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`${operation} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  };
}

// Development helpers
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
  // Add development-specific debugging
  chrome.runtime.onMessage.addListener((message) => {
    console.debug('Background received message:', message);
  });
} 