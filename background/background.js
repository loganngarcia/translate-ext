/**
 * @fileoverview Background Service Worker for AI Page Translator Chrome Extension
 * 
 * This service worker acts as the central coordinator for the extension. It handles:
 * - Inter-script communication between sidepanel and content scripts
 * - AWS API integration for translation and summarization
 * - Translation state management across tabs
 * - Caching and performance optimization
 * - Error handling and retry logic
 * - Tab lifecycle management
 * 
 * Architecture:
 * - APIManager: Handles all AWS API communications
 * - StateManager: Manages translation states across tabs
 * - CacheManager: Handles translation caching and cleanup
 * - MessageRouter: Routes messages between different extension components
 * - ErrorHandler: Centralized error handling and reporting
 * 
 * @author AI Page Translator Team
 * @version 1.0.0
 */

// =============================================================================
// CONSTANTS AND CONFIGURATION
// =============================================================================

/**
 * Configuration constants for the background script
 * @const {Object}
 */
const CONFIG = {
  // AWS API configuration
  API: {
    BASE_URL: 'https://xqcgj6knsd.execute-api.us-west-2.amazonaws.com/dev',
    ENDPOINTS: {
      TRANSLATE: '/translate',
      SUMMARIZE: '/summarize',
      DETECT_LANGUAGE: '/detect-language'
    },
    TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000 // milliseconds
  },

  // AWS Nova-lite model settings
  NOVA: {
    MODEL_ID: 'us.amazon.nova-lite-v1:0',
    MAX_TOKENS: 4000,
    TEMPERATURE: 0.3
  },

  // Cache configuration
  CACHE: {
    MAX_ENTRIES: 50,
    EXPIRY_HOURS: 24,
    CLEANUP_INTERVAL: 3600000 // 1 hour in milliseconds
  },

  // Message types for routing
  MESSAGES: {
    TRANSLATE_PAGE: 'translatePage',
    PROCESS_TRANSLATION: 'processTranslation',
    TRANSLATE_TEXT: 'translateText',
    UPDATE_SUMMARY: 'updateSummary',
    TRANSLATION_STARTED: 'translationStarted',
    TRANSLATION_COMPLETE: 'translationComplete',
    TRANSLATION_ERROR: 'translationError',
    PAGE_CONTENT_EXTRACTED: 'pageContentExtracted',
    CONTENT_SCRIPT_ERROR: 'contentScriptError',
    TOGGLE_TRANSLATION: 'toggleTranslation',
    RESTORE_ORIGINAL: 'restoreOriginal',
    START_CONTINUOUS_TRANSLATION: 'startContinuousTranslation',
    STOP_CONTINUOUS_TRANSLATION: 'stopContinuousTranslation',
    UPDATE_CONTINUOUS_LANGUAGE: 'updateContinuousLanguage',
    SIDEPANEL_CLOSED: 'sidepanelClosed',
    GENERATE_SUMMARY: 'generateSummary',
    STREAM_TRANSLATION_CHUNK: 'streamTranslationChunk',
    STREAM_SUMMARY_CHUNK: 'streamSummaryChunk'
  },

  // Error types
  ERROR_TYPES: {
    NETWORK: 'network',
    API: 'api',
    TIMEOUT: 'timeout',
    RATE_LIMIT: 'rate_limit',
    VALIDATION: 'validation',
    UNKNOWN: 'unknown'
  },

  // Performance monitoring
  PERFORMANCE: {
    ENABLE_TIMING: true,
    SLOW_OPERATION_THRESHOLD: 5000 // 5 seconds
  }
};

// =============================================================================
// LOGGING UTILITY
// =============================================================================

/**
 * Enhanced logging utility for background script
 * @namespace
 */
const Logger = {
  /**
   * Log levels
   */
  levels: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  },

  /**
   * Current log level (can be adjusted for development)
   */
  currentLevel: 2, // INFO level

  /**
   * Log an error message with context
   * @param {string} message - Error message
   * @param {Error|Object} [error] - Error object
   * @param {string} [context] - Context identifier
   */
  error(message, error = null, context = '') {
    if (this.currentLevel >= this.levels.ERROR) {
      const timestamp = new Date().toISOString();
      const prefix = `[ERROR ${timestamp}]${context ? ` [${context}]` : ''}`;
      console.error(prefix, message, error);
    }
  },

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {string} [context] - Context identifier
   */
  warn(message, context = '') {
    if (this.currentLevel >= this.levels.WARN) {
      const timestamp = new Date().toISOString();
      const prefix = `[WARN ${timestamp}]${context ? ` [${context}]` : ''}`;
      console.warn(prefix, message);
    }
  },

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {string} [context] - Context identifier
   */
  info(message, context = '') {
    if (this.currentLevel >= this.levels.INFO) {
      const timestamp = new Date().toISOString();
      const prefix = `[INFO ${timestamp}]${context ? ` [${context}]` : ''}`;
      console.info(prefix, message);
    }
  },

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {any} [data] - Additional data to log
   * @param {string} [context] - Context identifier
   */
  debug(message, data = null, context = '') {
    if (this.currentLevel >= this.levels.DEBUG) {
      const timestamp = new Date().toISOString();
      const prefix = `[DEBUG ${timestamp}]${context ? ` [${context}]` : ''}`;
      console.debug(prefix, message, data);
    }
  }
};

// =============================================================================
// STATE MANAGER
// =============================================================================

/**
 * Manages translation states across tabs and sessions
 * @class
 */
class StateManager {
  /**
   * Initialize the state manager
   */
  constructor() {
    /** @type {Map<number, Object>} Active translation states by tab ID */
    this.activeTranslations = new Map();
    
    /** @type {Map<string, number>} Rate limit reset times by endpoint */
    this.rateLimitResets = new Map();
    
    /** @type {Set<number>} Tabs with active content scripts */
    this.activeTabs = new Set();
  }

  /**
   * Get translation state for a specific tab
   * @param {number} tabId - Tab ID
   * @returns {Object|null} Translation state or null
   */
  getTranslationState(tabId) {
    return this.activeTranslations.get(tabId) || null;
  }

  /**
   * Set translation state for a tab
   * @param {number} tabId - Tab ID
   * @param {Object} state - Translation state object
   */
  setTranslationState(tabId, state) {
    const existingState = this.activeTranslations.get(tabId) || {};
    const newState = {
      ...existingState,
      ...state,
      lastUpdated: Date.now()
    };
    
    this.activeTranslations.set(tabId, newState);
    Logger.debug(`Translation state updated for tab ${tabId}`, newState, 'StateManager');
  }

  /**
   * Check if continuous translation is enabled for a tab
   * @param {number} tabId - Tab ID
   * @returns {boolean} True if continuous translation is enabled
   */
  isContinuousTranslationEnabled(tabId) {
    const state = this.activeTranslations.get(tabId);
    return state && state.continuousTranslation === true;
  }

