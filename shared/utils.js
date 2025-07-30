/**
 * @fileoverview Utility functions for AI Page Translator Chrome Extension
 * 
 * This file contains reusable helper functions that are used across multiple
 * components of the extension. Functions are organized by category for easy
 * navigation and maintenance.
 * 
 * @author AI Page Translator Team
 * @version 1.0.0
 */

import { DEBUG, PATTERNS, LANGUAGES, ERRORS } from './constants.js';

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Enhanced logging utility with different levels and timestamps
 * @namespace
 */
export const Logger = {
  /**
   * Log an error message
   * @param {string} message - The error message
   * @param {Error|Object} [error] - Optional error object
   * @param {string} [context] - Optional context for the error
   */
  error(message, error = null, context = '') {
    if (DEBUG.CURRENT_LOG_LEVEL >= DEBUG.LOG_LEVELS.ERROR) {
      const timestamp = new Date().toISOString();
      const prefix = `[ERROR ${timestamp}]${context ? ` [${context}]` : ''}`;
      console.error(prefix, message, error);
    }
  },

  /**
   * Log a warning message
   * @param {string} message - The warning message
   * @param {string} [context] - Optional context
   */
  warn(message, context = '') {
    if (DEBUG.CURRENT_LOG_LEVEL >= DEBUG.LOG_LEVELS.WARN) {
      const timestamp = new Date().toISOString();
      const prefix = `[WARN ${timestamp}]${context ? ` [${context}]` : ''}`;
      console.warn(prefix, message);
    }
  },

  /**
   * Log an info message
   * @param {string} message - The info message
   * @param {string} [context] - Optional context
   */
  info(message, context = '') {
    if (DEBUG.CURRENT_LOG_LEVEL >= DEBUG.LOG_LEVELS.INFO) {
      const timestamp = new Date().toISOString();
      const prefix = `[INFO ${timestamp}]${context ? ` [${context}]` : ''}`;
      console.info(prefix, message);
    }
  },

  /**
   * Log a debug message
   * @param {string} message - The debug message
   * @param {any} [data] - Optional data to log
   * @param {string} [context] - Optional context
   */
  debug(message, data = null, context = '') {
    if (DEBUG.CURRENT_LOG_LEVEL >= DEBUG.LOG_LEVELS.DEBUG) {
      const timestamp = new Date().toISOString();
      const prefix = `[DEBUG ${timestamp}]${context ? ` [${context}]` : ''}`;
      console.debug(prefix, message, data);
    }
  }
};

// =============================================================================
// PERFORMANCE UTILITIES
// =============================================================================

/**
 * Performance monitoring utilities
 * @namespace
 */
