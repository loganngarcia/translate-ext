// Content script for page content extraction and translation overlay
let isTranslated = false;
let originalContent = new Map();
let observer = null;

// Initialize content script
function initializeContentScript() {
  setupMessageListeners();
  
  // Auto-extract initial content for quick access
  extractPageContent();
}

function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'extractContent':
        handleExtractContent(sendResponse);
        return true; // Keep message channel open for async response
        
      case 'translatePage':
        handleTranslatePage(message, sendResponse);
        return true;
        
      case 'toggleTranslation':
        handleToggleTranslation();
        break;
        
      case 'restoreOriginal':
        restoreOriginalContent();
        break;
    }
  });
}

function handleExtractContent(sendResponse) {
  try {
    const content = extractPageContent();
    sendResponse({ success: true, content });
  } catch (error) {
    console.error('Error extracting content:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function extractPageContent() {
  // Extract text content from the page
  const textElements = getTextElements();
  const pageContent = {
    title: document.title,
    url: window.location.href,
    text: extractCleanText(),
    elements: textElements.length,
    language: document.documentElement.lang || 'unknown'
  };
  
  // Send content to sidepanel for analysis
  chrome.runtime.sendMessage({
    action: 'pageContentExtracted',
    content: pageContent
  });
  
  return pageContent;
}

function getTextElements() {
  const selector = 'p, h1, h2, h3, h4, h5, h6, span, div, a, li, td, th, label, button, [aria-label]';
  const elements = document.querySelectorAll(selector);
  
  return Array.from(elements).filter(el => {
    // Filter out elements that shouldn't be translated
    if (el.closest('script, style, code, pre, noscript')) return false;
    if (el.querySelector('img, video, audio, canvas, svg')) return false;
    
    const text = el.textContent?.trim();
    if (!text || text.length < 3) return false;
    
    // Avoid elements that are likely navigation or UI
    const classList = Array.from(el.classList);
    const skipClasses = ['nav', 'menu', 'header', 'footer', 'sidebar', 'toolbar'];
    if (skipClasses.some(cls => classList.some(c => c.includes(cls)))) return false;
    
    return true;
  });
}

function extractCleanText() {
  const textElements = getTextElements();
  const texts = textElements
    .map(el => el.textContent?.trim())
    .filter(text => text && text.length > 3);
  
  return texts.join(' ').substring(0, 5000); // Limit for API efficiency
}

async function handleTranslatePage(message, sendResponse) {
  try {
    const { sourceLanguage, targetLanguage } = message;
    
    // Show loading state
    showTranslationLoading();
    
    // Extract content if not already done
    const content = extractPageContent();
    
    // Send to background script for API processing
    const response = await chrome.runtime.sendMessage({
      action: 'processTranslation',
      content: content.text,
      sourceLanguage,
      targetLanguage,
      pageUrl: content.url
    });
    
    if (response.success) {
      // Apply translations to page
      await applyTranslations(response.translations);
      
      // Generate and display summary
      if (response.summary) {
        chrome.runtime.sendMessage({
          action: 'updateSummary',
          summary: response.summary
        });
      }
      
      hideTranslationLoading();
      sendResponse({ success: true });
    } else {
      throw new Error(response.error || 'Translation failed');
    }
    
  } catch (error) {
    console.error('Translation error:', error);
    hideTranslationLoading();
    sendResponse({ success: false, error: error.message });
  }
}

function showTranslationLoading() {
  // Create or show loading overlay
  let overlay = document.getElementById('translation-loading-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'translation-loading-overlay';
    overlay.className = 'translation-loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">Translating page...</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  
  overlay.style.display = 'flex';
}

function hideTranslationLoading() {
  const overlay = document.getElementById('translation-loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

async function applyTranslations(translations) {
  if (!translations || typeof translations !== 'object') return;
  
  const textElements = getTextElements();
  
  // Store original content for restoration
  if (!isTranslated) {
    textElements.forEach((element, index) => {
      const originalText = element.textContent;
      if (originalText && originalText.trim()) {
        originalContent.set(element, originalText);
      }
    });
  }
  
  // Apply translations
  textElements.forEach(element => {
    const originalText = element.textContent?.trim();
    if (originalText && translations[originalText]) {
      element.textContent = translations[originalText];
      element.classList.add('translated-text');
    }
  });
  
  isTranslated = true;
  
  // Monitor for dynamic content changes
  startObservingChanges();
}

function startObservingChanges() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Handle newly added text elements
            const newTextElements = node.querySelectorAll(
              'p, h1, h2, h3, h4, h5, h6, span, div, a, li, td, th, label, button'
            );
            
            newTextElements.forEach(element => {
              const text = element.textContent?.trim();
              if (text && text.length > 3 && isTranslated) {
                // Request translation for new content
                requestDynamicTranslation(element, text);
              }
            });
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

async function requestDynamicTranslation(element, text) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'translateText',
      text: text,
      sourceLanguage: 'auto',
      targetLanguage: getCurrentTargetLanguage()
    });
    
    if (response.success && response.translatedText) {
      originalContent.set(element, text);
      element.textContent = response.translatedText;
      element.classList.add('translated-text');
    }
  } catch (error) {
    console.error('Dynamic translation error:', error);
  }
}

function getCurrentTargetLanguage() {
  // Get current target language from storage or default
  return 'English'; // This would be retrieved from chrome.storage in a real implementation
}

function handleToggleTranslation() {
  if (isTranslated) {
    restoreOriginalContent();
  } else {
    // Re-apply last translation if available
    // This would require storing the last translation state
  }
}

function restoreOriginalContent() {
  originalContent.forEach((originalText, element) => {
    if (element && element.parentNode) {
      element.textContent = originalText;
      element.classList.remove('translated-text');
    }
  });
  
  isTranslated = false;
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Utility functions
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 &&
         rect.top < window.innerHeight && rect.bottom > 0;
}

function shouldTranslateElement(element) {
  // Skip if element is not visible or is part of UI chrome
  if (!isElementVisible(element)) return false;
  
  // Skip navigation, headers, footers, etc.
  const skipSelectors = [
    'nav', 'header', 'footer', '[role="navigation"]',
    '[role="banner"]', '[role="contentinfo"]', '.nav', '.menu'
  ];
  
  return !skipSelectors.some(selector => element.closest(selector));
}

function sanitizeText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-.,!?;:()\[\]{}'"]/g, '')
    .trim();
}

// Error handling
function handleError(error, context) {
  console.error(`Content script error in ${context}:`, error);
  
  chrome.runtime.sendMessage({
    action: 'contentScriptError',
    error: error.message,
    context: context,
    url: window.location.href
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
  originalContent.clear();
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
} 