  /**
   * Enable continuous translation for a tab
   * @param {number} tabId - Tab ID
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   */
  enableContinuousTranslation(tabId, sourceLanguage, targetLanguage) {
    this.setTranslationState(tabId, {
      continuousTranslation: true,
      sourceLanguage,
      targetLanguage,
      continuousStartTime: Date.now()
    });
    Logger.info(`Continuous translation enabled for tab ${tabId}: ${sourceLanguage} → ${targetLanguage}`, 'StateManager');
  }

  /**
   * Disable continuous translation for a tab
   * @param {number} tabId - Tab ID
   */
  disableContinuousTranslation(tabId) {
    const state = this.activeTranslations.get(tabId);
    if (state) {
      this.setTranslationState(tabId, {
        continuousTranslation: false,
        continuousStartTime: null
      });
      Logger.info(`Continuous translation disabled for tab ${tabId}`, 'StateManager');
    }
  }

  /**
   * Update continuous translation language for a tab
   * @param {number} tabId - Tab ID
   * @param {string} sourceLanguage - New source language
   * @param {string} targetLanguage - New target language
   */
  updateContinuousLanguage(tabId, sourceLanguage, targetLanguage) {
    const state = this.activeTranslations.get(tabId);
    if (state && state.continuousTranslation) {
      this.setTranslationState(tabId, {
        sourceLanguage,
        targetLanguage
      });
      Logger.info(`Continuous translation language updated for tab ${tabId}: ${sourceLanguage} → ${targetLanguage}`, 'StateManager');
    }
  }

  /**
   * Check if translation is in progress for a tab
   * @param {number} tabId - Tab ID
   * @returns {boolean} True if translation is in progress
   */
  isTranslationInProgress(tabId) {
    const state = this.activeTranslations.get(tabId);
    return state && state.isTranslating === true;
  }

  /**
   * Clear translation state for a tab
   * @param {number} tabId - Tab ID
   */
  clearTranslationState(tabId) {
    this.activeTranslations.delete(tabId);
    this.activeTabs.delete(tabId);
    Logger.debug(`Translation state cleared for tab ${tabId}`, null, 'StateManager');
  }

  /**
   * Set rate limit reset time for an endpoint
   * @param {string} endpoint - API endpoint
   * @param {number} resetTime - Reset time as Unix timestamp
   */
  setRateLimitReset(endpoint, resetTime) {
    this.rateLimitResets.set(endpoint, resetTime);
    Logger.warn(`Rate limit set for ${endpoint}, resets at ${new Date(resetTime * 1000)}`, 'StateManager');
  }

  /**
   * Check if an endpoint is currently rate limited
   * @param {string} endpoint - API endpoint
   * @returns {boolean} True if rate limited
   */
  isRateLimited(endpoint) {
    const resetTime = this.rateLimitResets.get(endpoint);
    if (!resetTime) return false;
    
    const isLimited = Date.now() < (resetTime * 1000);
    if (!isLimited) {
      // Clean up expired rate limit
      this.rateLimitResets.delete(endpoint);
    }
    
    return isLimited;
  }

  /**
   * Mark a tab as having an active content script
   * @param {number} tabId - Tab ID
   */
  markTabActive(tabId) {
    this.activeTabs.add(tabId);
  }

  /**
   * Check if a tab has an active content script
   * @param {number} tabId - Tab ID
   * @returns {boolean} True if tab is active
   */
  isTabActive(tabId) {
    return this.activeTabs.has(tabId);
  }

  /**
   * Get statistics about current state
   * @returns {Object} State statistics
   */
  getStatistics() {
    return {
      activeTranslations: this.activeTranslations.size,
      rateLimitedEndpoints: this.rateLimitResets.size,
      activeTabs: this.activeTabs.size,
      oldestTranslation: this.getOldestTranslationAge()
    };
  }

  /**
   * Get age of oldest active translation in milliseconds
   * @returns {number} Age in milliseconds or 0 if none
   * @private
   */
  getOldestTranslationAge() {
    let oldestTime = Date.now();
    for (const state of this.activeTranslations.values()) {
      if (state.startTime && state.startTime < oldestTime) {
        oldestTime = state.startTime;
      }
    }
    return this.activeTranslations.size > 0 ? Date.now() - oldestTime : 0;
  }

  /**
   * Clean up old or stale states
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    // Clean up old translation states
    for (const [tabId, state] of this.activeTranslations.entries()) {
      if (state.lastUpdated && (now - state.lastUpdated) > maxAge) {
        this.clearTranslationState(tabId);
        Logger.debug(`Cleaned up stale translation state for tab ${tabId}`, null, 'StateManager');
      }
    }

    // Clean up expired rate limits
    for (const [endpoint, resetTime] of this.rateLimitResets.entries()) {
      if (now >= (resetTime * 1000)) {
        this.rateLimitResets.delete(endpoint);
        Logger.debug(`Cleaned up expired rate limit for ${endpoint}`, null, 'StateManager');
      }
    }
  }

  /**
   * Reset all state (useful for testing or emergency reset)
   */
  reset() {
    this.activeTranslations.clear();
    this.rateLimitResets.clear();
    this.activeTabs.clear();
    Logger.info('State manager reset', 'StateManager');
  }
}

// =============================================================================
// CACHE MANAGER
// =============================================================================

/**
 * Manages translation caching for performance optimization
 * Enhanced with persistent Chrome storage for cross-session caching
 * @class
 */
class CacheManager {
  /**
   * Initialize the cache manager
   */
  constructor() {
    /** @type {Map<string, Object>} In-memory cache for fast access */
    this.memoryCache = new Map();
    
    /** @type {string} Chrome storage key for translation cache */
    this.storageKey = 'translationCache';
    
    /** @type {number} Cleanup interval ID */
    this.cleanupInterval = null;
    
    /** @type {boolean} Whether storage is available */
    this.storageAvailable = true;
    
    this.startCleanupInterval();
    this.loadFromStorage();
    
    Logger.info('CacheManager initialized with persistent storage', 'CacheManager');
  }

  /**
   * Load cache from Chrome storage into memory
   * @private
   */
  async loadFromStorage() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const storedCache = result[this.storageKey];
      
