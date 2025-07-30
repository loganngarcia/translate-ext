/**
 * @fileoverview Centralized constants for AI Page Translator Chrome Extension
 * 
 * This file contains all configuration values, API endpoints, and shared constants
 * used throughout the extension. Centralizing these makes the codebase easier to
 * maintain and configure.
 * 
 * @author AI Page Translator Team
 * @version 1.0.0
 */

// =============================================================================
// API CONFIGURATION
// =============================================================================

/**
 * AWS API configuration
 * @namespace
 */
export const API = {
  /** Base URL for AWS API Gateway endpoint */
  BASE_URL: 'https://your-api-gateway-url.amazonaws.com/prod',
  
  /** API endpoints */
  ENDPOINTS: {
    TRANSLATE: '/translate',
    SUMMARIZE: '/summarize',
    DETECT_LANGUAGE: '/detect-language'
  },
  
  /** AWS Nova-lite model configuration */
  NOVA: {
    MODEL_ID: 'us.amazon.nova-lite-v1:0',
    MAX_TOKENS: 4000,
    TEMPERATURE: 0.3,
    MAX_CONTENT_LENGTH: 10000
  },
  
  /** Request configuration */
  REQUEST: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // milliseconds
    TIMEOUT: 30000     // 30 seconds
  }
};

// =============================================================================
// UI CONFIGURATION
// =============================================================================

/**
 * User interface constants
 * @namespace
 */
export const UI = {
  /** Sidepanel dimensions */
  SIDEPANEL: {
    DEFAULT_WIDTH: 360,
    DEFAULT_HEIGHT: 670,
    MIN_WIDTH: 320,
    MIN_HEIGHT: 500
  },
  
  /** Animation timings */
  ANIMATIONS: {
    FAST: 200,    // Fast transitions (0.2s)
    NORMAL: 300,  // Normal transitions (0.3s)
    SLOW: 500,    // Slow transitions (0.5s)
    COPY_FEEDBACK: 2000 // Copy success feedback duration
  },
  
  /** Colors matching design system */
  COLORS: {
    PRIMARY: '#277AD9',
    PRIMARY_HOVER: '#1e6bc7',
    BACKGROUND: '#FCFCFC',
    TEXT_PRIMARY: 'rgba(0, 0, 0, 0.95)',
    TEXT_SECONDARY: 'rgba(0, 0, 0, 0.45)',
    SURFACE: '#EBEBEB',
    SUCCESS: '#34C759',
    ERROR: '#FF3B30',
    WARNING: '#FF9500'
  },
  
  /** Z-index values */
  Z_INDEX: {
    LOADING_OVERLAY: 999999,
    TRANSLATION_TOGGLE: 999998,
    TOOLTIP: 1000
  }
};

// =============================================================================
// CONTENT PROCESSING
// =============================================================================

/**
 * Content processing configuration
 * @namespace
 */
export const CONTENT = {
  /** Text extraction settings */
  EXTRACTION: {
    MIN_TEXT_LENGTH: 3,
    MAX_TEXT_LENGTH: 5000,
    CHUNK_SIZE: 2000
  },
  
  /** DOM selectors for text elements */
  SELECTORS: {
    TEXT_ELEMENTS: 'p, h1, h2, h3, h4, h5, h6, span, div, a, li, td, th, label, button, [aria-label]',
    SKIP_ELEMENTS: 'script, style, code, pre, noscript',
    SKIP_CLASSES: ['nav', 'menu', 'header', 'footer', 'sidebar', 'toolbar'],
    NAVIGATION: [
      'nav', 'header', 'footer', '[role="navigation"]',
      '[role="banner"]', '[role="contentinfo"]', '.nav', '.menu'
    ]
  },
  
  /** Content validation */
  VALIDATION: {
    MAX_CONTENT_SIZE: 50000, // characters
    MIN_WORDS_PER_SENTENCE: 2,
    MAX_TRANSLATION_CHUNKS: 10
  }
};

// =============================================================================
// STORAGE CONFIGURATION
// =============================================================================

/**
 * Chrome storage configuration
 * @namespace
 */
