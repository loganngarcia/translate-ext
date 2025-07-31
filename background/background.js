/**
 * @fileoverview Background Service Worker for Uno Translate Chrome Extension
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
 * @author Uno Translate Team
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
      SUMMARIZE: '/summarize'
    },
    TIMEOUT: 60000, // Increased from 30 to 60 seconds
    MAX_RETRIES: 5,
    RETRY_DELAY: 2000 // Increased from 1000 to 2000 milliseconds
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
    SUMMARY_EXPIRY_HOURS: 6, // Summaries expire faster as content may change
    CLEANUP_INTERVAL: 3600000 // 1 hour in milliseconds
  },

  // Message types for routing
  MESSAGES: {
    TRANSLATE_PAGE: 'translatePage',
    PROCESS_TRANSLATION: 'processTranslation',
    TRANSLATE_TEXT: 'translateText',
    UPDATE_SUMMARY: 'updateSummary',
    SUMMARY_UPDATE: 'summaryUpdate', // Auto-generated summary from background
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
  },

  // Communication timeouts
  COMMUNICATION: {
    CONTENT_SCRIPT_TIMEOUT: 30000, // Increased from 10 to 30 seconds
    SIDEPANEL_TIMEOUT: 15000, // 15 seconds for sidepanel communication
    MESSAGE_TIMEOUT: 20000 // 20 seconds for general message handling
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
      Logger.debug(`❌ CACHE: Miss for key "${key}"`, null, 'CacheManager');
      return null;
    }

    // Check if entry is still fresh
    const now = Date.now();
    const maxAge = CONFIG.CACHE.EXPIRY_HOURS * 60 * 60 * 1000;
    const age = now - cached.timestamp;

    
    if (age > maxAge) {
      this.memoryCache.delete(key);
      // Async save to storage (don't wait)
      this.saveToStorage().catch(error => 
        Logger.error('Failed to save cache after expiry cleanup', error, 'CacheManager')
      );
      Logger.debug(`⏰ CACHE: Entry expired and removed: ${key}`, null, 'CacheManager');
      return null;
    }

    // Update access count and timestamp for LRU tracking
    cached.accessCount = (cached.accessCount || 0) + 1;
    cached.lastAccessed = Date.now();

    Logger.debug(`✅ CACHE: Hit for key "${key}" (languages: "${sourceLanguage}" → "${targetLanguage}")`, null, 'CacheManager');
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

  // =============================================================================
  // SUMMARY CACHING METHODS
  // =============================================================================

  /**
   * Generate cache key for summary
   * @param {string} url - Page URL
   * @param {string} targetLanguage - Target language
   * @returns {string} Cache key
   * @private
   */
  generateSummaryCacheKey(url, targetLanguage) {
    // Clean URL by removing query params and fragment for better cache hits
    const cleanUrl = url.split('?')[0].split('#')[0];
    const urlHash = this.simpleHash(cleanUrl);
    return `summary:${targetLanguage}:${urlHash}`;
  }

  /**
   * Get cached summary for URL and language
   * @param {string} url - Page URL
   * @param {string} targetLanguage - Target language
   * @returns {Object|null} Cached summary or null
   */
  getSummary(url, targetLanguage) {
    const key = this.generateSummaryCacheKey(url, targetLanguage);
    const cached = this.memoryCache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if summary is still fresh
    const now = Date.now();
    const maxAge = CONFIG.CACHE.SUMMARY_EXPIRY_HOURS * 60 * 60 * 1000;
    
    if (now - cached.timestamp > maxAge) {
      // Summary expired, remove from cache
      this.memoryCache.delete(key);
      this.saveToStorage();
      return null;
    }

    // Update access time for LRU tracking
    cached.lastAccessed = now;
    return cached.data;
  }

  /**
   * Cache summary for URL and language
   * @param {string} url - Page URL
   * @param {string} targetLanguage - Target language
   * @param {Object} summary - Summary data to cache
   */
  async setSummary(url, targetLanguage, summary) {
    const key = this.generateSummaryCacheKey(url, targetLanguage);
    const now = Date.now();
    
    const cacheEntry = {
      data: summary,
      timestamp: now,
      lastAccessed: now,
      type: 'summary',
      url: url.split('?')[0].split('#')[0], // Store clean URL for debugging
      language: targetLanguage
    };

    // Check cache size limits before adding
    if (this.memoryCache.size >= CONFIG.CACHE.MAX_ENTRIES) {
      this.evictOldestEntries();
    }

    this.memoryCache.set(key, cacheEntry);
    
    // Save to persistent storage
    await this.saveToStorage();
    
    Logger.debug(`Summary cached for ${url} in ${targetLanguage}`, null, 'CacheManager');
  }

  /**
   * Clear all cached summaries
   */
  async clearSummaries() {
    const summaryKeys = Array.from(this.memoryCache.keys()).filter(key => key.startsWith('summary:'));
    
    for (const key of summaryKeys) {
      this.memoryCache.delete(key);
    }
    
    await this.saveToStorage();
    Logger.info(`Cleared ${summaryKeys.length} cached summaries`, 'CacheManager');
  }

  /**
   * Get summary cache statistics
   * @returns {Object} Summary cache stats
   */
  getSummaryStatistics() {
    const summaryEntries = Array.from(this.memoryCache.entries())
      .filter(([key]) => key.startsWith('summary:'));
    
    const totalSummaries = summaryEntries.length;
    const now = Date.now();
    const maxAge = CONFIG.CACHE.SUMMARY_EXPIRY_HOURS * 60 * 60 * 1000;
    
    const freshSummaries = summaryEntries.filter(([, entry]) => 
      now - entry.timestamp <= maxAge
    ).length;
    
    const languages = new Set(summaryEntries.map(([, entry]) => entry.language));
    
    return {
      totalSummaries,
      freshSummaries,
      expiredSummaries: totalSummaries - freshSummaries,
      languages: Array.from(languages),
      cacheHitRate: this.calculateSummaryHitRate()
    };
  }

  /**
   * Calculate summary cache hit rate (simplified)
   * @returns {number} Hit rate percentage
   * @private
   */
  calculateSummaryHitRate() {
    // This would need more sophisticated tracking in a real implementation
    // For now, return a reasonable estimate
    return 0.75; // 75% hit rate estimate
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
   * Make an API call with enhanced retry logic and error handling
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

    // Increased retries for better reliability
    const maxRetries = 5; // Increased from 3 to 5
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(fullUrl, data, attempt);
        Logger.debug(`API call successful after ${attempt} attempt(s)`, null, 'APIManager');
        return response;
      } catch (error) {
        lastError = error;
        
        // Don't log warnings for first few attempts to reduce noise
        if (attempt >= 3) {
          Logger.warn(`API call attempt ${attempt}/${maxRetries} failed: ${error.message}`, 'APIManager');
        }
        
        // Handle rate limiting
        if (error.status === 429) {
          const resetTime = this.extractRateLimitReset(error.headers);
          if (resetTime) {
            this.stateManager.setRateLimitReset(endpoint, resetTime);
          }
        }

        // If this is the last attempt, we'll throw after the loop
        if (attempt === maxRetries) {
          break;
        }

        // Enhanced retry logic with different delays for different error types
        let delay = CONFIG.API.RETRY_DELAY * Math.pow(2, attempt - 1);
        
        // Shorter delays for network errors, longer for server errors
        if (error.status >= 500) {
          delay *= 1.5; // Server errors need more time
        } else if (error.name === 'NetworkError' || !error.status) {
          delay *= 0.7; // Network errors can be retried faster
        }
        
        // Cap maximum delay at 10 seconds
        delay = Math.min(delay, 10000);
        
        await this.sleep(delay);
      }
    }

    // If we get here, all retries failed
    throw this.createAPIError(lastError, endpoint, maxRetries);
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
      // Validate request data before sending
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid request data format');
      }

      // Ensure required fields are present for different endpoints
      const endpoint = url.split('/').pop();
      if (endpoint === 'translate' && (!data.content || !data.targetLanguage)) {
        throw new Error('Missing required fields: content and targetLanguage');
      }
      if (endpoint === 'summarize' && (!data.content || !data.targetLanguage)) {
        throw new Error('Missing required fields: content and targetLanguage');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'UnoTranslate/1.0.0'
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          Logger.warn(`Failed to parse error response: ${parseError.message}`, 'APIManager');
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.headers = response.headers;
        
        // Log detailed error information for debugging
        Logger.error(`API request failed: ${errorMessage}`, {
          status: response.status,
          url: url,
          data: data,
          attempt: attempt
        }, 'APIManager');
        
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
    try {
      // Validate input
      if (!content || (typeof content !== 'string' && !Array.isArray(content))) {
        throw new Error('Invalid content: must be a string or array of strings');
      }
      if (!targetLanguage) {
        throw new Error('Target language is required');
      }

      // Handle both single strings and arrays of strings
      let textToTranslate;
      if (Array.isArray(content)) {
        // Validate array content
        if (content.length === 0) {
          throw new Error('Content array cannot be empty');
        }
        textToTranslate = content.join('\n---SEPARATOR---\n');
      } else {
        // Sanitize string content
        textToTranslate = content.trim();
        if (textToTranslate.length === 0) {
          throw new Error('Content cannot be empty after trimming');
        }
      }

      // Limit content size to prevent API issues
      const maxContentLength = 50000; // 50KB limit
      if (textToTranslate.length > maxContentLength) {
        Logger.warn(`Content too large (${textToTranslate.length} chars), truncating to ${maxContentLength}`, 'APIManager');
        textToTranslate = textToTranslate.substring(0, maxContentLength) + '...';
      }

      const requestData = {
        action: 'translate',
        content: textToTranslate,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage: targetLanguage,
        model: CONFIG.NOVA.MODEL_ID
      };

      Logger.debug(`Translating content (${textToTranslate.length} chars) from ${sourceLanguage} to ${targetLanguage}`, null, 'APIManager');

      const response = await this.makeAPICall(CONFIG.API.ENDPOINTS.TRANSLATE, requestData);
      
      // Validate response
      if (!response || !response.translations) {
        throw new Error('Invalid translation response format');
      }
      
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
      
      Logger.debug(`Translation completed successfully`, null, 'APIManager');
      return { success: true, translations: response.translations || {}, translatedText: response.translations?.[content] || content };
    } catch (error) {
      Logger.error('Translation failed', error, 'APIManager');
      throw error;
    }
  }

  /**
   * Generate summary using the summarization API
   * @param {string} content - Content to summarize
   * @param {string} targetLanguage - Target language for summary
   * @param {string} pageUrl - URL of the page being summarized
   * @returns {Promise<Object>} Summary result
   */
  async generateSummary(content, targetLanguage, pageUrl) {
    try {
      // Validate input
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid content: must be a non-empty string');
      }
      if (!targetLanguage) {
        throw new Error('Target language is required');
      }

      // Sanitize content
      const sanitizedContent = content.trim();
      if (sanitizedContent.length === 0) {
        throw new Error('Content cannot be empty after trimming');
      }

      // Limit content size for summary
      const maxContentLength = 100000; // 100KB limit for summaries
      let contentToSummarize = sanitizedContent;
      if (sanitizedContent.length > maxContentLength) {
        Logger.warn(`Content too large for summary (${sanitizedContent.length} chars), truncating to ${maxContentLength}`, 'APIManager');
        contentToSummarize = sanitizedContent.substring(0, maxContentLength) + '...';
      }

      const requestData = {
        action: 'summarize',
        content: contentToSummarize,
        targetLanguage: targetLanguage,
        pageUrl: pageUrl || '',
        model: CONFIG.NOVA.MODEL_ID
      };

      Logger.debug(`Generating summary for content (${contentToSummarize.length} chars) in ${targetLanguage}`, null, 'APIManager');

      const response = await this.makeAPICall(CONFIG.API.ENDPOINTS.SUMMARIZE, requestData);
      
      // Validate response
      if (!response || !response.summary) {
        Logger.warn('Invalid summary response, returning fallback', null, 'APIManager');
        return this.createLocalizedFallback(targetLanguage, 'unavailable');
      }

      Logger.debug(`Summary generated successfully`, null, 'APIManager');
      return response.summary;
    } catch (error) {
      Logger.error('Summary generation failed', error, 'APIManager');
      // Return fallback summary instead of throwing
      return this.createLocalizedFallback(targetLanguage, 'error');
    }
  }

  /**
   * Create localized fallback summary based on target language
   * @param {string} targetLanguage - Target language
   * @param {string} type - Type of fallback ('unavailable', 'error', 'loading')
   * @returns {Object} Localized fallback summary
   * @private
   */
  createLocalizedFallback(targetLanguage, type) {
    const fallbackMessages = {
      'English': {
        unavailable: { title: 'Summary Unavailable', text: 'Unable to generate summary at this time.', retry: 'Please try the translate button again' },
        error: { title: 'Summary Error', text: 'Failed to generate summary. Please try again.', retry: 'Please try the translate button again' },
        loading: { title: 'Loading Summary', text: 'Summary will be available shortly', retry: 'Please try the translate button if summary doesn\'t appear' }
      },
      'Spanish / Español': {
        unavailable: { title: 'Resumen No Disponible', text: 'No se puede generar el resumen en este momento.', retry: 'Presiona el botón traducir de nuevo' },
        error: { title: 'Error de Resumen', text: 'Error al generar el resumen. Inténtalo de nuevo.', retry: 'Presiona el botón traducir de nuevo' },
        loading: { title: 'Cargando Resumen', text: 'El resumen estará disponible en breve', retry: 'Presiona el botón traducir si no aparece el resumen' }
      },
      'French / Français': {
        unavailable: { title: 'Résumé Indisponible', text: 'Impossible de générer le résumé pour le moment.', retry: 'Veuillez réessayer le bouton traduire' },
        error: { title: 'Erreur de Résumé', text: 'Échec de la génération du résumé. Veuillez réessayer.', retry: 'Veuillez réessayer le bouton traduire' },
        loading: { title: 'Chargement du Résumé', text: 'Le résumé sera disponible sous peu', retry: 'Essayez le bouton traduire si le résumé n\'apparaît pas' }
      },
      'German / Deutsch': {
        unavailable: { title: 'Zusammenfassung Nicht Verfügbar', text: 'Zusammenfassung kann derzeit nicht erstellt werden.', retry: 'Bitte versuchen Sie die Übersetzungsschaltfläche erneut' },
        error: { title: 'Zusammenfassungsfehler', text: 'Fehler beim Erstellen der Zusammenfassung. Bitte versuchen Sie es erneut.', retry: 'Bitte versuchen Sie die Übersetzungsschaltfläche erneut' },
        loading: { title: 'Zusammenfassung Wird Geladen', text: 'Die Zusammenfassung wird in Kürze verfügbar sein', retry: 'Versuchen Sie die Übersetzungsschaltfläche, falls die Zusammenfassung nicht erscheint' }
      },
      'Chinese (Simplified) / 中文(简体)': {
        unavailable: { title: '摘要不可用', text: '目前无法生成摘要。', retry: '请重新尝试翻译按钮' },
        error: { title: '摘要错误', text: '生成摘要失败。请重试。', retry: '请重新尝试翻译按钮' },
        loading: { title: '正在加载摘要', text: '摘要将很快可用', retry: '如果摘要没有出现，请尝试翻译按钮' }
      },
      'Chinese (Traditional) / 中文(繁體)': {
        unavailable: { title: '摘要不可用', text: '目前無法生成摘要。', retry: '請重新嘗試翻譯按鈕' },
        error: { title: '摘要錯誤', text: '生成摘要失敗。請重試。', retry: '請重新嘗試翻譯按鈕' },
        loading: { title: '正在載入摘要', text: '摘要將很快可用', retry: '如果摘要沒有出現，請嘗試翻譯按鈕' }
      },
      'Japanese / 日本語': {
        unavailable: { title: '要約が利用できません', text: '現在要約を生成できません。', retry: '翻訳ボタンをもう一度試してください' },
        error: { title: '要約エラー', text: '要約の生成に失敗しました。もう一度お試しください。', retry: '翻訳ボタンをもう一度試してください' },
        loading: { title: '要約を読み込み中', text: '要約はまもなく利用可能になります', retry: '要約が表示されない場合は翻訳ボタンをお試しください' }
      },
      'Korean / 한국어': {
        unavailable: { title: '요약 사용 불가', text: '현재 요약을 생성할 수 없습니다.', retry: '번역 버튼을 다시 시도해 주세요' },
        error: { title: '요약 오류', text: '요약 생성에 실패했습니다. 다시 시도해 주세요.', retry: '번역 버튼을 다시 시도해 주세요' },
        loading: { title: '요약 로딩 중', text: '요약이 곧 제공될 예정입니다', retry: '요약이 나타나지 않으면 번역 버튼을 시도해 보세요' }
      }
    };

    const messages = fallbackMessages[targetLanguage] || fallbackMessages['English'];
    const message = messages[type] || messages['error'];

    return {
      title: message.title,
      points: [
        { emoji: type === 'error' ? '⚠️' : type === 'loading' ? '⏱️' : '📄', text: message.text },
        { emoji: '🔄', text: message.retry || 'Please try the translate button again' }
      ]
    };
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
    
    // Track ongoing summary generation to prevent duplicates
    this.ongoingSummaries = new Set();
    
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
          this.handlePageContentExtracted(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.CONTENT_SCRIPT_ERROR:
          this.handleContentScriptError(message, sender, sendResponse);
          break;

        case 'contentScriptReady':
          this.handleContentScriptReady(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.UPDATE_SUMMARY:
          this.forwardToSidepanel(message);
          if (sendResponse) sendResponse({ success: true });
          break;

        case CONFIG.MESSAGES.SUMMARY_UPDATE:
          this.forwardToSidepanel(message);
          if (sendResponse) sendResponse({ success: true });
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
          this.handleSidepanelClosed(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.TRANSLATION_STARTED:
          this.handleTranslationStarted(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.TRANSLATION_COMPLETE:
          this.handleTranslationComplete(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.GENERATE_SUMMARY:
          await this.handleGenerateSummary(message, sender, sendResponse);
          break;

        case CONFIG.MESSAGES.STREAM_TRANSLATION_CHUNK:
          this.forwardToSidepanel(message);
          if (sendResponse) sendResponse({ success: true });
          break;

        case CONFIG.MESSAGES.STREAM_SUMMARY_CHUNK:
          this.forwardToSidepanel(message);
          if (sendResponse) sendResponse({ success: true });
          break;

        case CONFIG.MESSAGES.CLEAR_CACHE:
          await this.handleClearCache(message, sender, sendResponse);
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

    // Basic logging for translation requests
    Logger.debug(`Translation request received`, {
      tabId,
      textsCount: Array.isArray(texts) ? texts.length : 1,
      sourceLanguage,
      targetLanguage
    }, 'MessageRouter');

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
      
      // Removed excessive batch logging

      const cacheCheckStart = performance.now();
      
      // Check cache for all texts first
      const translations = {};
      const uncachedTexts = [];
      let cacheHits = 0;
      
      for (const text of textsToTranslate) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          Logger.debug(`Skipping empty or invalid text`, null, 'MessageRouter');
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

      // Removed excessive cache logging

      let apiCallTime = 0;
      let firstTokenTime = null;

      // If we have uncached texts, translate them in batch
      if (uncachedTexts.length > 0) {
        try {
          // Removed excessive API start logging
          
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
            
            // Removed excessive API completion logging
          } else {
            Logger.warn('API translation failed, using fallback', 'MessageRouter');
            // Use original texts as fallback
            uncachedTexts.forEach(text => {
              translations[text] = text;
            });
          }
        } catch (error) {
          apiCallTime = performance.now() - requestStartTime; // Record error time
          Logger.error('API translation error', error, 'MessageRouter');
          // Use original texts as fallback
          uncachedTexts.forEach(text => {
            translations[text] = text;
          });
        }
      }

      const totalTime = performance.now() - requestStartTime;
      const successfulTranslations = Object.keys(translations).length;

      // Removed excessive batch completion logging

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
  handlePageContentExtracted(message, sender, sendResponse) {
    const tabId = sender.tab?.id;
    const content = message.content;
    
    if (tabId) {
      this.stateManager.markTabActive(tabId);
      this.stateManager.setTranslationState(tabId, {
        content: content
      });
      
      // Auto-generate summary immediately for fast user experience
      this.autoGenerateSummary(content, tabId);
    }

    // Forward to sidepanel with enhanced content info
    this.forwardToSidepanel({
      ...message,
      tabId,
      autoSummaryTriggered: true
    });

    // Acknowledge the notification
    if (sendResponse) sendResponse({ success: true });
  }

  /**
   * Automatically generate summary when page content is extracted
   * @param {Object} content - Page content object
   * @param {number} tabId - Tab ID
   * @private
   */
  async autoGenerateSummary(content, tabId) {
    try {
      // Get user's preferred language or default to English
      const userPrefs = await chrome.storage.sync.get(['targetLanguage']);
      const targetLanguage = userPrefs.targetLanguage || 'English';
      
      const { url, text, title } = content;
      
      // Create unique key for this URL+language combination
      const summaryKey = `${url}:${targetLanguage}`;
      
      // Check if we're already generating a summary for this URL+language
      if (this.ongoingSummaries.has(summaryKey)) {
        console.log(`🚫 SUMMARY: Already generating summary for ${title} (${url}) in ${targetLanguage}`);
        return;
      }
      
      // Check if we already have a cached summary for this URL and language
      const cachedSummary = this.cacheManager.getSummary(url, targetLanguage);
      if (cachedSummary) {
        console.log(`⚡ SUMMARY: Using cached summary for ${title} (${url}) in ${targetLanguage}`);
        console.log(`📄 SUMMARY CONTENT:`, {
          title: cachedSummary.title,
          points: cachedSummary.points?.map(p => `${p.emoji} ${p.text}`) || []
        });
        
        // Send cached summary immediately to sidepanel
        this.forwardToSidepanel({
          action: CONFIG.MESSAGES.SUMMARY_UPDATE,
          tabId,
          summary: cachedSummary,
          fromCache: true
        });
        return;
      }
      
      // Mark this summary as being generated
      this.ongoingSummaries.add(summaryKey);
      console.log(`🔄 SUMMARY: Starting generation for ${title} (${url}) in ${targetLanguage}`);
      
      try {
        // Generate summary in background
        const summary = await this.apiManager.generateSummary(text, targetLanguage, url);
        
        console.log(`✅ SUMMARY: Generated for ${title} (${url}) in ${targetLanguage}`);
        console.log(`📄 SUMMARY CONTENT:`, {
          title: summary.title,
          points: summary.points?.map(p => `${p.emoji} ${p.text}`) || []
        });
        
        // Cache the result for future use
        this.cacheManager.setSummary(url, targetLanguage, summary);
        
        // Send summary to sidepanel
        this.forwardToSidepanel({
          action: CONFIG.MESSAGES.SUMMARY_UPDATE,
          tabId,
          summary,
          fromCache: false
        });
        
      } finally {
        // Always remove from ongoing set when done
        this.ongoingSummaries.delete(summaryKey);
      }
      
    } catch (error) {
      console.log(`❌ SUMMARY: Failed to generate for ${content.title} (${content.url}) - ${error.message}`);
      Logger.error('Auto-summary generation failed', error, 'MessageRouter');
      
      // Clean up ongoing summaries tracking
      const userPrefs = await chrome.storage.sync.get(['targetLanguage']);
      const targetLanguage = userPrefs.targetLanguage || 'English';
      const summaryKey = `${content.url}:${targetLanguage}`;
      this.ongoingSummaries.delete(summaryKey);
      
      // Send fallback summary to sidepanel
      this.forwardToSidepanel({
        action: CONFIG.MESSAGES.SUMMARY_UPDATE,
        tabId,
        summary: this.apiManager.createLocalizedFallback(targetLanguage, 'loading'),
        fromCache: false,
        error: true
      });
    }
  }

  /**
   * Handle content script error notification with intelligent filtering
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handleContentScriptError(message, sender, sendResponse) {
    Logger.error('Content script error', message, 'MessageRouter');

    // Clear any ongoing translation state
    if (sender.tab?.id) {
      this.stateManager.setTranslationState(sender.tab.id, { isTranslating: false });
    }

    // Only forward critical errors that the user needs to know about
    const errorMessage = message.error || '';
    const isCriticalError = (
      errorMessage.includes('Authentication') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('Service unavailable') ||
      errorMessage.includes('API key') ||
      message.context === 'critical'
    );

    // For non-critical errors (network timeouts, temporary failures), 
    // just log them and let the retry system handle it
    if (isCriticalError) {
      // Forward critical errors to sidepanel
      this.forwardToSidepanel({
        action: CONFIG.MESSAGES.TRANSLATION_ERROR,
        error: message.error,
        context: message.context
      });
    } else {
      // For minor errors, just log and don't bother the user
      Logger.info('Non-critical content script error handled silently', 'MessageRouter');
    }

    // Acknowledge the error notification
    if (sendResponse) sendResponse({ success: true });
  }

  /**
   * Handle content script ready notification
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handleContentScriptReady(message, sender, sendResponse) {
    const tabId = sender.tab?.id;
    if (tabId) {
      this.stateManager.markTabActive(tabId);
      Logger.info(`Content script ready in tab ${tabId}`, null, 'MessageRouter');
    }

    // Acknowledge the ready notification
    if (sendResponse) sendResponse({ success: true });
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
      }, CONFIG.COMMUNICATION.CONTENT_SCRIPT_TIMEOUT);

      // Check if tab exists and is accessible
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          clearTimeout(timeout);
          reject(new Error(`Tab ${tabId} not accessible: ${chrome.runtime.lastError.message}`));
          return;
        }

        // Send message to content script
        chrome.tabs.sendMessage(tabId, message, (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            // Handle specific content script errors
            const errorMsg = chrome.runtime.lastError.message;
            if (errorMsg.includes('Could not establish connection')) {
              reject(new Error(`Content script not ready in tab ${tabId}. Please refresh the page.`));
            } else {
              reject(new Error(errorMsg));
            }
          } else {
            resolve(response || { success: true });
          }
        });
      });
    });
  }

  /**
   * Send message to content script with retry logic
   * @param {number} tabId - Tab ID
   * @param {Object} message - Message to send
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<Object>} Response from content script
   * @private
   */
  async sendToContentScriptWithRetry(tabId, message, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.sendToContentScript(tabId, message);
        return response;
      } catch (error) {
        lastError = error;
        Logger.warn(`Content script communication attempt ${attempt}/${maxRetries} failed:`, error.message, 'MessageRouter');
        
        // Don't retry for certain types of errors
        if (error.message.includes('Tab') && error.message.includes('not accessible')) {
          throw error; // Tab doesn't exist, no point retrying
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError || new Error('All communication attempts failed');
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

      // Try to send message to content script with retries
      let response;
      try {
        response = await this.sendToContentScriptWithRetry(tabId, {
          action: CONFIG.MESSAGES.START_CONTINUOUS_TRANSLATION,
          sourceLanguage,
          targetLanguage
        }, 3);
      } catch (error) {
        // If content script is not ready, provide helpful error message
        if (error.message.includes('Content script not ready') || 
            error.message.includes('Could not establish connection')) {
          throw new Error('Content script not ready in tab ' + tabId + '. Please refresh the page.');
        }
        throw error;
      }

      sendResponse(response);
    } catch (error) {
      Logger.error('Failed to start continuous translation', error, 'MessageRouter');
      // Disable continuous translation since it failed to start
      this.stateManager.disableContinuousTranslation(tabId);
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

      // Disable continuous translation in state first
      this.stateManager.disableContinuousTranslation(tabId);

      // Try to send message to content script with retries
      try {
        const response = await this.sendToContentScriptWithRetry(tabId, {
          action: CONFIG.MESSAGES.STOP_CONTINUOUS_TRANSLATION
        }, 2); // Fewer retries for stop operation
        
        sendResponse(response);
      } catch (error) {
        // If content script is not accessible, that's fine - translation is already disabled in state
        if (error.message.includes('Content script not ready') || 
            error.message.includes('Could not establish connection') ||
            error.message.includes('not accessible')) {
          Logger.info('Content script not accessible for stop command - state already cleared', 'MessageRouter');
          sendResponse({ success: true, message: 'Continuous translation stopped (content script not accessible)' });
        } else {
          throw error;
        }
      }
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

      // Try to send message to content script with retries
      try {
        const response = await this.sendToContentScriptWithRetry(tabId, {
          action: CONFIG.MESSAGES.UPDATE_CONTINUOUS_LANGUAGE,
          sourceLanguage,
          targetLanguage
        }, 3);
        
        sendResponse(response);
      } catch (error) {
        // If content script is not ready, provide helpful error message
        if (error.message.includes('Content script not ready') || 
            error.message.includes('Could not establish connection')) {
          throw new Error('Content script not ready in tab ' + tabId + '. Please refresh the page.');
        }
        throw error;
      }
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
  handleSidepanelClosed(message, sender, sendResponse) {
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

    // Acknowledge the sidepanel closed notification
    if (sendResponse) sendResponse({ success: true });
  }

  /**
   * Handle translation started notification
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handleTranslationStarted(message, sender, sendResponse) {
    if (sender.tab?.id) {
      this.stateManager.setTranslationState(sender.tab.id, {
        isTranslating: true,
        startTime: Date.now()
      });
    }

    // Forward to sidepanel
    this.forwardToSidepanel(message);
    Logger.debug('Translation started notification handled', null, 'MessageRouter');

    // Acknowledge the translation started notification
    if (sendResponse) sendResponse({ success: true });
  }

  /**
   * Handle translation complete notification
   * @param {Object} message - Message data
   * @param {Object} sender - Sender information
   * @private
   */
  handleTranslationComplete(message, sender, sendResponse) {
    if (sender.tab?.id) {
      this.stateManager.setTranslationState(sender.tab.id, {
        isTranslating: false,
        lastTranslationTime: Date.now()
      });
    }

    // Forward to sidepanel
    this.forwardToSidepanel(message);
    Logger.debug('Translation complete notification handled', null, 'MessageRouter');

    // Acknowledge the translation complete notification
    if (sendResponse) sendResponse({ success: true });
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
    Logger.info('Uno Translate background service worker initialized', 'BackgroundApp');
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