export const Performance = {
  /**
   * Measure the execution time of an async function
   * @param {string} operationName - Name of the operation being measured
   * @param {Function} asyncFunction - The async function to measure
   * @returns {Function} - Wrapped function with performance monitoring
   */
  measureAsync(operationName, asyncFunction) {
    return async (...args) => {
      if (!DEBUG.PERFORMANCE.ENABLE_TIMING) {
        return await asyncFunction(...args);
      }

      const startTime = performance.now();
      try {
        const result = await asyncFunction(...args);
        const duration = performance.now() - startTime;
        
        if (duration > DEBUG.PERFORMANCE.SLOW_OPERATION_THRESHOLD) {
          Logger.warn(`Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`, 'Performance');
        } else {
          Logger.debug(`${operationName} completed in ${duration.toFixed(2)}ms`, null, 'Performance');
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        Logger.error(`${operationName} failed after ${duration.toFixed(2)}ms`, error, 'Performance');
        throw error;
      }
    };
  },

  /**
   * Create a simple timer for measuring operations
   * @param {string} name - Name of the timer
   * @returns {Object} - Timer object with start and end methods
   */
  createTimer(name) {
    let startTime = null;
    
    return {
      start() {
        startTime = performance.now();
        Logger.debug(`Timer started: ${name}`, null, 'Performance');
      },
      
      end() {
        if (startTime === null) {
          Logger.warn(`Timer ${name} was not started`, 'Performance');
          return 0;
        }
        
        const duration = performance.now() - startTime;
        Logger.debug(`Timer ended: ${name} - ${duration.toFixed(2)}ms`, null, 'Performance');
        startTime = null;
        return duration;
      }
    };
  }
};

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Input validation utilities
 * @namespace
 */
export const Validator = {
  /**
   * Check if a string is a valid URL
   * @param {string} url - URL to validate
   * @returns {boolean} - True if valid URL
   */
  isValidUrl(url) {
    if (typeof url !== 'string' || !url.trim()) {
      return false;
    }
    return PATTERNS.URL.VALID_URL.test(url);
  },

  /**
   * Check if text content is valid for translation
   * @param {string} text - Text to validate
   * @returns {Object} - Validation result with isValid and reason
   */
  isValidTextForTranslation(text) {
    if (typeof text !== 'string') {
      return { isValid: false, reason: 'Text must be a string' };
    }

    const trimmedText = text.trim();
    
    if (!trimmedText) {
      return { isValid: false, reason: 'Text cannot be empty' };
    }

    if (trimmedText.length < 3) {
      return { isValid: false, reason: 'Text too short for translation' };
    }

    if (trimmedText.length > 50000) {
      return { isValid: false, reason: 'Text too long for translation' };
    }

    return { isValid: true, reason: null };
  },

  /**
   * Check if a language is supported
   * @param {string} language - Language name to check
   * @returns {boolean} - True if language is supported
   */
  isSupportedLanguage(language) {
    return LANGUAGES.SUPPORTED.includes(language);
  },

  /**
   * Validate Chrome extension message structure
   * @param {Object} message - Message object to validate
   * @param {string[]} requiredFields - Required fields in the message
   * @returns {Object} - Validation result
   */
  validateMessage(message, requiredFields = []) {
    if (!message || typeof message !== 'object') {
      return { isValid: false, reason: 'Message must be an object' };
    }

    if (!message.action) {
      return { isValid: false, reason: 'Message must have an action field' };
    }

    for (const field of requiredFields) {
      if (!(field in message)) {
        return { isValid: false, reason: `Missing required field: ${field}` };
      }
    }

    return { isValid: true, reason: null };
  }
};

// =============================================================================
// TEXT PROCESSING UTILITIES
// =============================================================================

/**
 * Text processing and manipulation utilities
 * @namespace
 */
export const TextProcessor = {
  /**
   * Clean and normalize text content
   * @param {string} text - Text to clean
   * @returns {string} - Cleaned text
   */
  cleanText(text) {
    if (typeof text !== 'string') {
      return '';
    }

    return text
      .replace(PATTERNS.TEXT.CONTROL_CHARS, '') // Remove control characters
      .replace(PATTERNS.TEXT.WHITESPACE_NORMALIZE, ' ') // Normalize whitespace
      .trim();
  },

  /**
   * Split text into sentences for processing
   * @param {string} text - Text to split
   * @returns {string[]} - Array of sentences
   */
  splitIntoSentences(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    return text
      .split(PATTERNS.TEXT.SENTENCE_SPLIT)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  },

  /**
   * Split long text into chunks for API processing
   * @param {string} text - Text to chunk
   * @param {number} maxLength - Maximum length per chunk
   * @returns {string[]} - Array of text chunks
   */
  chunkText(text, maxLength = 2000) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    if (text.length <= maxLength) {
      return [text];
    }

    const chunks = [];
    const sentences = this.splitIntoSentences(text);
    let currentChunk = '';

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length > maxLength && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk = potentialChunk;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  },

  /**
   * Extract domain from URL
   * @param {string} url - URL to extract domain from
   * @returns {string} - Extracted domain or 'Unknown'
   */
  extractDomain(url) {
    try {
      const match = url.match(PATTERNS.URL.DOMAIN_EXTRACT);
      return match ? match[1] : 'Unknown';
    } catch (error) {
      Logger.error('Failed to extract domain from URL', error, 'TextProcessor');
      return 'Unknown';
    }
  },

  /**
   * Truncate text to a specified length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @param {string} suffix - Suffix to add (default: '...')
   * @returns {string} - Truncated text
   */
  truncate(text, maxLength, suffix = '...') {
    if (!text || typeof text !== 'string') {
      return '';
    }

    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength - suffix.length) + suffix;
  }
};

// =============================================================================
// LANGUAGE UTILITIES
// =============================================================================

/**
 * Language-related utility functions
 * @namespace
 */