export const STORAGE = {
  /** Storage keys */
  KEYS: {
    TARGET_LANGUAGE: 'targetLanguage',
    USER_PREFERENCES: 'userPreferences',
    TRANSLATION_CACHE: 'translationCache',
    LAST_USED_LANGUAGES: 'lastUsedLanguages'
  },
  
  /** Cache settings */
  CACHE: {
    MAX_ENTRIES: 50,
    EXPIRY_HOURS: 24,
    CLEANUP_INTERVAL: 3600000 // 1 hour in milliseconds
  }
};

// =============================================================================
// LANGUAGE CONFIGURATION
// =============================================================================

/**
 * Language configuration and mappings
 * @namespace
 */
export const LANGUAGES = {
  /** Default language settings */
  DEFAULTS: {
    SOURCE: 'auto',
    TARGET: 'English',
    FALLBACK: 'en-US'
  },
  
  /** Supported languages for translation */
  SUPPORTED: [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
    'Russian', 'Japanese', 'Korean', 'Chinese', 'Arabic', 'Hindi',
    'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Polish',
    'Czech', 'Hungarian', 'Romanian', 'Bulgarian', 'Croatian', 'Serbian',
    'Slovak', 'Slovenian', 'Estonian', 'Latvian', 'Lithuanian', 'Greek',
    'Turkish', 'Hebrew', 'Thai', 'Vietnamese', 'Indonesian', 'Malay',
    'Filipino', 'Swahili', 'Afrikaans', 'Welsh', 'Irish', 'Scottish Gaelic',
    'Basque', 'Catalan', 'Galician', 'Esperanto', 'Latin', 'Ukrainian',
    'Belarusian', 'Albanian', 'Macedonian'
  ],
  
  /** Language code mappings for TTS and API calls */
  CODES: {
    'English': 'en-US',
    'Spanish': 'es-ES',
    'French': 'fr-FR',
    'German': 'de-DE',
    'Italian': 'it-IT',
    'Portuguese': 'pt-PT',
    'Russian': 'ru-RU',
    'Japanese': 'ja-JP',
    'Korean': 'ko-KR',
    'Chinese': 'zh-CN',
    'Arabic': 'ar-SA',
    'Hindi': 'hi-IN',
    'Dutch': 'nl-NL',
    'Swedish': 'sv-SE',
    'Norwegian': 'no-NO',
    'Danish': 'da-DK',
    'Finnish': 'fi-FI',
    'Polish': 'pl-PL',
    'Czech': 'cs-CZ',
    'Hungarian': 'hu-HU',
    'Romanian': 'ro-RO',
    'Bulgarian': 'bg-BG',
    'Croatian': 'hr-HR',
    'Serbian': 'sr-RS',
    'Slovak': 'sk-SK',
    'Slovenian': 'sl-SI',
    'Estonian': 'et-EE',
    'Latvian': 'lv-LV',
    'Lithuanian': 'lt-LT',
    'Greek': 'el-GR',
    'Turkish': 'tr-TR',
    'Hebrew': 'he-IL',
    'Thai': 'th-TH',
    'Vietnamese': 'vi-VN',
    'Indonesian': 'id-ID',
    'Malay': 'ms-MY',
    'Filipino': 'fil-PH',
    'Swahili': 'sw-KE',
    'Afrikaans': 'af-ZA',
    'Welsh': 'cy-GB',
    'Irish': 'ga-IE',
    'Ukrainian': 'uk-UA',
    'Belarusian': 'be-BY',
    'Albanian': 'sq-AL',
    'Macedonian': 'mk-MK'
  }
};

// =============================================================================
// SPEECH SYNTHESIS CONFIGURATION
// =============================================================================

/**
 * Text-to-speech configuration
 * @namespace
 */
export const SPEECH = {
  /** Default speech settings */
  DEFAULTS: {
    RATE: 0.9,
    PITCH: 1,
    VOLUME: 1
  },
  
  /** Speech timeouts */
  TIMEOUTS: {
    MAX_SPEECH_DURATION: 300000, // 5 minutes
    SPEECH_CHECK_INTERVAL: 1000   // 1 second
  }
};

