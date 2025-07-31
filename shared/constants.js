/**
 * @fileoverview Centralized constants for Uno Translate Chrome Extension
 * 
 * This file contains all configuration values, API endpoints, and shared constants
 * used throughout the extension. Centralizing these makes the codebase easier to
 * maintain and configure.
 * 
 * @author Uno Translate Team
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
    SUMMARY_EXPIRY_HOURS: 6, // Summaries expire faster as content may change
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
  
  /** Supported languages for translation - sorted by global speakers (native + second language) */
  SUPPORTED: [
    // Top 10 most spoken languages globally
    'English / English',           // ~1.5 billion speakers
    'Mandarin Chinese / 普通话',  // ~1.1 billion speakers  
    'Hindi / हिन्दी',             // ~600 million speakers
    'Spanish / Español',           // ~500 million speakers
    'French / Français',            // ~280 million speakers
    'Standard Arabic / العربية الفصحى',   // ~250 million speakers
    'Bengali / বাংলা',           // ~300 million speakers
    'Russian / Русский',           // ~260 million speakers
    'Portuguese / Português',        // ~260 million speakers
    'Indonesian / Bahasa Indonesia',        // ~200 million speakers
    
    // 11-30 most spoken languages
    'Urdu / اردو',              // ~170 million speakers
    'German / Deutsch',            // ~130 million speakers
    'Japanese / 日本語',          // ~125 million speakers
    'Swahili / Kiswahili',           // ~200 million speakers (L2)
    'Marathi / मराठी',           // ~95 million speakers
    'Telugu / తెలుగు',            // ~95 million speakers
    'Turkish / Türkçe',           // ~90 million speakers
    'Tamil / தமிழ்',             // ~80 million speakers
    'Yue Chinese / 粵語',       // ~85 million speakers
    'Vietnamese / Tiếng Việt',        // ~85 million speakers
    'Korean / 한국어',            // ~80 million speakers
    'Italian / Italiano',           // ~65 million speakers
    'Thai / ไทย',              // ~60 million speakers
    'Gujarati / ગુજરાતી',          // ~60 million speakers
    'Jin Chinese / 晉語',       // ~63 million speakers
    'Persian / فارسی',           // ~70 million speakers
    'Malay / Bahasa Melayu',             // ~80 million speakers
    'Kannada / ಕನ್ನಡ',           // ~45 million speakers
    'Burmese / မြန်မာဘာသာ',           // ~35 million speakers
    'Ukrainian / Українська',         // ~40 million speakers
    
    // 31-60 most spoken languages
    'Bhojpuri / भोजपुरी',          // ~52 million speakers
    'Tagalog / Tagalog',           // ~45 million speakers
    'Yoruba / Yorùbá',            // ~45 million speakers
    'Odia / ଓଡ଼ିଆ',              // ~38 million speakers
    'Maithili / मैथिली',          // ~35 million speakers
    'Uzbek / Oʻzbekcha',             // ~34 million speakers
    'Sindhi / سنڌي',            // ~30 million speakers
    'Amharic / አማርኛ',           // ~35 million speakers
    'Fula / Fulfulde',              // ~40 million speakers
    'Romanian / Română',          // ~20 million speakers
    'Oromo / Afaan Oromoo',             // ~37 million speakers
    'Igbo / Igbo',              // ~27 million speakers
    'Azerbaijani / Azərbaycan dili',       // ~24 million speakers
    'Awadhi / अवधी',            // ~40 million speakers
    'Gan Chinese / 贛語',       // ~31 million speakers
    'Cebuano / Cebuano',           // ~25 million speakers
    'Dutch / Nederlands',             // ~24 million speakers
    'Kurdish / کوردی',           // ~30 million speakers
    'Serbo-Croatian / Српскохрватски',    // ~21 million speakers
    'Malagasy / Malagasy',          // ~25 million speakers
    
    // 61-90 most spoken languages  
    'Saraiki / سرائیکی',           // ~26 million speakers
    'Nepali / नेपाली',            // ~16 million speakers
    'Sinhala / සිංහල',           // ~17 million speakers
    'Chittagonian / চাটগাঁইয়া',      // ~16 million speakers
    'Zhuang / Vahcuengh',            // ~18 million speakers
    'Khmer / ខ្មែរ',             // ~16 million speakers
    'Turkmen / Türkmen dili',           // ~12 million speakers
    'Assamese / অসমীয়া',          // ~15 million speakers
    'Madurese / Basa Madhura',          // ~15 million speakers
    'Somali / Soomaali',            // ~16 million speakers
    'Marwari / मारवाड़ी',           // ~13 million speakers
    'Magahi / मगही',            // ~13 million speakers
    'Haryanvi / हरियाणवी',          // ~13 million speakers
    'Hungarian / Magyar',         // ~13 million speakers
    'Chewa / Chichewa',             // ~12 million speakers
    'Greek / Ελληνικά',             // ~13 million speakers
    'Chhatisgarhi / छत्तीसगढ़ी',      // ~12 million speakers
    'Deccan / دکنی',            // ~13 million speakers
    'Akan / Akan',              // ~11 million speakers
    'Kazakh / Қазақша',            // ~12 million speakers
    
    // 91-120 most spoken languages
    'Northern Min / 閩北語',      // ~10 million speakers
    'Sylheti / সিলেটি',           // ~11 million speakers
    'Zulu / isiZulu',              // ~12 million speakers
    'Czech / Čeština',             // ~10 million speakers
    'Kinyarwanda / Ikinyarwanda',       // ~12 million speakers
    'Dhundhari / ढूंढाड़ी',         // ~11 million speakers
    'Haitian Creole / Kreyòl Ayisyen',    // ~12 million speakers
    'Eastern Min / 閩東語',       // ~10 million speakers
    'Ilocano / Ilokano',           // ~10 million speakers
    'Quechua / Runa Simi',           // ~8 million speakers
    'Kirundi / Ikirundi',           // ~9 million speakers
    'Swedish / Svenska',           // ~10 million speakers
    'Hmong / Hmoob',             // ~9 million speakers
    'Shona / chiShona',             // ~11 million speakers
    'Uyghur / ئۇيغۇرچە',            // ~10 million speakers
    'Hiligaynon / Ilonggo',        // ~9 million speakers
    'Mossi / Mooré',             // ~8 million speakers
    'Xhosa / isiXhosa',             // ~8 million speakers
    'Belarusian / Беларуская',        // ~5 million speakers
    'Balochi / بلۏچی',           // ~8 million speakers
    
    // Additional European and other languages
    'Polish / Polski',            // ~45 million speakers
    'Afrikaans / Afrikaans',         // ~7 million speakers
    'Albanian / Shqip',          // ~6 million speakers
    'Armenian / Հայերեն',          // ~7 million speakers
    'Basque / Euskera',            // ~1 million speakers
    'Bosnian / Bosanski',           // ~3 million speakers
    'Bulgarian / Български',         // ~8 million speakers
    'Catalan / Català',           // ~10 million speakers
    'Croatian / Hrvatski',          // ~5 million speakers
    'Danish / Dansk',            // ~6 million speakers
    'Estonian / Eesti',          // ~1 million speakers
    'Finnish / Suomi',           // ~5 million speakers
    'Galician / Galego',          // ~2.4 million speakers
    'Georgian / ქართული',          // ~4 million speakers
    'Hebrew / עברית',            // ~9 million speakers
    'Icelandic / Íslenska',         // ~300k speakers
    'Irish / Gaeilge',             // ~1.7 million speakers
    'Latvian / Latviešu',           // ~1.3 million speakers
    'Lithuanian / Lietuvių',        // ~3 million speakers
    'Luxembourgish / Lëtzebuergesch',     // ~400k speakers
    'Macedonian / Македонски',        // ~2 million speakers
    'Maltese / Malti',           // ~520k speakers
    'Montenegrin / Crnogorski',       // ~300k speakers
    'Norwegian / Norsk',         // ~5 million speakers
    'Scottish Gaelic / Gàidhlig',   // ~57k speakers
    'Serbian / Српски',           // ~8 million speakers
    'Slovak / Slovenčina',           // ~5 million speakers
    'Slovenian / Slovenščina',         // ~2.5 million speakers
    'Welsh / Cymraeg',             // ~580k speakers
    
    // Additional Asian and African languages
    'Bambara / Bamanankan',           // ~15 million speakers
    'Ewe / Èʋegbe',               // ~6 million speakers
    'Hausa / Harshen Hausa',             // ~70 million speakers
    'Lingala / Lingála',           // ~15 million speakers
    'Luganda / Luganda',           // ~5.6 million speakers
    'Twi / Twi',               // ~17 million speakers
    'Wolof / Wolof',             // ~5.2 million speakers
    'Tigrinya / ትግርኛ',          // ~9 million speakers
    'Kongo / Kikongo',             // ~7 million speakers
    'Luo / Dholuo',               // ~4.2 million speakers
    'Bemba / Ichibemba',             // ~4 million speakers
    'Tonga / chiTonga',             // ~1.8 million speakers
    'Ndebele / isiNdebele',           // ~2.1 million speakers
    'Venda / Tshivenḓa',             // ~1.2 million speakers
    'Tsonga / Xitsonga',            // ~4.4 million speakers
    'Swazi / siSwati',             // ~2.3 million speakers
    'Sotho / Sesotho',             // ~5.6 million speakers
    'Pedi / Sepedi',              // ~4.7 million speakers
    'Lao / ລາວ',               // ~30 million speakers
    'Mongolian / Монгол хэл',         // ~5.7 million speakers
    'Tibetan / བོད་ཡིག',           // ~6 million speakers
    'Dzongkha / རྫོང་ཁ',          // ~630k speakers
    'Filipino / Filipino',          // ~45 million speakers
    
    // Classical and constructed languages
    'Latin / Latina',             // Classical language
    'Esperanto / Esperanto',         // ~2 million speakers
    'Sanskrit / संस्कृतम्'           // Classical language
  ],
  
  /** Language code mappings for TTS and API calls */
  CODES: {
    // Major world languages
    'English / English': 'en-US',
    'Mandarin Chinese / 普通话': 'zh-CN',
    'Hindi / हिन्दी': 'hi-IN',
    'Spanish / Español': 'es-ES',
    'French / Français': 'fr-FR',
    'Standard Arabic / العربية الفصحى': 'ar-SA',
    'Bengali / বাংলা': 'bn-BD',
    'Russian / Русский': 'ru-RU',
    'Portuguese / Português': 'pt-PT',
    'Indonesian / Bahasa Indonesia': 'id-ID',
    'Urdu / اردو': 'ur-PK',
    'German / Deutsch': 'de-DE',
    'Japanese / 日本語': 'ja-JP',
    'Swahili / Kiswahili': 'sw-KE',
    'Marathi / मराठी': 'mr-IN',
    'Telugu / తెలుగు': 'te-IN',
    'Turkish / Türkçe': 'tr-TR',
    'Tamil / தமிழ்': 'ta-IN',
    'Yue Chinese / 粵語': 'zh-HK',
    'Vietnamese / Tiếng Việt': 'vi-VN',
    'Korean / 한국어': 'ko-KR',
    'Italian / Italiano': 'it-IT',
    'Thai / ไทย': 'th-TH',
    'Gujarati / ગુજરાતી': 'gu-IN',
    'Jin Chinese / 晉語': 'zh-CN',
    'Persian / فارسی': 'fa-IR',
    'Malay / Bahasa Melayu': 'ms-MY',
    'Kannada / ಕನ್ನಡ': 'kn-IN',
    'Burmese / မြန်မာဘာသာ': 'my-MM',
    'Ukrainian / Українська': 'uk-UA',
    'Bhojpuri / भोजपुरी': 'bho-IN',
    'Tagalog / Tagalog': 'tl-PH',
    'Yoruba / Yorùbá': 'yo-NG',
    'Odia / ଓଡ଼ିଆ': 'or-IN',
    'Maithili / मैथिली': 'mai-IN',
    'Uzbek / Oʻzbekcha': 'uz-UZ',
    'Sindhi / سنڌي': 'sd-PK',
    'Amharic / አማርኛ': 'am-ET',
    'Fula / Fulfulde': 'ff-SN',
    'Romanian / Română': 'ro-RO',
    'Oromo / Afaan Oromoo': 'om-ET',
    'Igbo / Igbo': 'ig-NG',
    'Azerbaijani / Azərbaycan dili': 'az-AZ',
    'Awadhi / अवधी': 'awa-IN',
    'Gan Chinese / 贛語': 'zh-CN',
    'Cebuano / Cebuano': 'ceb-PH',
    'Dutch / Nederlands': 'nl-NL',
    'Kurdish / کوردی': 'ku-TR',
    'Serbo-Croatian / Српскохрватски': 'sh-RS',
    'Malagasy / Malagasy': 'mg-MG',
    'Saraiki / سرائیکی': 'skr-PK',
    'Nepali / नेपाली': 'ne-NP',
    'Sinhala / සිංහල': 'si-LK',
    'Chittagonian / চাটগাঁইয়া': 'ctg-BD',
    'Zhuang / Vahcuengh': 'za-CN',
    'Khmer / ខ្មែរ': 'km-KH',
    'Turkmen / Türkmen dili': 'tk-TM',
    'Assamese / অসমীয়া': 'as-IN',
    'Madurese / Basa Madhura': 'mad-ID',
    'Somali / Soomaali': 'so-SO',
    'Marwari / मारवाड़ी': 'mwr-IN',
    'Magahi / मगही': 'mag-IN',
    'Haryanvi / हरियाणवी': 'bgc-IN',
    'Hungarian / Magyar': 'hu-HU',
    'Chewa / Chichewa': 'ny-MW',
    'Greek / Ελληνικά': 'el-GR',
    'Chhatisgarhi / छत्तीसगढ़ी': 'hne-IN',
    'Deccan / دکنی': 'dcc-IN',
    'Akan / Akan': 'ak-GH',
    'Kazakh / Қазақша': 'kk-KZ',
    'Northern Min / 閩北語': 'mnp-CN',
    'Sylheti / সিলেটি': 'syl-BD',
    'Zulu / isiZulu': 'zu-ZA',
    'Czech / Čeština': 'cs-CZ',
    'Kinyarwanda / Ikinyarwanda': 'rw-RW',
    'Dhundhari / ढूंढाड़ी': 'dhd-IN',
    'Haitian Creole / Kreyòl Ayisyen': 'ht-HT',
    'Eastern Min / 閩東語': 'cdo-CN',
    'Ilocano / Ilokano': 'ilo-PH',
    'Quechua / Runa Simi': 'qu-PE',
    'Kirundi / Ikirundi': 'rn-BI',
    'Swedish / Svenska': 'sv-SE',
    'Hmong / Hmoob': 'hmn-CN',
    'Shona / chiShona': 'sn-ZW',
    'Uyghur / ئۇيغۇرچە': 'ug-CN',
    'Hiligaynon / Ilonggo': 'hil-PH',
    'Mossi / Mooré': 'mos-BF',
    'Xhosa / isiXhosa': 'xh-ZA',
    'Belarusian / Беларуская': 'be-BY',
    'Balochi / بلۏچی': 'bal-PK',
    'Polish / Polski': 'pl-PL',
    'Afrikaans / Afrikaans': 'af-ZA',
    'Albanian / Shqip': 'sq-AL',
    'Armenian / Հայերեն': 'hy-AM',
    'Basque / Euskera': 'eu-ES',
    'Bosnian / Bosanski': 'bs-BA',
    'Bulgarian / Български': 'bg-BG',
    'Catalan / Català': 'ca-ES',
    'Croatian / Hrvatski': 'hr-HR',
    'Danish / Dansk': 'da-DK',
    'Estonian / Eesti': 'et-EE',
    'Finnish / Suomi': 'fi-FI',
    'Galician / Galego': 'gl-ES',
    'Georgian / ქართული': 'ka-GE',
    'Hebrew / עברית': 'he-IL',
    'Icelandic / Íslenska': 'is-IS',
    'Irish / Gaeilge': 'ga-IE',
    'Latvian / Latviešu': 'lv-LV',
    'Lithuanian / Lietuvių': 'lt-LT',
    'Luxembourgish / Lëtzebuergesch': 'lb-LU',
    'Macedonian / Македонски': 'mk-MK',
    'Maltese / Malti': 'mt-MT',
    'Montenegrin / Crnogorski': 'cnr-ME',
    'Norwegian / Norsk': 'no-NO',
    'Scottish Gaelic / Gàidhlig': 'gd-GB',
    'Serbian / Српски': 'sr-RS',
    'Slovak / Slovenčina': 'sk-SK',
    'Slovenian / Slovenščina': 'sl-SI',
    'Welsh / Cymraeg': 'cy-GB',
    'Bambara / Bamanankan': 'bm-ML',
    'Ewe / Èʋegbe': 'ee-GH',
    'Hausa / Harshen Hausa': 'ha-NG',
    'Lingala / Lingála': 'ln-CD',
    'Luganda / Luganda': 'lg-UG',
    'Twi / Twi': 'tw-GH',
    'Wolof / Wolof': 'wo-SN',
    'Tigrinya / ትግርኛ': 'ti-ER',
    'Kongo / Kikongo': 'kg-CD',
    'Luo / Dholuo': 'luo-KE',
    'Bemba / Ichibemba': 'bem-ZM',
    'Tonga / chiTonga': 'to-TO',
    'Ndebele / isiNdebele': 'nd-ZW',
    'Venda / Tshivenḓa': 've-ZA',
    'Tsonga / Xitsonga': 'ts-ZA',
    'Swazi / siSwati': 'ss-SZ',
    'Sotho / Sesotho': 'st-ZA',
    'Pedi / Sepedi': 'nso-ZA',
    'Lao / ລາວ': 'lo-LA',
    'Mongolian / Монгол хэл': 'mn-MN',
    'Tibetan / བོད་ཡིག': 'bo-CN',
    'Dzongkha / རྫོང་ཁ': 'dz-BT',
    'Filipino / Filipino': 'fil-PH',
    'Latin / Latina': 'la-VA',
    'Esperanto / Esperanto': 'eo-001',
    'Sanskrit / संस्कृतम्': 'sa-IN'
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