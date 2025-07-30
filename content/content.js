// Content script for page content extraction and translation overlay
let isTranslated = false;
let originalContent = new Map();
let observer = null;
let currentTranslation = null; // Current translation state for streaming
let translationQueue = new Map(); // Track pending translations

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
  // Much broader selector to catch all text content
  const selector = '*';
  const allElements = document.querySelectorAll(selector);
  
  return Array.from(allElements).filter(el => {
    // Skip non-text elements
    if (el.closest('script, style, code, pre, noscript, svg')) return false;
    
    // Only elements that have direct text content (not just child text)
    const directText = getDirectTextContent(el);
    if (!directText || directText.length < 3) return false;
    
    // Skip hidden elements
    if (!isElementVisible(el)) return false;
    
    // Skip elements that contain only child elements (no direct text)
    const hasOnlyChildElements = el.children.length > 0 && !directText.trim();
    if (hasOnlyChildElements) return false;
    
    return true;
  });
}

/**
 * Get only the direct text content of an element (not including children)
 * @param {Element} element - Element to check
 * @returns {string} Direct text content
 */
function getDirectTextContent(element) {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  }
  return text.trim();
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
    
    console.log('🚀 Starting streaming translation:', { sourceLanguage, targetLanguage });
    
    // Notify sidepanel that translation has started
    chrome.runtime.sendMessage({
      action: 'translationStarted',
      sourceLanguage,
      targetLanguage
    }).catch(() => {}); // Ignore if sidepanel not open
    
    // Store current translation state
    currentTranslation = { sourceLanguage, targetLanguage, isActive: true };
    
    // Extract content and get text elements
    const content = extractPageContent();
    const textElements = getTextElements();
    
    // Store original content for potential restoration
    if (!isTranslated) {
      textElements.forEach(element => {
        const originalText = getDirectTextContent(element);
        if (originalText) {
          originalContent.set(element, originalText);
        }
      });
    }
    
    // Start summary generation in parallel (non-blocking)
    generateSummaryAsync(content.text, targetLanguage, content.url);
    
    // Process elements in chunks for streaming translation
    await processElementsInStreaming(textElements, sourceLanguage, targetLanguage);
    
    // Mark as translated and start observing for dynamic content
    isTranslated = true;
    startObservingChanges();
    
    // Notify sidepanel that translation completed
    chrome.runtime.sendMessage({
      action: 'translationComplete',
      message: 'Page translation completed successfully'
    }).catch(() => {}); // Ignore if sidepanel not open
    
    console.log('✅ Streaming translation completed');
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Streaming translation error:', error);
    currentTranslation = null;
    
    // Notify sidepanel of error
    chrome.runtime.sendMessage({
      action: 'translationError',
      error: error.message
    }).catch(() => {}); // Ignore if sidepanel not open
    
    sendResponse({ success: false, error: error.message });
  }
}

// Removed blocking overlay functions - using streaming translation instead

async function applyTranslations(translations) {
  if (!translations || typeof translations !== 'object') return;
  
  const textElements = getTextElements();
  
  // Store original content for restoration
  if (!isTranslated) {
    textElements.forEach(element => {
      const originalText = getDirectTextContent(element);
      if (originalText && originalText.trim()) {
        originalContent.set(element, originalText);
      }
    });
  }
  
  // Apply translations using direct text content
  textElements.forEach(element => {
    const originalText = getDirectTextContent(element);
    if (originalText && translations[originalText]) {
      replaceDirectTextContent(element, translations[originalText]);
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
    const newElementsToTranslate = [];
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check the node itself and all its descendants
            const elementsToCheck = [node, ...node.querySelectorAll('*')];
            
            elementsToCheck.forEach(element => {
              const directText = getDirectTextContent(element);
              if (directText && directText.length > 3 && shouldTranslateText(directText) && isElementVisible(element)) {
                newElementsToTranslate.push(element);
              }
            });
          } else if (node.nodeType === Node.TEXT_NODE) {
            // Handle direct text node additions
            const text = node.textContent?.trim();
            if (text && text.length > 3 && shouldTranslateText(text)) {
              const parentElement = node.parentElement;
              if (parentElement && isElementVisible(parentElement)) {
                newElementsToTranslate.push(parentElement);
              }
            }
          }
        });
      }
    });
    
    // Translate new elements if we have any and translation is active
    if (newElementsToTranslate.length > 0 && isTranslated && currentTranslation?.isActive) {
      console.log(`🔄 Found ${newElementsToTranslate.length} new elements to translate`);
      translateNewElements(newElementsToTranslate);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true // Also watch for text changes
  });
}

/**
 * Translate newly discovered elements
 * @param {Array} elements - New elements to translate
 */
async function translateNewElements(elements) {
  try {
    await processBatch(elements, currentTranslation.sourceLanguage, currentTranslation.targetLanguage, 'NEW', 1);
  } catch (error) {
    console.error('❌ Failed to translate new elements:', error);
  }
}