// =============================================================================
// ERROR MESSAGES
// =============================================================================

/**
 * User-friendly error messages
 * @namespace
 */
export const ERRORS = {
  /** Generic errors */
  GENERIC: {
    UNKNOWN: 'An unexpected error occurred. Please try again.',
    NETWORK: 'Network connection failed. Please check your internet connection.',
    TIMEOUT: 'Request timed out. Please try again.',
    PERMISSION_DENIED: 'Permission denied. Please check extension permissions.'
  },
  
  /** Translation-specific errors */
  TRANSLATION: {
    NO_CONTENT: 'No content found to translate on this page.',
    LANGUAGE_NOT_SUPPORTED: 'Selected language is not supported.',
    TRANSLATION_FAILED: 'Translation failed. Please try again.',
    ALREADY_IN_PROGRESS: 'Translation is already in progress.',
    API_LIMIT_EXCEEDED: 'API limit exceeded. Please try again later.'
  },
  
  /** TTS errors */
  SPEECH: {
    NOT_SUPPORTED: 'Text-to-speech is not supported in this browser.',
    NO_CONTENT: 'No content available to read aloud.',
    SYNTHESIS_FAILED: 'Speech synthesis failed. Please try again.'
  },
  
  /** Storage errors */
  STORAGE: {
    SAVE_FAILED: 'Failed to save preferences.',
    LOAD_FAILED: 'Failed to load preferences.',
    QUOTA_EXCEEDED: 'Storage quota exceeded.'
  }
};

// =============================================================================
// SUCCESS MESSAGES
// =============================================================================

/**
 * User-friendly success messages
 * @namespace
 */
export const SUCCESS = {
  TRANSLATION: {
    COMPLETED: 'Translation completed successfully!',
    CACHED: 'Translation loaded from cache.'
  },
  
  COPY: {
    SUMMARY_COPIED: 'Summary copied to clipboard!'
  },
  
  SPEECH: {
    STARTED: 'Reading summary aloud...',
    STOPPED: 'Speech stopped.'
  }
};

// =============================================================================
// DEVELOPMENT CONFIGURATION
// =============================================================================

/**
 * Development and debugging configuration
 * @namespace
 */
export const DEBUG = {
  /** Logging levels */
  LOG_LEVELS: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  },
  
  /** Current log level (change for development) */
  CURRENT_LOG_LEVEL: 2, // INFO
  
  /** Performance monitoring */
  PERFORMANCE: {
    ENABLE_TIMING: true,
    SLOW_OPERATION_THRESHOLD: 1000 // milliseconds
  }
};

// =============================================================================
// CHROME EXTENSION SPECIFIC
// =============================================================================

/**
 * Chrome extension specific constants
 * @namespace
 */
export const CHROME = {
  /** Message types for inter-script communication */
  MESSAGES: {
    EXTRACT_CONTENT: 'extractContent',
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
    SIDEPANEL_CLOSED: 'sidepanelClosed'
  },
  
  /** Tab and window management */
  TABS: {
    QUERY_TIMEOUT: 5000 // milliseconds
  }
};

// =============================================================================
// REGEX PATTERNS
// =============================================================================

/**
 * Regular expression patterns used throughout the application
 * @namespace
 */
export const PATTERNS = {
  /** Text processing patterns */
  TEXT: {
    SENTENCE_SPLIT: /(?<=[.!?])\s+/,
    WHITESPACE_NORMALIZE: /\s+/g,
    CONTROL_CHARS: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
    SPECIAL_CHARS: /[^\w\s\-.,!?;:()\[\]{}'"]/g
  },
  
  /** URL patterns */
  URL: {
    DOMAIN_EXTRACT: /^https?:\/\/(?:www\.)?([^\/]+)/i,
    VALID_URL: /^https?:\/\/.+/i
  }
};

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

/**
 * Default export containing all constants
 * This allows importing the entire constants object or specific namespaces
 */
export default {
  API,
  UI,
  CONTENT,
  STORAGE,
  LANGUAGES,
  SPEECH,
  ERRORS,
  SUCCESS,
  DEBUG,
  CHROME,
  PATTERNS
}; 