export const LanguageUtils = {
  /**
   * Get language code from language name
   * @param {string} languageName - Full language name
   * @returns {string} - Language code or fallback
   */
  getLanguageCode(languageName) {
    return LANGUAGES.CODES[languageName] || LANGUAGES.DEFAULTS.FALLBACK;
  },

  /**
   * Get language name from language code
   * @param {string} languageCode - Language code
   * @returns {string} - Language name or fallback
   */
  getLanguageName(languageCode) {
    const codeToName = Object.entries(LANGUAGES.CODES)
      .reduce((acc, [name, code]) => {
        const shortCode = code.split('-')[0];
        acc[shortCode] = name;
        acc[code] = name;
        return acc;
      }, {});

    return codeToName[languageCode] || LANGUAGES.DEFAULTS.TARGET;
  },

  /**
   * Check if browser supports a specific language for TTS
   * @param {string} languageCode - Language code to check
   * @returns {boolean} - True if supported
   */
  isTTSLanguageSupported(languageCode) {
    if (!window.speechSynthesis) {
      return false;
    }

    try {
      const voices = speechSynthesis.getVoices();
      return voices.some(voice => voice.lang.startsWith(languageCode.split('-')[0]));
    } catch (error) {
      Logger.error('Failed to check TTS language support', error, 'LanguageUtils');
      return false;
    }
  }
};

// =============================================================================
// CHROME EXTENSION UTILITIES
// =============================================================================

/**
 * Chrome extension specific utilities
 * @namespace
 */
export const ChromeUtils = {
  /**
   * Send a message with error handling and timeout
   * @param {Object} message - Message to send
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - Response or error
   */
  async sendMessage(message, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timer);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  },

  /**
   * Get the active tab safely
   * @returns {Promise<Object|null>} - Active tab or null
   */
  async getActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab || null;
    } catch (error) {
      Logger.error('Failed to get active tab', error, 'ChromeUtils');
      return null;
    }
  },

  /**
   * Save data to Chrome storage with error handling
   * @param {Object} data - Data to save
   * @param {string} storageType - 'sync' or 'local'
   * @returns {Promise<boolean>} - Success status
   */
  async saveToStorage(data, storageType = 'sync') {
    try {
      await chrome.storage[storageType].set(data);
      Logger.debug('Data saved to storage', data, 'ChromeUtils');
      return true;
    } catch (error) {
      Logger.error('Failed to save to storage', error, 'ChromeUtils');
      return false;
    }
  },

  /**
   * Load data from Chrome storage with error handling
   * @param {string|string[]} keys - Keys to load
   * @param {string} storageType - 'sync' or 'local'
   * @returns {Promise<Object|null>} - Loaded data or null
   */
  async loadFromStorage(keys, storageType = 'sync') {
    try {
      const result = await chrome.storage[storageType].get(keys);
      Logger.debug('Data loaded from storage', result, 'ChromeUtils');
      return result;
    } catch (error) {
      Logger.error('Failed to load from storage', error, 'ChromeUtils');
      return null;
    }
  }
};

// =============================================================================
// DOM UTILITIES
// =============================================================================

/**
 * DOM manipulation utilities
 * @namespace
 */