// Removed requestDynamicTranslation - now handled by translateNewElements

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
      replaceDirectTextContent(element, originalText);
      element.classList.remove('translated-text');
    }
  });
  
  isTranslated = false;
  currentTranslation = null;
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Utility functions
function isElementVisible(element) {
  // Check if element is visible in the DOM
  if (!element || !element.parentNode) return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
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

// =============================================================================
// STREAMING TRANSLATION FUNCTIONS
// =============================================================================

/**
 * Process text elements in streaming mode - translate progressively without blocking
 * @param {Array} elements - Text elements to translate
 * @param {string} sourceLanguage - Source language
 * @param {string} targetLanguage - Target language
 */
async function processElementsInStreaming(elements, sourceLanguage, targetLanguage) {
  console.log(`🔄 Processing ${elements.length} elements in streaming mode`);
  
  // Filter elements that actually have translatable text
  const translatableElements = elements.filter(el => {
    const directText = getDirectTextContent(el);
    return directText && shouldTranslateText(directText);
  });
  
  console.log(`📝 Found ${translatableElements.length} elements with translatable text out of ${elements.length} total`);
  
  if (translatableElements.length === 0) {
    console.log('⚠️ No translatable content found on this page');
    return;
  }
  
  // Group elements into small batches
  const batchSize = 8;
  const batches = [];
  
  for (let i = 0; i < translatableElements.length; i += batchSize) {
    batches.push(translatableElements.slice(i, i + batchSize));
  }
  
  console.log(`📦 Created ${batches.length} batches for processing`);
  
  // Process batches with small delays to maintain responsiveness
  for (let i = 0; i < batches.length; i++) {
    if (!currentTranslation?.isActive) {
      console.log('🛑 Translation cancelled');
      break;
    }
    
    const batch = batches[i];
    await processBatch(batch, sourceLanguage, targetLanguage, i + 1, batches.length);
    
    // Small delay between batches to keep page responsive
    if (i < batches.length - 1) {
      await sleep(100); // 100ms delay
    }
  }
}

/**
 * Process a single batch of elements
 * @param {Array} elements - Elements in this batch
 * @param {string} sourceLanguage - Source language
 * @param {string} targetLanguage - Target language
 * @param {number} batchNum - Current batch number
 * @param {number} totalBatches - Total number of batches
 */
async function processBatch(elements, sourceLanguage, targetLanguage, batchNum, totalBatches) {
  console.log(`📝 Processing batch ${batchNum}/${totalBatches} (${elements.length} elements)`);
  
  // Extract direct text from elements (not including children)
  const textMap = new Map();
  const textsToTranslate = [];
  
  elements.forEach(element => {
    const directText = getDirectTextContent(element);
    if (directText && shouldTranslateText(directText)) {
      textMap.set(directText, element);
      textsToTranslate.push(directText);
    }
  });
  
  if (textsToTranslate.length === 0) {
    console.log(`⏭️ Batch ${batchNum} - no translatable text found`);
    return;
  }
  
  // Combine texts for efficient API call
  const combinedText = textsToTranslate.join('\n---SEPARATOR---\n');
  
  try {
    // Send to background for translation (no visual feedback)
    const response = await chrome.runtime.sendMessage({
      action: 'translateText',
      text: combinedText,
      sourceLanguage,
      targetLanguage
    });
    
    if (response.success && response.translatedText) {
      // Split the response back into individual translations
      const translatedParts = response.translatedText.split('\n---SEPARATOR---\n');
      
      // Apply translations immediately to direct text content
      textsToTranslate.forEach((originalText, index) => {
        const element = textMap.get(originalText);
        const translatedText = translatedParts[index]?.trim();
        
        if (element && translatedText && translatedText !== originalText) {
          // Replace only the direct text content, preserving child elements
          replaceDirectTextContent(element, translatedText);
          element.classList.add('translated-text');
        }
      });
      
      console.log(`✅ Batch ${batchNum} completed - translated ${translatedParts.length} texts`);
    } else {
      throw new Error(response.error || 'Translation failed');
    }
    
  } catch (error) {
    console.error(`❌ Batch ${batchNum} failed:`, error);
  }
}

/**
 * Replace only the direct text content of an element, preserving child elements
 * @param {Element} element - Element to update
 * @param {string} newText - New text content
 */
function replaceDirectTextContent(element, newText) {
  // Find and replace only text nodes
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      node.textContent = newText;
      break; // Replace only the first text node
    }
  }
}

/**
 * Generate summary asynchronously without blocking translation
 * @param {string} content - Page content
 * @param {string} targetLanguage - Target language
 * @param {string} pageUrl - Page URL
 */
async function generateSummaryAsync(content, targetLanguage, pageUrl) {
  try {
    console.log('📋 Generating summary in parallel...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'processTranslation',
      content: content.substring(0, 3000), // Limit content for summary
      sourceLanguage: 'auto',
      targetLanguage,
      pageUrl
    });
    
    if (response.success && response.summary) {
      chrome.runtime.sendMessage({
        action: 'updateSummary',
        summary: response.summary
      });
      console.log('📋 Summary generated successfully');
    }
  } catch (error) {
    console.error('❌ Summary generation failed:', error);
  }
}

/**
 * Check if text should be translated
 * @param {string} text - Text to check
 * @returns {boolean} True if should translate
 */
function shouldTranslateText(text) {
  if (!text || text.length < 3) return false;
  
  // Skip common UI elements that shouldn't be translated
  const skipPatterns = [
    /^[\d\s\-\+\*\/\=\(\)]+$/, // Only numbers and math symbols
    /^[A-Z]{2,}$/, // All caps abbreviations
    /^\w+\.(com|org|net|edu|gov)/, // URLs
    /^@\w+/, // Usernames
    /^#\w+/, // Hashtags
    /^\$[\d,]+/, // Prices
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/, // Dates
    /^[\d\-\+\(\)\s]+$/ // Phone numbers
  ];
  
  return !skipPatterns.some(pattern => pattern.test(text.trim()));
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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