      if (storedCache) {
        // Convert stored cache back to Map and validate entries
        const now = Date.now();
        const maxAge = CONFIG.CACHE.EXPIRY_HOURS * 60 * 60 * 1000;
        let loadedCount = 0;
        let expiredCount = 0;
        
        for (const [key, entry] of Object.entries(storedCache)) {
          if (now - entry.timestamp <= maxAge) {
            this.memoryCache.set(key, entry);
            loadedCount++;
          } else {
            expiredCount++;
          }
        }
        
        Logger.info(`Loaded ${loadedCount} cached translations from storage (${expiredCount} expired)`, 'CacheManager');
        
        // Save cleaned cache back to storage if we removed expired entries
        if (expiredCount > 0) {
          this.saveToStorage();
        }
      } else {
        Logger.info('No cached translations found in storage', 'CacheManager');
      }
    } catch (error) {
      Logger.error('Failed to load cache from storage', error, 'CacheManager');
      this.storageAvailable = false;
    }
  }

  /**
   * Save current memory cache to Chrome storage
   * @private
   */
  async saveToStorage() {
    if (!this.storageAvailable) return;
    
    try {
      // Convert Map to plain object for storage
      const cacheObject = Object.fromEntries(this.memoryCache);
      
      await chrome.storage.local.set({
        [this.storageKey]: cacheObject
      });
      
      Logger.debug(`Saved ${this.memoryCache.size} translations to storage`, null, 'CacheManager');
    } catch (error) {
      Logger.error('Failed to save cache to storage', error, 'CacheManager');
      this.storageAvailable = false;
    }
  }

  /**
   * Generate cache key for content and language pair
   * @param {string} content - Content to translate
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @returns {string} Cache key
   */
  generateCacheKey(content, sourceLanguage, targetLanguage) {
    // Create a shorter, more efficient key
    const contentHash = this.simpleHash(content.substring(0, 200)); // Use first 200 chars for hash
    const langKey = `${sourceLanguage}-${targetLanguage}`;
    return `${langKey}:${contentHash}`;
  }

  /**
   * Simple hash function for cache keys
   * @param {string} str - String to hash
   * @returns {string} Hash value
   * @private
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached translation result
   * @param {string} content - Content that was translated
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @returns {Object|null} Cached result or null
   */
  get(content, sourceLanguage, targetLanguage) {
    const key = this.generateCacheKey(content, sourceLanguage, targetLanguage);
    const cached = this.memoryCache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    const age = Date.now() - cached.timestamp;
    const maxAge = CONFIG.CACHE.EXPIRY_HOURS * 60 * 60 * 1000;
    
    if (age > maxAge) {
      this.memoryCache.delete(key);
      // Async save to storage (don't wait)
      this.saveToStorage().catch(error => 
        Logger.error('Failed to save cache after expiry cleanup', error, 'CacheManager')
      );
      Logger.debug(`Cache entry expired and removed: ${key}`, null, 'CacheManager');
      return null;
    }

    // Update access count and timestamp for LRU tracking
    cached.accessCount = (cached.accessCount || 0) + 1;
    cached.lastAccessed = Date.now();

    Logger.debug(`Cache hit for key: ${key}`, null, 'CacheManager');
    return cached.data;
  }

  /**
   * Store translation result in cache
   * @param {string} content - Content that was translated
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @param {Object} result - Translation result to cache
   */
  async set(content, sourceLanguage, targetLanguage, result) {
    const key = this.generateCacheKey(content, sourceLanguage, targetLanguage);
    
    // Ensure we don't exceed cache size limit
    if (this.memoryCache.size >= CONFIG.CACHE.MAX_ENTRIES) {
      this.evictOldestEntries();
    }

    const cacheEntry = {
      data: result,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      contentLength: content.length
    };

    this.memoryCache.set(key, cacheEntry);
    Logger.debug(`Translation cached with key: ${key}`, null, 'CacheManager');
    
    // Async save to storage (don't wait to avoid blocking)
    this.saveToStorage().catch(error => 
      Logger.error('Failed to save cache to storage', error, 'CacheManager')
    );
  }

  /**
   * Evict oldest cache entries to make room for new ones
   * Uses LRU (Least Recently Used) strategy
   * @private
   */
  evictOldestEntries() {
    const entries = Array.from(this.memoryCache.entries());
    
    // Sort by last accessed time (LRU)
    entries.sort((a, b) => (a[1].lastAccessed || a[1].timestamp) - (b[1].lastAccessed || b[1].timestamp));
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(CONFIG.CACHE.MAX_ENTRIES * 0.2);
    for (let i = 0; i < toRemove && entries.length > 0; i++) {
      const [key] = entries[i];
      this.memoryCache.delete(key);
    }
    
    Logger.debug(`Evicted ${toRemove} old cache entries using LRU strategy`, null, 'CacheManager');
  }

  /**
   * Start automatic cache cleanup interval
   * @private
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CONFIG.CACHE.CLEANUP_INTERVAL);
    
    Logger.debug('Cache cleanup interval started', null, 'CacheManager');
  }

  /**
   * Clean up expired cache entries and save to storage
   */
  async cleanup() {
    const now = Date.now();
    const maxAge = CONFIG.CACHE.EXPIRY_HOURS * 60 * 60 * 1000;
    let removedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.memoryCache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      Logger.debug(`Cleaned up ${removedCount} expired cache entries`, null, 'CacheManager');
      // Save cleaned cache to storage
      await this.saveToStorage();
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStatistics() {
    const entries = Array.from(this.memoryCache.values());
    const totalSize = entries.length;
    const averageAge = totalSize > 0 
      ? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / totalSize
      : 0;
    
    const totalContentLength = entries.reduce((sum, entry) => sum + (entry.contentLength || 0), 0);
    const totalAccessCount = entries.reduce((sum, entry) => sum + (entry.accessCount || 0), 0);

    return {
      totalEntries: totalSize,
      maxEntries: CONFIG.CACHE.MAX_ENTRIES,
      utilizationPercent: Math.round((totalSize / CONFIG.CACHE.MAX_ENTRIES) * 100),
      averageAgeMs: Math.round(averageAge),
      totalContentLength,
      totalAccessCount,
      storageAvailable: this.storageAvailable
    };
  }

  /**
   * Clear all cache entries from memory and storage
   */
  async clear() {
    this.memoryCache.clear();
    
    if (this.storageAvailable) {
      try {
        await chrome.storage.local.remove([this.storageKey]);
        Logger.info('Translation cache cleared from memory and storage', 'CacheManager');
      } catch (error) {
        Logger.error('Failed to clear cache from storage', error, 'CacheManager');
      }
    } else {
      Logger.info('Translation cache cleared from memory only', 'CacheManager');
    }
  }

  /**
   * Stop cleanup interval and save final state
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Save final state to storage
    await this.saveToStorage();
    
    Logger.info('CacheManager shutdown completed', 'CacheManager');
  }
}

// =============================================================================
// API MANAGER
// =============================================================================

/**
 * Manages all AWS API communications with retry logic and error handling
 * @class
 */
class APIManager {
  /**
   * Initialize the API manager
   * @param {StateManager} stateManager - State manager instance
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Make an API call with retry logic and error handling
   * @param {string} endpoint - API endpoint (e.g., '/translate')
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   */
  async makeAPICall(endpoint, data) {
    const fullUrl = CONFIG.API.BASE_URL + endpoint;
    
    // Check for rate limiting
    if (this.stateManager.isRateLimited(endpoint)) {
      throw new Error(`API endpoint ${endpoint} is rate limited`);
    }

    Logger.debug(`Making API call to ${endpoint}`, data, 'APIManager');

    for (let attempt = 1; attempt <= CONFIG.API.MAX_RETRIES; attempt++) {
      try {
        const response = await this.makeRequest(fullUrl, data, attempt);
        Logger.debug(`API call successful after ${attempt} attempt(s)`, null, 'APIManager');
        return response;
      } catch (error) {
        Logger.warn(`API call attempt ${attempt}/${CONFIG.API.MAX_RETRIES} failed: ${error.message}`, 'APIManager');
        
        // Handle rate limiting
        if (error.status === 429) {
          const resetTime = this.extractRateLimitReset(error.headers);
          if (resetTime) {
            this.stateManager.setRateLimitReset(endpoint, resetTime);
          }
        }

        // If this is the last attempt, throw the error
        if (attempt === CONFIG.API.MAX_RETRIES) {
          throw this.createAPIError(error, endpoint, attempt);
        }

        // Wait before retrying (exponential backoff)
        const delay = CONFIG.API.RETRY_DELAY * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Make a single HTTP request
   * @param {string} url - Request URL
   * @param {Object} data - Request data
   * @param {number} attempt - Attempt number (for logging)
   * @returns {Promise<Object>} Response data
   * @private
   */
  async makeRequest(url, data, attempt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.headers = response.headers;
        throw error;
      }

      const result = await response.json();
      
      if (result.success === false) {
        throw new Error(result.error || 'API request failed');
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Extract rate limit reset time from response headers
   * @param {Headers} headers - Response headers
   * @returns {number|null} Reset time as Unix timestamp or null
   * @private
   */
  extractRateLimitReset(headers) {
    const resetHeader = headers?.get('X-RateLimit-Reset');
    return resetHeader ? parseInt(resetHeader, 10) : null;
  }

  /**
   * Create a standardized API error object
   * @param {Error} originalError - Original error
   * @param {string} endpoint - API endpoint
   * @param {number} attempts - Number of attempts made
   * @returns {Error} Standardized error
   * @private
   */
  createAPIError(originalError, endpoint, attempts) {
    const error = new Error(`API call to ${endpoint} failed after ${attempts} attempts: ${originalError.message}`);
    error.originalError = originalError;
    error.endpoint = endpoint;
    error.attempts = attempts;
    error.type = CONFIG.ERROR_TYPES.API;
    
    if (originalError.message.includes('timeout')) {
      error.type = CONFIG.ERROR_TYPES.TIMEOUT;
    } else if (originalError.message.includes('network') || originalError.message.includes('fetch')) {
      error.type = CONFIG.ERROR_TYPES.NETWORK;
    } else if (originalError.status === 429) {
      error.type = CONFIG.ERROR_TYPES.RATE_LIMIT;
    }
    
    return error;
  }

  /**
   * Sleep for a specified number of milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after the delay
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Translate content using AWS Nova model
   * @param {string|Array} content - Content to translate (single string or array of strings)
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @returns {Promise<Object>} Translation result with translations object
   */
  async translateContent(content, sourceLanguage, targetLanguage) {
    // Handle both single strings and arrays of strings
    const textToTranslate = Array.isArray(content) ? content.join('\n---SEPARATOR---\n') : content;
    
    const requestData = {
      action: 'translate',
      content: textToTranslate,
      sourceLanguage,
      targetLanguage,
      model: CONFIG.NOVA.MODEL_ID
    };

    const response = await this.makeAPICall(CONFIG.API.ENDPOINTS.TRANSLATE, requestData);
    
    // If we sent an array, we need to split the response back
    if (Array.isArray(content) && response.translations) {
      const combinedTranslations = {};
      const originalTexts = content;
      
      // Map individual texts to their translations
      originalTexts.forEach(originalText => {
        // Try to find the translation for this specific text
        const translation = response.translations[originalText] || 
                           response.translations[originalText.trim()] ||
                           originalText; // Fallback to original if not found
        combinedTranslations[originalText] = translation;
      });
      
      return { success: true, translations: combinedTranslations };
    }
    
    return { success: true, translations: response.translations || {}, translatedText: response.translations?.[content] || content };
  }

  /**
   * Generate summary using the summarization API
   * @param {string} content - Content to summarize
   * @param {string} targetLanguage - Target language for summary
   * @param {string} pageUrl - URL of the page being summarized
   * @returns {Promise<Object>} Summary result
   */
  async generateSummary(content, targetLanguage, pageUrl) {
    const requestData = {
      action: 'summarize',
      content,
      targetLanguage,
      pageUrl,
      model: CONFIG.NOVA.MODEL_ID
    };

    const response = await this.makeAPICall(CONFIG.API.ENDPOINTS.SUMMARIZE, requestData);
    return response.summary || {
      title: 'Summary not available',
      points: [
        { emoji: '📄', text: 'Unable to generate summary at this time.' }
      ]
    };
  }

  /**
   * Detect language of content
   * @param {string} content - Content to analyze
   * @returns {Promise<string>} Detected language
   */
  async detectLanguage(content) {
    const requestData = {
      action: 'detect-language',
      content: content.substring(0, 1000) // Limit content for detection
    };

    try {
      const response = await this.makeAPICall(CONFIG.API.ENDPOINTS.DETECT_LANGUAGE, requestData);
      return response.detectedLanguage || 'Unknown';
    } catch (error) {
      Logger.error('Language detection failed', error, 'APIManager');
      return 'Unknown';
    }
  }
}

// =============================================================================
// MESSAGE ROUTER
// =============================================================================

/**
 * Routes messages between different extension components
 * @class
 */
class MessageRouter {
  /**
   * Initialize the message router
   * @param {StateManager} stateManager - State manager instance
   * @param {CacheManager} cacheManager - Cache manager instance
   * @param {APIManager} apiManager - API manager instance
   */
  constructor(stateManager, cacheManager, apiManager) {
    this.stateManager = stateManager;
    this.cacheManager = cacheManager;
    this.apiManager = apiManager;
    
    this.setupMessageListener();
  }

  /**
   * Set up the main message listener
   * @private
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.routeMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    Logger.info('Message router initialized', 'MessageRouter');
  }

  /**
   * Route incoming messages to appropriate handlers
   * @param {Object} message - Incoming message
   * @param {Object} sender - Message sender information
   * @param {Function} sendResponse - Response callback
   * @private
   */
  async routeMessage(message, sender, sendResponse) {
    try {
      Logger.debug(`Routing message: ${message.action}`, message, 'MessageRouter');

      switch (message.action) {
        case CONFIG.MESSAGES.TRANSLATE_PAGE:
          await this.handleTranslatePage(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.PROCESS_TRANSLATION:
          await this.handleProcessTranslation(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.TRANSLATE_TEXT:
          await this.handleTranslateText(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.PAGE_CONTENT_EXTRACTED:
          this.handlePageContentExtracted(message, sender);
          break;

        case CONFIG.MESSAGES.CONTENT_SCRIPT_ERROR:
          this.handleContentScriptError(message, sender);
          break;

        case CONFIG.MESSAGES.UPDATE_SUMMARY:
          this.forwardToSidepanel(message);
          break;

        case CONFIG.MESSAGES.START_CONTINUOUS_TRANSLATION:
          await this.handleStartContinuousTranslation(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.STOP_CONTINUOUS_TRANSLATION:
          await this.handleStopContinuousTranslation(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.UPDATE_CONTINUOUS_LANGUAGE:
          await this.handleUpdateContinuousLanguage(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.SIDEPANEL_CLOSED:
          this.handleSidepanelClosed(message, sender);
          break;

        case CONFIG.MESSAGES.TRANSLATION_STARTED:
          this.handleTranslationStarted(message, sender);
          break;

        case CONFIG.MESSAGES.TRANSLATION_COMPLETE:
          this.handleTranslationComplete(message, sender);
          break;

        case CONFIG.MESSAGES.GENERATE_SUMMARY:
          await this.handleGenerateSummary(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.STREAM_TRANSLATION_CHUNK:
          this.forwardToSidepanel(message);
          break;

        case CONFIG.MESSAGES.STREAM_SUMMARY_CHUNK:
          this.forwardToSidepanel(message);
          break;

        default:
          Logger.warn(`Unknown message action: ${message.action}`, 'MessageRouter');
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      Logger.error('Error routing message', error, 'MessageRouter');
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle translate page request
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   * @private
   */
  async handleTranslatePage(message, sender, sendResponse) {
    const { tabId, sourceLanguage, targetLanguage } = message;

    try {
      // Validate request
      if (!tabId || !targetLanguage) {
        throw new Error('Missing required parameters: tabId and targetLanguage');
      }

      // Check if translation is already in progress
      if (this.stateManager.isTranslationInProgress(tabId)) {
        sendResponse({ success: false, error: 'Translation already in progress' });
        return;
      }

      // Set translation state
      this.stateManager.setTranslationState(tabId, {
        sourceLanguage,
        targetLanguage,
        isTranslating: true,
        startTime: Date.now()
      });

      // Send message to content script
      const response = await this.sendToContentScript(tabId, {
        action: CONFIG.MESSAGES.TRANSLATE_PAGE,
        sourceLanguage,
        targetLanguage
      });

      sendResponse(response);
    } catch (error) {
      this.stateManager.setTranslationState(tabId, { isTranslating: false });
      Logger.error('Failed to handle translate page request', error, 'MessageRouter');
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle process translation request (content + summary generation)
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   * @private
   */
  async handleProcessTranslation(message, sender, sendResponse) {
    const { content, sourceLanguage, targetLanguage, pageUrl } = message;

    try {
      // Validate input
      if (!content || !targetLanguage) {
        throw new Error('Missing required parameters: content and targetLanguage');
      }

      // Check cache first
      const cacheKey = `${sourceLanguage}-${targetLanguage}`;
      const cached = this.cacheManager.get(content, sourceLanguage, targetLanguage);
      
      if (cached) {
        Logger.info('Serving translation from cache', 'MessageRouter');
        sendResponse({ success: true, ...cached });
        return;
      }

      // Make parallel API calls for translation and summary
      const [translationResult, summaryResult] = await Promise.allSettled([
        this.apiManager.translateContent(content, sourceLanguage, targetLanguage),
        this.apiManager.generateSummary(content, targetLanguage, pageUrl)
      ]);

      const response = { success: true };

      // Process translation result
      if (translationResult.status === 'fulfilled') {
        response.translations = translationResult.value;
      } else {
        Logger.error('Translation failed', translationResult.reason, 'MessageRouter');
      }

      // Process summary result
      if (summaryResult.status === 'fulfilled') {
        response.summary = summaryResult.value;
      } else {
        Logger.error('Summary generation failed', summaryResult.reason, 'MessageRouter');
      }

      // Cache the results if we have any
      if (response.translations || response.summary) {
        this.cacheManager.set(content, sourceLanguage, targetLanguage, {
          translations: response.translations,
          summary: response.summary
        });
      }

      sendResponse(response);
    } catch (error) {
      Logger.error('Failed to process translation', error, 'MessageRouter');
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle translate text request
   * @param {Object} message - Message from content script
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   */
  async handleTranslateText(message, sender, sendResponse) {
    const requestStartTime = performance.now();
    const { texts, sourceLanguage, targetLanguage, batchInfo } = message;
    const tabId = sender.tab?.id;

    // Enhanced logging for translation requests with timing
    console.log(`🔥 [BACKGROUND LOG] Translation request received:`, {
      tabId,
      textsCount: Array.isArray(texts) ? texts.length : 1,
      sourceLanguage,
      targetLanguage,
      batchInfo: batchInfo || 'N/A',
      timestamp: new Date().toISOString()
    });

    if (!texts || (!Array.isArray(texts) && typeof texts !== 'string')) {
      const error = 'No text provided for translation';
      Logger.error(error, null, 'MessageRouter');
      sendResponse({ success: false, error });
      return;
    }

    if (!targetLanguage) {
      const error = 'No target language specified';
      Logger.error(error, null, 'MessageRouter');
      sendResponse({ success: false, error });
      return;
    }

    try {
      // Handle both array and string formats for backward compatibility
      const textsToTranslate = Array.isArray(texts) ? texts : [texts];
      
      console.log(`📝 [BACKGROUND LOG] Processing batch:`, {
        textsCount: textsToTranslate.length,
        totalCharacters: textsToTranslate.reduce((sum, text) => sum + text.length, 0),
        averageLength: Math.round(textsToTranslate.reduce((sum, text) => sum + text.length, 0) / textsToTranslate.length),
        textSamples: textsToTranslate.slice(0, 3).map(text => text.substring(0, 50) + (text.length > 50 ? '...' : ''))
      });

      const cacheCheckStart = performance.now();
      
      // Check cache for all texts first
      const translations = {};
      const uncachedTexts = [];
      let cacheHits = 0;
      
      for (const text of textsToTranslate) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          console.warn(`⚠️ [BACKGROUND LOG] Skipping empty or invalid text`);
          continue;
        }

        const cached = this.cacheManager.get(text, sourceLanguage, targetLanguage);
        if (cached) {
          translations[text] = cached.translatedText;
          cacheHits++;
        } else {
          uncachedTexts.push(text);
        }
      }

      const cacheCheckTime = performance.now() - cacheCheckStart;

      console.log(`💾 [BACKGROUND LOG] Cache check completed:`, {
        totalTexts: textsToTranslate.length,
        cacheHits: cacheHits,
        uncachedTexts: uncachedTexts.length,
        cacheHitRate: `${Math.round((cacheHits / textsToTranslate.length) * 100)}%`,
        cacheCheckTimeMs: Math.round(cacheCheckTime)
      });

      let apiCallTime = 0;
      let firstTokenTime = null;

      // If we have uncached texts, translate them in batch
      if (uncachedTexts.length > 0) {
        try {
          console.log(`🌐 [BACKGROUND LOG] Starting API translation:`, {
            uncachedTexts: uncachedTexts.length,
            sourceLanguage,
            targetLanguage
          });
          
          const apiStartTime = performance.now();
          
          const result = await this.apiManager.translateContent(uncachedTexts, sourceLanguage, targetLanguage);
          
          apiCallTime = performance.now() - apiStartTime;
          firstTokenTime = apiCallTime; // For now, treating the entire API call as first token time
          
          if (result && result.success && result.translations) {
            // Add to translations and cache
            Object.entries(result.translations).forEach(([originalText, translatedText]) => {
              translations[originalText] = translatedText;
              
              // Cache the result
              this.cacheManager.set(originalText, sourceLanguage, targetLanguage, {
                success: true,
                translatedText: translatedText
              });
            });
            
            console.log(`✅ [BACKGROUND LOG] API translation completed:`, {
              translatedCount: Object.keys(result.translations).length,
              apiCallTimeMs: Math.round(apiCallTime),
              averageTimePerText: Math.round(apiCallTime / uncachedTexts.length)
            });
          } else {
            console.warn(`⚠️ [BACKGROUND LOG] API translation failed, using fallback`);
            // Use original texts as fallback
            uncachedTexts.forEach(text => {
              translations[text] = text;
            });
          }
        } catch (error) {
          apiCallTime = performance.now() - requestStartTime; // Record error time
          console.error(`💥 [BACKGROUND LOG] API translation error:`, {
            error: error.message,
            timeElapsedMs: Math.round(apiCallTime)
          });
          // Use original texts as fallback
          uncachedTexts.forEach(text => {
            translations[text] = text;
          });
        }
      }

      const totalTime = performance.now() - requestStartTime;
      const successfulTranslations = Object.keys(translations).length;

      console.log(`🎉 [BACKGROUND LOG] Translation batch completed:`, {
        requested: textsToTranslate.length,
        successful: successfulTranslations,
        cached: cacheHits,
        newTranslations: uncachedTexts.length,
        successRate: `${Math.round((successfulTranslations / textsToTranslate.length) * 100)}%`,
        timing: {
          totalTimeMs: Math.round(totalTime),
          cacheCheckMs: Math.round(cacheCheckTime),
          apiCallMs: Math.round(apiCallTime),
          timeToFirstTokenMs: firstTokenTime ? Math.round(firstTokenTime) : 'N/A',
          averageTimePerText: Math.round(totalTime / textsToTranslate.length)
        },
        batchInfo: batchInfo || 'N/A'
      });

      sendResponse({
        success: true,
        translations: translations,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        timing: {
          totalMs: Math.round(totalTime),
          apiMs: Math.round(apiCallTime),
          cacheHits: cacheHits
        }
      });

    } catch (error) {
      const totalTime = performance.now() - requestStartTime;
      console.error(`💀 [BACKGROUND LOG] Translation request failed:`, {
        error: error.message,
        timeElapsedMs: Math.round(totalTime),
        sourceLanguage,
        targetLanguage
      });
      
      sendResponse({
        success: false,
        error: `Translation failed: ${error.message}`,
        timing: {
          totalMs: Math.round(totalTime)
        }
      });
    }
  }

  /**
   * Handle page content extracted notification
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handlePageContentExtracted(message, sender) {
    if (sender.tab?.id) {
      this.stateManager.markTabActive(sender.tab.id);
      this.stateManager.setTranslationState(sender.tab.id, {
        content: message.content
      });
    }

    // Forward to sidepanel if needed
    this.forwardToSidepanel(message);
  }

  /**
   * Handle content script error notification
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handleContentScriptError(message, sender) {
    Logger.error('Content script error', message, 'MessageRouter');

    // Clear any ongoing translation state
    if (sender.tab?.id) {
      this.stateManager.setTranslationState(sender.tab.id, { isTranslating: false });
    }

    // Forward error to sidepanel
    this.forwardToSidepanel({
      action: CONFIG.MESSAGES.TRANSLATION_ERROR,
      error: message.error,
      context: message.context
    });
  }

  /**
   * Send message to content script
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Response from content script
   * @private
   */
  async sendToContentScript(tabId, message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Content script communication timeout'));
      }, 10000);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || { success: true });
        }
      });
    });
  }

  /**
   * Forward message to sidepanel
   * @param {Object} message - Message to forward
   * @private
   */
  async forwardToSidepanel(message) {
    try {
      await chrome.runtime.sendMessage(message);
      Logger.debug('Message forwarded to sidepanel', message, 'MessageRouter');
    } catch (error) {
      // Sidepanel might not be open, which is fine
      Logger.debug('Could not forward to sidepanel (might not be open)', null, 'MessageRouter');
    }
  }

  /**
   * Handle start continuous translation request
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   * @private
   */
  async handleStartContinuousTranslation(message, sender, sendResponse) {
    const { tabId, sourceLanguage, targetLanguage } = message;

    try {
      if (!tabId || !targetLanguage) {
        throw new Error('Missing required parameters: tabId and targetLanguage');
      }

      // Enable continuous translation in state
      this.stateManager.enableContinuousTranslation(tabId, sourceLanguage, targetLanguage);

      // Send message to content script
      const response = await this.sendToContentScript(tabId, {
        action: CONFIG.MESSAGES.START_CONTINUOUS_TRANSLATION,
        sourceLanguage,
        targetLanguage
      });

      sendResponse(response);
    } catch (error) {
      Logger.error('Failed to start continuous translation', error, 'MessageRouter');
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle stop continuous translation request
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   * @private
   */
  async handleStopContinuousTranslation(message, sender, sendResponse) {
    const { tabId } = message;

    try {
      if (!tabId) {
        throw new Error('Missing required parameter: tabId');
      }

      // Disable continuous translation in state
      this.stateManager.disableContinuousTranslation(tabId);

      // Send message to content script
      const response = await this.sendToContentScript(tabId, {
        action: CONFIG.MESSAGES.STOP_CONTINUOUS_TRANSLATION
      });

      sendResponse(response);
    } catch (error) {
      Logger.error('Failed to stop continuous translation', error, 'MessageRouter');
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle update continuous language request
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   * @private
   */
  async handleUpdateContinuousLanguage(message, sender, sendResponse) {
    const { tabId, sourceLanguage, targetLanguage } = message;

    try {
      if (!tabId || !targetLanguage) {
        throw new Error('Missing required parameters: tabId and targetLanguage');
      }

      // Update continuous translation language in state
      this.stateManager.updateContinuousLanguage(tabId, sourceLanguage, targetLanguage);

      // Send message to content script
      const response = await this.sendToContentScript(tabId, {
        action: CONFIG.MESSAGES.UPDATE_CONTINUOUS_LANGUAGE,
        sourceLanguage,
        targetLanguage
      });

      sendResponse(response);
    } catch (error) {
      Logger.error('Failed to update continuous translation language', error, 'MessageRouter');
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle sidepanel closed notification
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handleSidepanelClosed(message, sender) {
    const { tabId } = message;
    
    if (tabId) {
      // Stop continuous translation when sidepanel is closed
      this.stateManager.disableContinuousTranslation(tabId);
      
      // Notify content script
      this.sendToContentScript(tabId, {
        action: CONFIG.MESSAGES.STOP_CONTINUOUS_TRANSLATION
      }).catch(error => {
        Logger.debug('Could not notify content script of sidepanel closure', error, 'MessageRouter');
      });
      
      Logger.info(`Continuous translation stopped due to sidepanel closure for tab ${tabId}`, 'MessageRouter');
    }
  }

  /**
   * Handle translation started notification
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handleTranslationStarted(message, sender) {
    if (sender.tab?.id) {
      this.stateManager.setTranslationState(sender.tab.id, {
        isTranslating: true,
        startTime: Date.now()
      });
    }

    // Forward to sidepanel
    this.forwardToSidepanel(message);
    Logger.debug('Translation started notification handled', null, 'MessageRouter');
  }

  /**
   * Handle translation complete notification
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handleTranslationComplete(message, sender) {
    if (sender.tab?.id) {
      this.stateManager.setTranslationState(sender.tab.id, {
        isTranslating: false,
        lastTranslationTime: Date.now()
      });
    }

    // Forward to sidepanel
    this.forwardToSidepanel(message);
    Logger.debug('Translation complete notification handled', null, 'MessageRouter');
  }

  /**
   * Handle generate summary request (separate from translation)
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @param {Function} sendResponse - Response callback
   * @private
   */
  async handleGenerateSummary(message, sender, sendResponse) {
    const { content, targetLanguage, pageUrl, streaming = false } = message;

    try {
      if (!content || !targetLanguage) {
        throw new Error('Missing required parameters: content and targetLanguage');
      }

      Logger.debug('Generating summary independently', { targetLanguage, pageUrl }, 'MessageRouter');

      if (streaming) {
        // Start streaming summary generation
        this.generateStreamingSummary(content, targetLanguage, pageUrl, sender.tab?.id);
        sendResponse({ success: true, streaming: true });
      } else {
        // Generate summary normally
        const summary = await this.apiManager.generateSummary(content, targetLanguage, pageUrl);
        sendResponse({ success: true, summary });
      }
    } catch (error) {
      Logger.error('Failed to generate summary', error, 'MessageRouter');
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Generate streaming summary and send chunks
   * @param {string} content - Content to summarize
   * @param {string} targetLanguage - Target language
   * @param {string} pageUrl - Page URL
   * @param {number} tabId - Tab ID
   * @private
   */
  async generateStreamingSummary(content, targetLanguage, pageUrl, tabId) {
    try {
      // Start summary generation with streaming
      const summaryPromise = this.apiManager.generateSummary(content, targetLanguage, pageUrl);
      
      // Send initial chunk
      this.forwardToSidepanel({
        action: CONFIG.MESSAGES.STREAM_SUMMARY_CHUNK,
        tabId,
        chunk: { type: 'start', message: 'Generating summary...' }
      });

      const summary = await summaryPromise;

      // Send final chunk with complete summary
      this.forwardToSidepanel({
        action: CONFIG.MESSAGES.STREAM_SUMMARY_CHUNK,
        tabId,
        chunk: { type: 'complete', summary }
      });

    } catch (error) {
      Logger.error('Streaming summary generation failed', error, 'MessageRouter');
      
      // Send error chunk
      this.forwardToSidepanel({
        action: CONFIG.MESSAGES.STREAM_SUMMARY_CHUNK,
        tabId,
        chunk: { type: 'error', error: error.message }
      });
    }
  }
}

// =============================================================================
// TAB MANAGER
// =============================================================================

/**
 * Manages tab lifecycle events and cleanup
 * @class
 */
class TabManager {
  /**
   * Initialize tab manager
   * @param {StateManager} stateManager - State manager instance
   * @param {MessageRouter} messageRouter - Message router instance
   */
  constructor(stateManager, messageRouter) {
    this.stateManager = stateManager;
    this.messageRouter = messageRouter;
    this.setupTabListeners();
  }

  /**
   * Set up tab event listeners
   * @private
   */
  setupTabListeners() {
    // Handle tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    // Handle tab updates (navigation, reload, etc.)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    Logger.info('Tab manager initialized', 'TabManager');
  }

  /**
   * Handle tab removal
   * @param {number} tabId - ID of removed tab
   * @private
   */
  handleTabRemoved(tabId) {
    this.stateManager.clearTranslationState(tabId);
    Logger.debug(`Tab ${tabId} removed, state cleared`, null, 'TabManager');
  }

  /**
   * Handle tab updates
   * @param {number} tabId - Tab ID
   * @param {Object} changeInfo - Change information
   * @param {Object} tab - Tab object
   * @private
   */
  handleTabUpdated(tabId, changeInfo, tab) {
    // Handle page navigation
    if (changeInfo.status === 'loading' && changeInfo.url) {
      const currentState = this.stateManager.getTranslationState(tabId);
      const wasContinuous = currentState && currentState.continuousTranslation;
      
      if (wasContinuous) {
        // Preserve continuous translation settings during navigation
        const { sourceLanguage, targetLanguage } = currentState;
        Logger.info(`Tab ${tabId} navigated with continuous translation enabled`, 'TabManager');
        
        // Clear other state but preserve continuous translation
        this.stateManager.setTranslationState(tabId, {
          continuousTranslation: true,
          sourceLanguage,
          targetLanguage,
          isTranslating: false,
          navigationInProgress: true
        });
      } else {
        // Normal navigation - clear all state
        this.stateManager.clearTranslationState(tabId);
        Logger.debug(`Tab ${tabId} navigated, state cleared`, null, 'TabManager');
      }
    }
    
    // When page finishes loading, restart continuous translation if it was enabled
    if (changeInfo.status === 'complete') {
      const currentState = this.stateManager.getTranslationState(tabId);
      if (currentState && currentState.continuousTranslation && currentState.navigationInProgress) {
        Logger.info(`Page loaded, restarting continuous translation for tab ${tabId}`, 'TabManager');
        
        // Remove navigation flag and restart translation
        this.stateManager.setTranslationState(tabId, {
          navigationInProgress: false
        });
        
        // Auto-restart continuous translation on new page
        this.autoRestartContinuousTranslation(tabId, currentState.sourceLanguage, currentState.targetLanguage);
      }
    }
  }

  /**
   * Automatically restart continuous translation on a new page
   * @param {number} tabId - Tab ID
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @private
   */
  async autoRestartContinuousTranslation(tabId, sourceLanguage, targetLanguage) {
    try {
      // Small delay to ensure page is fully loaded
      setTimeout(async () => {
        try {
          Logger.info(`Auto-restarting continuous translation: ${sourceLanguage} → ${targetLanguage}`, 'TabManager');
          
          // Notify sidepanel that continuous translation is restarting
          this.messageRouter.forwardToSidepanel({
            action: 'continuousTranslationRestarting',
            tabId,
            sourceLanguage,
            targetLanguage
          });
          
          // Send message to content script to start translation
          await chrome.tabs.sendMessage(tabId, {
            action: 'startContinuousTranslation',
            sourceLanguage,
            targetLanguage
          });
          
          // Notify sidepanel that continuous translation restarted successfully
          this.messageRouter.forwardToSidepanel({
            action: 'continuousTranslationRestarted',
            tabId,
            sourceLanguage,
            targetLanguage
          });
          
          Logger.info(`Continuous translation auto-restarted for tab ${tabId}`, 'TabManager');
        } catch (error) {
          Logger.error('Failed to auto-restart continuous translation', error, 'TabManager');
          
          // Notify sidepanel of the error
          this.messageRouter.forwardToSidepanel({
            action: 'continuousTranslationError',
            tabId,
            error: error.message
          });
        }
      }, 1000); // 1 second delay
    } catch (error) {
      Logger.error('Error setting up auto-restart for continuous translation', error, 'TabManager');
    }
  }
}

// =============================================================================
// PERFORMANCE MONITOR
// =============================================================================

/**
 * Monitors performance and logs slow operations
 * @class
 */
class PerformanceMonitor {
  /**
   * Initialize performance monitor
   */
  constructor() {
    /** @type {Map<string, number>} Operation start times */
    this.operations = new Map();
  }

  /**
   * Start timing an operation
   * @param {string} operationId - Unique operation identifier
   * @param {string} description - Operation description
   */
  startOperation(operationId, description) {
    if (!CONFIG.PERFORMANCE.ENABLE_TIMING) return;

    this.operations.set(operationId, {
      startTime: performance.now(),
      description
    });

    Logger.debug(`Performance tracking started: ${description}`, null, 'PerformanceMonitor');
  }

  /**
   * End timing an operation and log if slow
   * @param {string} operationId - Operation identifier
   */
  endOperation(operationId) {
    if (!CONFIG.PERFORMANCE.ENABLE_TIMING) return;

    const operation = this.operations.get(operationId);
    if (!operation) {
      Logger.warn(`Unknown operation ID: ${operationId}`, 'PerformanceMonitor');
      return;
    }

    const duration = performance.now() - operation.startTime;
    this.operations.delete(operationId);

    if (duration > CONFIG.PERFORMANCE.SLOW_OPERATION_THRESHOLD) {
      Logger.warn(`Slow operation detected: ${operation.description} took ${duration.toFixed(2)}ms`, 'PerformanceMonitor');
    } else {
      Logger.debug(`Operation completed: ${operation.description} - ${duration.toFixed(2)}ms`, null, 'PerformanceMonitor');
    }
  }

  /**
   * Wrap an async function with performance monitoring
   * @param {string} description - Operation description
   * @param {Function} asyncFunction - Function to monitor
   * @returns {Function} Wrapped function
   */
  wrapAsync(description, asyncFunction) {
    return async (...args) => {
      const operationId = `${description}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      this.startOperation(operationId, description);
      try {
        const result = await asyncFunction(...args);
        this.endOperation(operationId);
        return result;
      } catch (error) {
        this.endOperation(operationId);
        throw error;
      }
    };
  }
}

// =============================================================================
// MAIN APPLICATION
// =============================================================================

/**
 * Main background application controller
 * @class
 */
class BackgroundApp {
  /**
   * Initialize the background application
   */
  constructor() {
    /** @type {StateManager} State manager instance */
    this.stateManager = new StateManager();
    
    /** @type {CacheManager} Cache manager instance */
    this.cacheManager = new CacheManager();
    
    /** @type {APIManager} API manager instance */
    this.apiManager = new APIManager(this.stateManager);
    
    /** @type {MessageRouter} Message router instance */
    this.messageRouter = new MessageRouter(this.stateManager, this.cacheManager, this.apiManager);
    
    /** @type {TabManager} Tab manager instance */
    this.tabManager = new TabManager(this.stateManager, this.messageRouter);
    
    /** @type {PerformanceMonitor} Performance monitor instance */
    this.performanceMonitor = new PerformanceMonitor();

    this.initialize();
  }

  /**
   * Initialize the background application
   * @private
   */
  initialize() {
    Logger.info('AI Page Translator background service worker initialized', 'BackgroundApp');
    Logger.info('Extension configuration loaded successfully', 'BackgroundApp');

    // Log initial statistics
    this.logStatistics();
    
    // Set up periodic cleanup
    this.setupPeriodicCleanup();
  }

  /**
   * Log current statistics
   * @private
   */
  logStatistics() {
    const stateStats = this.stateManager.getStatistics();
    const cacheStats = this.cacheManager.getStatistics();
    
    Logger.info('Current statistics', 'BackgroundApp');
    Logger.debug('State statistics', stateStats, 'BackgroundApp');
    Logger.debug('Cache statistics', cacheStats, 'BackgroundApp');
  }

  /**
   * Set up periodic cleanup tasks
   * @private
   */
  setupPeriodicCleanup() {
    // Run cleanup every hour
    setInterval(() => {
      this.stateManager.cleanup();
      this.logStatistics();
    }, 60 * 60 * 1000);

    Logger.debug('Periodic cleanup scheduled', null, 'BackgroundApp');
  }

  /**
   * Shutdown the background application
   */
  shutdown() {
    try {
      this.cacheManager.shutdown();
      this.stateManager.reset();
      Logger.info('Background application shutdown completed', 'BackgroundApp');
    } catch (error) {
      Logger.error('Error during background application shutdown', error, 'BackgroundApp');
    }
  }
}

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Global background application instance
 * @type {BackgroundApp}
 */
let backgroundApp;

/**
 * Initialize the background application
 */
function initializeBackground() {
  try {
    backgroundApp = new BackgroundApp();
    
    // Configure sidepanel behavior to open on action click
    setupSidepanelBehavior();
  } catch (error) {
    Logger.error('Failed to initialize background application', error, 'Main');
  }
}

/**
 * Configure sidepanel to open when extension icon is clicked
 */
function setupSidepanelBehavior() {
  try {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    Logger.info('Sidepanel behavior configured to open on action click', 'Main');
  } catch (error) {
    Logger.error('Failed to configure sidepanel behavior', error, 'Main');
  }
}

// Initialize on startup and installation
chrome.runtime.onStartup.addListener(initializeBackground);
chrome.runtime.onInstalled.addListener(initializeBackground);

// Handle suspension
chrome.runtime.onSuspend.addListener(() => {
  if (backgroundApp) {
    backgroundApp.shutdown();
  }
});

// Initialize immediately if not already running
if (!backgroundApp) {
  initializeBackground();
} 