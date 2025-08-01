// Content script for page content extraction and translation overlay
let isTranslated = false;
let originalContent = new Map();
let observer = null;
let currentTranslation = null; // Current translation state for streaming
let translationQueue = new Map(); // Track pending translations
let continuousTranslation = {
  enabled: false,
  sourceLanguage: 'auto',
  targetLanguage: 'English'
}; // Track continuous translation state

// Initialize content script
function initializeContentScript() {
  try {
    // Ensure we're on a valid page
    if (!document || !document.body) {
      console.warn('Content script: Document not ready, retrying in 1 second');
      setTimeout(initializeContentScript, 1000);
      return;
    }

    setupMessageListeners();
    
    // Auto-extract initial content for quick access
    extractPageContent();
    
    // Notify background script that content script is ready
    if (isExtensionContextValid()) {
      sendMessageWithRetry({
        action: 'contentScriptReady',
        url: window.location.href,
        timestamp: Date.now()
      }, 2).catch(error => {
        if (!error.message.includes('Extension context invalidated')) {
          console.warn('Content script: Failed to notify background script:', error);
        }
      });
    }
    
    console.log('Content script initialized successfully');
  } catch (error) {
    console.error('Content script initialization failed:', error);
    // Retry initialization after a delay
    setTimeout(initializeContentScript, 2000);
  }
}