export const DOMUtils = {
  /**
   * Safely query selector with error handling
   * @param {string} selector - CSS selector
   * @param {Element} parent - Parent element (default: document)
   * @returns {Element|null} - Found element or null
   */
  safeQuerySelector(selector, parent = document) {
    try {
      return parent.querySelector(selector);
    } catch (error) {
      Logger.error('Invalid selector', error, 'DOMUtils');
      return null;
    }
  },

  /**
   * Safely query all elements with error handling
   * @param {string} selector - CSS selector
   * @param {Element} parent - Parent element (default: document)
   * @returns {Element[]} - Array of found elements
   */
  safeQuerySelectorAll(selector, parent = document) {
    try {
      return Array.from(parent.querySelectorAll(selector));
    } catch (error) {
      Logger.error('Invalid selector', error, 'DOMUtils');
      return [];
    }
  },

  /**
   * Check if element is visible in viewport
   * @param {Element} element - Element to check
   * @returns {boolean} - True if visible
   */
  isElementVisible(element) {
    if (!element || !element.getBoundingClientRect) {
      return false;
    }

    try {
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0
      );
    } catch (error) {
      Logger.error('Failed to check element visibility', error, 'DOMUtils');
      return false;
    }
  },

  /**
   * Add CSS class with error handling
   * @param {Element} element - Element to modify
   * @param {string} className - Class name to add
   * @returns {boolean} - Success status
   */
  addClass(element, className) {
    try {
      if (element && element.classList) {
        element.classList.add(className);
        return true;
      }
      return false;
    } catch (error) {
      Logger.error('Failed to add CSS class', error, 'DOMUtils');
      return false;
    }
  },

  /**
   * Remove CSS class with error handling
   * @param {Element} element - Element to modify
   * @param {string} className - Class name to remove
   * @returns {boolean} - Success status
   */
  removeClass(element, className) {
    try {
      if (element && element.classList) {
        element.classList.remove(className);
        return true;
      }
      return false;
    } catch (error) {
      Logger.error('Failed to remove CSS class', error, 'DOMUtils');
      return false;
    }
  }
};

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Error handling and user feedback utilities
 * @namespace
 */
export const ErrorHandler = {
  /**
   * Get user-friendly error message
   * @param {Error|string} error - Error object or message
   * @param {string} context - Context where error occurred
   * @returns {string} - User-friendly error message
   */
  getUserFriendlyMessage(error, context = '') {
    let errorMessage = '';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = 'Unknown error occurred';
    }

    // Map common error patterns to user-friendly messages
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return ERRORS.GENERIC.NETWORK;
    }
    
    if (errorMessage.includes('timeout')) {
      return ERRORS.GENERIC.TIMEOUT;
    }
    
    if (errorMessage.includes('permission')) {
      return ERRORS.GENERIC.PERMISSION_DENIED;
    }

    // Context-specific error mapping
    if (context === 'translation') {
      if (errorMessage.includes('already in progress')) {
        return ERRORS.TRANSLATION.ALREADY_IN_PROGRESS;
      }
      if (errorMessage.includes('no content')) {
        return ERRORS.TRANSLATION.NO_CONTENT;
      }
      return ERRORS.TRANSLATION.TRANSLATION_FAILED;
    }

    if (context === 'speech') {
      if (errorMessage.includes('not supported')) {
        return ERRORS.SPEECH.NOT_SUPPORTED;
      }
      return ERRORS.SPEECH.SYNTHESIS_FAILED;
    }

    return ERRORS.GENERIC.UNKNOWN;
  },

  /**
   * Create standardized error object
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {string} context - Context where error occurred
   * @param {Error} [originalError] - Original error object
   * @returns {Object} - Standardized error object
   */
  createError(message, code, context, originalError = null) {
    return {
      message,
      code,
      context,
      timestamp: new Date().toISOString(),
      originalError: originalError ? originalError.toString() : null,
      userMessage: this.getUserFriendlyMessage(message, context)
    };
  }
};

// =============================================================================
// ASYNC UTILITIES
// =============================================================================

/**
 * Async operation utilities
 * @namespace
 */
export const AsyncUtils = {
  /**
   * Wait for a specified amount of time
   * @param {number} milliseconds - Time to wait
   * @returns {Promise} - Resolves after the specified time
   */
  sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  },

  /**
   * Retry an async operation with exponential backoff
   * @param {Function} asyncFunction - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise} - Result of the async function
   */
  async retryWithBackoff(asyncFunction, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await asyncFunction();
      } catch (error) {
        lastError = error;
        Logger.warn(`Attempt ${attempt}/${maxRetries} failed`, 'AsyncUtils');

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          Logger.debug(`Waiting ${delay}ms before retry`, null, 'AsyncUtils');
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  },

  /**
   * Run multiple async operations with a timeout
   * @param {Promise} promise - Promise to run
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} timeoutMessage - Message for timeout error
   * @returns {Promise} - Result or timeout error
   */
  withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
};

// =============================================================================
// EXPORT ALL UTILITIES
// =============================================================================

/**
 * Default export containing all utility namespaces
 */
export default {
  Logger,
  Performance,
  Validator,
  TextProcessor,
  LanguageUtils,
  ChromeUtils,
  DOMUtils,
  ErrorHandler,
  AsyncUtils
}; 