function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      // Validate message
      if (!message || !message.action) {
        console.error('Content script: Invalid message received:', message);
        sendResponse({ success: false, error: 'Invalid message format' });
        return true;
      }

      console.log('Content script: Received message:', message.action);

      switch (message.action) {
        case 'extractContent':
          handleExtractContent(sendResponse);
          return true; // Keep message channel open for async response
          
        case 'translatePage':
          handleTranslatePage(message, sendResponse);
          return true;
          
        case 'toggleTranslation':
          handleToggleTranslation();
          sendResponse({ success: true });
          break;
          
        case 'restoreOriginal':
          restoreOriginalContent();
          sendResponse({ success: true });
          break;

        case 'startContinuousTranslation':
          handleStartContinuousTranslation(message, sendResponse);
          return true;

        case 'stopContinuousTranslation':
          handleStopContinuousTranslation(message, sendResponse);
          return true;

        case 'updateContinuousLanguage':
          handleUpdateContinuousLanguage(message, sendResponse);
          return true;

        case 'getPageContent':
          // Extract current page content for chat context
          try {
            const pageContent = extractCleanText();
            console.log('📄 Extracted page content for chat:', pageContent.substring(0, 100) + '...');
            sendResponse({ 
              success: true, 
              content: pageContent,
              url: window.location.href 
            });
          } catch (error) {
            console.error('Failed to extract page content:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        default:
          console.warn('Content script: Unknown message action:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
          break;
      }
    } catch (error) {
      console.error('Content script: Error handling message:', error);
      sendResponse({ success: false, error: error.message });
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
  if (isExtensionContextValid()) {
    sendMessageWithRetry({
      action: 'pageContentExtracted',
      content: pageContent
    }, 2).catch(error => {
      if (!error.message.includes('Extension context invalidated')) {
        console.warn('Failed to send page content to background:', error);
      }
    });
  }
  
  return pageContent;
}

function getTextElements() {
  const textElements = [];
  
  // 1. Standard DOM text elements
  const standardElements = getStandardTextElements();
  textElements.push(...standardElements);
  
  // 2. Form elements (dropdowns, inputs, buttons)
  const formElements = getFormTextElements();
  textElements.push(...formElements);
  
  // 3. Shadow DOM elements
  const shadowElements = getShadowDOMTextElements();
  textElements.push(...shadowElements);
  
  // 4. SVG text elements
  const svgElements = getSVGTextElements();
  textElements.push(...svgElements);
  
  // 5. Iframe content (where accessible)
  const iframeElements = getIframeTextElements();
  textElements.push(...iframeElements);
  
  // 6. Canvas and map detection (for user notification)
  detectCanvasAndMaps();
  
  // Remove duplicates and return
  return [...new Set(textElements)];
}

function getStandardTextElements() {
  const selector = '*';
  const allElements = document.querySelectorAll(selector);
  
  return Array.from(allElements).filter(el => {
    // Skip non-text elements
    if (el.closest('script, style, code, pre, noscript')) return false;
    
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

function getFormTextElements() {
  const formElements = [];
  
  // Select dropdowns and their options
  document.querySelectorAll('select').forEach(select => {
    if (isElementVisible(select)) {
      // Add the select element itself if it has a visible label
      const selectText = select.getAttribute('aria-label') || select.title;
      if (selectText) {
        select._translationType = 'select-label';
        select._originalText = selectText;
        formElements.push(select);
      }
      
      // Add all option elements
      select.querySelectorAll('option').forEach(option => {
        const optionText = option.textContent?.trim();
        if (optionText && optionText.length > 1) {
          option._translationType = 'option';
          option._originalText = optionText;
          formElements.push(option);
        }
      });
    }
  });
  
  // Input placeholders and values
  document.querySelectorAll('input[placeholder], input[type="submit"], input[type="button"], input[value]').forEach(input => {
    if (isElementVisible(input)) {
      const placeholder = input.placeholder;
      const value = input.value;
      const ariaLabel = input.getAttribute('aria-label');
      
      if (placeholder && placeholder.length > 1) {
        input._translationType = 'placeholder';
        input._originalText = placeholder;
        formElements.push(input);
      } else if (value && (input.type === 'submit' || input.type === 'button') && value.length > 1) {
        input._translationType = 'button-value';
        input._originalText = value;
        formElements.push(input);
      } else if (ariaLabel && ariaLabel.length > 1) {
        input._translationType = 'aria-label';
        input._originalText = ariaLabel;
        formElements.push(input);
      }
    }
  });
  
  // Button text
  document.querySelectorAll('button').forEach(button => {
    if (isElementVisible(button)) {
      const buttonText = button.textContent?.trim();
      const ariaLabel = button.getAttribute('aria-label');
      
      if (buttonText && buttonText.length > 1) {
        button._translationType = 'button-text';
        button._originalText = buttonText;
        formElements.push(button);
      } else if (ariaLabel && ariaLabel.length > 1) {
        button._translationType = 'button-aria';
        button._originalText = ariaLabel;
        formElements.push(button);
      }
    }
  });
  
  // Labels
  document.querySelectorAll('label').forEach(label => {
    if (isElementVisible(label)) {
      const labelText = label.textContent?.trim();
      if (labelText && labelText.length > 1) {
        label._translationType = 'label';
        label._originalText = labelText;
        formElements.push(label);
      }
    }
  });
  
  return formElements;
}

function getShadowDOMTextElements() {
  const shadowElements = [];
  
  // Find all elements that might have shadow DOM
  document.querySelectorAll('*').forEach(element => {
    if (element.shadowRoot) {
      try {
        // Recursively search shadow DOM
        const shadowTextElements = element.shadowRoot.querySelectorAll('*');
        shadowTextElements.forEach(shadowEl => {
          const directText = getDirectTextContent(shadowEl);
          if (directText && directText.length > 3 && isElementVisible(shadowEl)) {
            shadowEl._translationType = 'shadow-dom';
            shadowEl._originalText = directText;
            shadowElements.push(shadowEl);
          }
        });
      } catch (error) {
        // Shadow DOM access might be restricted
        console.warn('Could not access shadow DOM:', error);
      }
    }
  });
  
  return shadowElements;
}

function getSVGTextElements() {
  const svgElements = [];
  
  // Find text elements within SVG
  document.querySelectorAll('svg text, svg textPath, svg tspan').forEach(textEl => {
    if (isElementVisible(textEl)) {
      const textContent = textEl.textContent?.trim();
      if (textContent && textContent.length > 1) {
        textEl._translationType = 'svg-text';
        textEl._originalText = textContent;
        svgElements.push(textEl);
      }
    }
  });
  
  return svgElements;
}

function getIframeTextElements() {
  const iframeElements = [];
  
  // Try to access iframe content (only works for same-origin)
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      if (iframe.contentDocument && iframe.contentWindow) {
        const iframeDoc = iframe.contentDocument;
        const iframeTextElements = iframeDoc.querySelectorAll('*');
        
        iframeTextElements.forEach(iframeEl => {
          const directText = getDirectTextContent(iframeEl);
          if (directText && directText.length > 3) {
            iframeEl._translationType = 'iframe';
            iframeEl._originalText = directText;
            iframeEl._parentIframe = iframe;
            iframeElements.push(iframeEl);
          }
        });
      }
    } catch (error) {
      // Cross-origin iframes will throw security errors
      console.warn('Could not access iframe content (likely cross-origin):', error);
    }
  });
  
  return iframeElements;
}

function detectCanvasAndMaps() {
  const canvasElements = document.querySelectorAll('canvas');
  const mapElements = document.querySelectorAll('[class*="map"], [id*="map"], [data-*="map"]');
  const embeddedMaps = document.querySelectorAll('iframe[src*="maps.google"], iframe[src*="openstreetmap"], iframe[src*="mapbox"]');
  
  let hasCanvasContent = false;
  let hasMapContent = false;
  
  // Check for canvas elements that might contain text
  canvasElements.forEach(canvas => {
    if (isElementVisible(canvas) && canvas.width > 100 && canvas.height > 100) {
      hasCanvasContent = true;
      
      // Check if this might be a map by looking at parent elements
      const parentClasses = canvas.parentElement?.className?.toLowerCase() || '';
      const parentId = canvas.parentElement?.id?.toLowerCase() || '';
      
      if (parentClasses.includes('map') || parentId.includes('map') || 
          parentClasses.includes('leaflet') || parentClasses.includes('google') ||
          parentClasses.includes('mapbox') || parentClasses.includes('osm')) {
        hasMapContent = true;
      }
    }
  });
  
  // Check for map-specific elements
  if (mapElements.length > 0 || embeddedMaps.length > 0) {
    hasMapContent = true;
  }
  
  // Notify user about untranslatable content
  if (hasCanvasContent || hasMapContent) {
    notifyAboutUntranslatableContent(hasMapContent, hasCanvasContent, canvasElements.length);
  }
}

function notifyAboutUntranslatableContent(hasMaps, hasCanvas, canvasCount) {
  // Send notification to sidepanel about content that cannot be translated
  if (isExtensionContextValid()) {
    sendMessageWithRetry({
      action: 'untranslatableContentDetected',
      details: {
        maps: hasMaps,
        canvas: hasCanvas,
        canvasCount: canvasCount,
        message: hasMaps ? 
          'Maps and interactive elements detected. Some text in maps, charts, and embedded content cannot be translated due to technical limitations.' :
          'Canvas-based content detected. Some graphical text elements may not be translatable.'
      }
    }, 1).catch(() => {}); // Ignore if sidepanel not available
  }
}

/**
 * Get text content based on element type
 * @param {Element} element - Element to check
 * @returns {string} Text content to translate
 */
function getDirectTextContent(element) {
  if (!element) return '';
  
  // If element has a specific translation type, get the appropriate text
  const translationType = element._translationType;
  
  switch (translationType) {
    case 'option':
      return element.textContent?.trim() || '';
      
    case 'placeholder':
      return element.placeholder?.trim() || '';
      
    case 'button-value':
      return element.value?.trim() || '';
      
    case 'aria-label':
    case 'button-aria':
      return element.getAttribute('aria-label')?.trim() || '';
      
    case 'select-label':
      return (element.getAttribute('aria-label') || element.title || '').trim();
      
    case 'button-text':
    case 'label':
      return element.textContent?.trim() || '';
      
    case 'svg-text':
      return element.textContent?.trim() || '';
      
    case 'shadow-dom':
    case 'iframe':
    default:
      // For standard DOM elements, get only direct text nodes
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  }
  return text.trim();
  }
}

function extractCleanText() {
  const textElements = getTextElements();
  const texts = textElements
    .map(el => getDirectTextContent(el))
    .filter(text => text && text.length > 3);
  
  return texts.join(' ').substring(0, 5000); // Limit for API efficiency
}

async function handleTranslatePage(message, sendResponse) {
  try {
    const { sourceLanguage, targetLanguage } = message;
    
    console.log('🚀 Starting streaming translation:', { sourceLanguage, targetLanguage });
    
    // Validate inputs
    if (!targetLanguage) {
      throw new Error('Target language is required');
    }
    
    // Set a timeout for the entire translation process
    const translationTimeout = setTimeout(() => {
      console.error('❌ Translation timeout - taking too long');
      currentTranslation = null;
      sendResponse({ success: false, error: 'Translation timeout - please try again' });
    }, 60000); // 60 second timeout
    
    try {
      // Notify sidepanel that translation has started
      if (isExtensionContextValid()) {
        sendMessageWithRetry({
          action: 'translationStarted',
          sourceLanguage,
          targetLanguage
        }, 1).catch(() => {}); // Ignore if sidepanel not open
      }
      
      // Store current translation state
      currentTranslation = { sourceLanguage, targetLanguage, isActive: true };
      
      // Extract content and get text elements
      const content = extractPageContent();
      const textElements = getTextElements();
      
      console.log(`📄 Found ${textElements.length} text elements to translate`);
      
      // Validate we have content to translate
      if (textElements.length === 0) {
        throw new Error('No text content found to translate');
      }
      
      // Store original content for potential restoration
      if (!isTranslated) {
        textElements.forEach(element => {
          const originalText = getDirectTextContent(element);
          if (originalText) {
            originalContent.set(element, originalText);
          }
        });
      }
      
      // Process elements in chunks for streaming translation
      await processElementsInStreaming(textElements, sourceLanguage, targetLanguage);
      
      // Mark as translated and start observing for dynamic content
      isTranslated = true;
      startObservingChanges();
      
      // Clear timeout since we succeeded
      clearTimeout(translationTimeout);
      
      // Notify sidepanel that translation completed
      if (isExtensionContextValid()) {
        sendMessageWithRetry({
          action: 'translationComplete',
          message: 'Page translation completed successfully'
        }, 1).catch(() => {}); // Ignore if sidepanel not open
      }
      
      console.log('✅ Streaming translation completed');
      sendResponse({ success: true });
      
    } catch (error) {
      clearTimeout(translationTimeout);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Streaming translation error:', error);
    currentTranslation = null;
    
    // Notify sidepanel of error
    if (isExtensionContextValid()) {
      sendMessageWithRetry({
        action: 'translationError',
        error: error.message
      }, 1).catch(() => {}); // Ignore if sidepanel not open
    }
    
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
    
    // Translate new elements if we have any and continuous translation is enabled
    if (newElementsToTranslate.length > 0 && continuousTranslation.enabled) {
      console.log(`🔄 Found ${newElementsToTranslate.length} new elements to translate (continuous mode)`);
      translateNewElementsContinuous(newElementsToTranslate);
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
  
  if (isExtensionContextValid()) {
    sendMessageWithRetry({
      action: 'contentScriptError',
      error: error.message,
      context: context,
      url: window.location.href
    }, 2).catch(() => {
      console.warn('Failed to report error to background script');
    });
  }
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
    // Check if Chrome runtime is still available
    if (!chrome.runtime?.id) {
      throw new Error('Extension context invalidated');
    }
    
    // Send to background for translation with timeout and retry logic
    const response = await sendMessageWithRetry({
      action: 'translateText',
      texts: textsToTranslate, // Send array of texts instead of combined string
      sourceLanguage,
      targetLanguage
    }, 3); // 3 retries
    
    if (response.success && response.translations) {
      // Apply translations using the translations object
      textsToTranslate.forEach((originalText) => {
        const element = textMap.get(originalText);
        const translatedText = response.translations[originalText];
        
        if (element && translatedText && translatedText !== originalText) {
          // Replace only the direct text content, preserving child elements
          replaceDirectTextContent(element, translatedText);
          element.classList.add('translated-text');
        }
      });
      
      console.log(`✅ Batch ${batchNum} completed - translated ${Object.keys(response.translations).length} texts`);
    } else {
      throw new Error(response.error || 'Translation failed');
    }
    
  } catch (error) {
    // Handle different types of errors
    if (error.message.includes('Extension context invalidated') || 
        error.message.includes('Receiving end does not exist') ||
        error.message.includes('message channel closed')) {
      console.warn(`⚠️ Extension context lost during batch ${batchNum} - stopping translation gracefully`);
      // Stop the current translation cleanly
      currentTranslation = null;
      continuousTranslation.enabled = false;
      return; // Don't log as error since this is expected during extension reload
    }
    
    console.error(`❌ Batch ${batchNum} failed:`, error);
  }
}

/**
 * Replace text content based on element type, preserving child elements
 * @param {Element} element - Element to update
 * @param {string} newText - New text content
 */
function replaceDirectTextContent(element, newText) {
  if (!element || !newText) return;
  
  // Handle different element types based on their translation type
  const translationType = element._translationType;
  
  switch (translationType) {
    case 'option':
      // For option elements, replace the text content directly
      element.textContent = newText;
      break;
      
    case 'placeholder':
      // For input placeholders
      element.placeholder = newText;
      break;
      
    case 'button-value':
      // For button input values
      element.value = newText;
      break;
      
    case 'aria-label':
    case 'button-aria':
      // For ARIA labels
      element.setAttribute('aria-label', newText);
      break;
      
    case 'select-label':
      // For select labels (aria-label or title)
      if (element.hasAttribute('aria-label')) {
        element.setAttribute('aria-label', newText);
      } else if (element.hasAttribute('title')) {
        element.setAttribute('title', newText);
      }
      break;
      
    case 'button-text':
    case 'label':
      // For button text and labels, replace text content
      element.textContent = newText;
      break;
      
    case 'svg-text':
      // For SVG text elements
      element.textContent = newText;
      break;
      
    case 'shadow-dom':
      // For shadow DOM elements, treat like regular text
      replaceRegularTextContent(element, newText);
      break;
      
    case 'iframe':
      // For iframe content, treat like regular text
      replaceRegularTextContent(element, newText);
      break;
      
    default:
      // For standard DOM elements, replace only text nodes
      replaceRegularTextContent(element, newText);
      break;
  }
}

/**
 * Replace text content for regular DOM elements
 * @param {Element} element - Element to update
 * @param {string} newText - New text content
 */
function replaceRegularTextContent(element, newText) {
  // Find and replace only text nodes
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      node.textContent = newText;
      break; // Replace only the first text node
    }
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

/**
 * Send message to background with retry logic and timeout
 * @param {Object} message - Message to send
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise} Promise that resolves with response
 */
async function sendMessageWithRetry(message, maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if Chrome runtime is still available
      if (!chrome.runtime?.id) {
        throw new Error('Extension context invalidated');
      }
      
      // Send message with Chrome's built-in reliability
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || { success: false, error: 'No response received' });
          }
        });
      });
      
      return response;
      
    } catch (error) {
      lastError = error;
      console.warn(`Message attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // Don't retry for context invalidation errors
      if (error.message.includes('Extension context invalidated') || 
          error.message.includes('Receiving end does not exist') ||
          error.message.includes('message channel closed')) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }
  
  throw lastError || new Error('All message attempts failed');
}

/**
 * Check if the extension context is still valid
 * @returns {boolean} True if context is valid
 */
function isExtensionContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (error) {
    return false;
  }
}

/**
 * Handle start continuous translation message
 * @param {Object} message - Message with sourceLanguage and targetLanguage
 * @param {Function} sendResponse - Response callback
 */
async function handleStartContinuousTranslation(message, sendResponse) {
  try {
    const { sourceLanguage, targetLanguage } = message;
    
    // Enable continuous translation
    continuousTranslation.enabled = true;
    continuousTranslation.sourceLanguage = sourceLanguage;
    continuousTranslation.targetLanguage = targetLanguage;
    
    console.log(`🔄 Continuous translation started: ${sourceLanguage} → ${targetLanguage}`);
    
    // Clear any existing state from previous pages
    isTranslated = false;
    originalContent.clear();
    currentTranslation = null;
    
    // Stop any existing observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    // Check if continuous translation is still enabled (in case it was disabled during navigation)
    if (!continuousTranslation.enabled) {
      console.log('🛑 Continuous translation was disabled during startup');
      sendResponse({ success: false, error: 'Continuous translation disabled' });
      return;
    }
    
    // Perform initial translation of current page
    await handleTranslatePage(message, (response) => {
      // Translation complete, start observing for new elements
      if (response.success) {
        startObservingChanges();
        console.log('🔄 DOM observation started for continuous translation');
      }
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Failed to start continuous translation:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle stop continuous translation message
 * @param {Object} message - Message
 * @param {Function} sendResponse - Response callback
 */
function handleStopContinuousTranslation(message, sendResponse) {
  try {
    // Disable continuous translation
    continuousTranslation.enabled = false;
    
    // Stop observing DOM changes
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    console.log('🔄 Continuous translation stopped');
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Failed to stop continuous translation:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle update continuous language message
 * @param {Object} message - Message with new sourceLanguage and targetLanguage
 * @param {Function} sendResponse - Response callback
 */
async function handleUpdateContinuousLanguage(message, sendResponse) {
  try {
    const { sourceLanguage, targetLanguage } = message;
    
    // Update continuous translation languages
    continuousTranslation.sourceLanguage = sourceLanguage;
    continuousTranslation.targetLanguage = targetLanguage;
    
    console.log(`🔄 Continuous translation language updated: ${sourceLanguage} → ${targetLanguage}`);
    
    // If continuous translation is enabled, retranslate current page with new language
    if (continuousTranslation.enabled) {
      // Restore original content first
      restoreOriginalContent();
      
      // Wait a bit for restoration to complete
      await sleep(100);
      
      // Translate with new language
      await handleTranslatePage(message, () => {
        console.log('🔄 Page retranslated with new language');
      });
    }
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Failed to update continuous translation language:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Translate new elements in continuous mode
 * @param {Array} elements - New elements to translate
 */
async function translateNewElementsContinuous(elements) {
  try {
    await processBatch(
      elements, 
      continuousTranslation.sourceLanguage, 
      continuousTranslation.targetLanguage, 
      'CONTINUOUS', 
      1
    );
  } catch (error) {
    console.error('❌ Failed to translate new elements in continuous mode:', error);
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
  originalContent.clear();
  
  // Stop continuous translation on page unload
  continuousTranslation.enabled = false;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
} 