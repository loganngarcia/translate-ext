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
    SUMMARIZE: '/summarize'
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
  
  /** Supported languages for translation - sorted by most spoken in USA */
  SUPPORTED: [
    // Top 20 most spoken languages in USA
    'English',                    // ~230M speakers
    'Spanish / Español',          // ~40M speakers
    'Chinese (Simplified) / 中文(简体)',  // ~2M speakers
    'Chinese (Traditional) / 中文(繁體)',  // ~1.5M speakers
    'French / Français',          // ~1.3M speakers
    'Filipino / Filipino',        // ~1.7M speakers
    'Vietnamese / Tiếng Việt',    // ~1.5M speakers
    'Arabic / العربية',          // ~1.2M speakers
    'Korean / 한국어',            // ~1.1M speakers
    'Russian / Русский',          // ~900K speakers
    'German / Deutsch',           // ~900K speakers
    'Haitian Creole / Kreyòl Ayisyen',  // ~800K speakers
    'Hindi / हिन्दी',            // ~700K speakers
    'Portuguese (Brazil) / Português (Brasil)',  // ~500K speakers
    'Italian / Italiano',         // ~600K speakers
    'Polish / Polski',            // ~600K speakers
    'Urdu / اردو',               // ~400K speakers
    'Japanese / 日本語',          // ~400K speakers
    'Persian / فارسی',            // ~400K speakers
    'Gujarati / ગુજરાતી',        // ~400K speakers
    
    // 21-50 most spoken languages in USA
    'Telugu / తెలుగు',           // ~400K speakers
    'Bengali / বাংলা',           // ~300K speakers
    'Thai / ไทย',               // ~250K speakers
    'Punjabi (Gurmukhi) / ਪੰਜਾਬੀ',  // ~300K speakers
    'Tamil / தமிழ்',            // ~250K speakers
    'Armenian / Հայերեն',         // ~250K speakers
    'Hebrew / עברית',            // ~220K speakers
    'Khmer / ខ្មែរ',            // ~200K speakers
    'Laotian / ລາວ',             // ~200K speakers
    'Dutch / Nederlands',         // ~150K speakers
    'Greek / Ελληνικά',          // ~150K speakers
    'Ukrainian / Українська',     // ~120K speakers
    'Hmong / Hmoob',             // ~200K speakers
    'Turkish / Türkçe',          // ~120K speakers
    'Marathi / मराठी',           // ~100K speakers
    'Kannada / ಕನ್ನಡ',          // ~100K speakers
    'Indonesian / Bahasa Indonesia',  // ~80K speakers
    'Somali / Soomaali',         // ~100K speakers
    'Amharic / አማርኛ',          // ~80K speakers
    'Malayalam / മലയാളം',        // ~80K speakers
    
    // 51-100 European and other immigrant languages
    'Czech / Čeština',           // ~70K speakers
    'Swedish / Svenska',         // ~70K speakers
    'Hungarian / Magyar',        // ~70K speakers
    'Norwegian / Norsk',         // ~60K speakers
    'Danish / Dansk',            // ~50K speakers
    'Finnish / Suomi',           // ~50K speakers
    'Romanian / Română',         // ~60K speakers
    'Bulgarian / Български',      // ~50K speakers
    'Slovak / Slovenčina',       // ~40K speakers
    'Croatian / Hrvatski',       // ~40K speakers
    'Lithuanian / Lietuvių',     // ~40K speakers
    'Latvian / Latviešu',        // ~30K speakers
    'Serbian / Српски',          // ~40K speakers
    'Bosnian / Bosanski',        // ~30K speakers
    'Albanian / Shqip',          // ~40K speakers
    'Estonian / Eesti',          // ~20K speakers
    'Slovenian / Slovenščina',   // ~20K speakers
    'Macedonian / Македонски',   // ~25K speakers
    'Portuguese (Portugal) / Português (Portugal)',  // ~200K speakers
    'Catalan / Català',          // ~30K speakers
    
    // African languages
    'Yoruba / Yorùbá',           // ~60K speakers
    'Igbo / Igbo',               // ~50K speakers
    'Swahili / Kiswahili',       // ~40K speakers
    'Oromo / Afaan Oromoo',      // ~30K speakers
    'Tigrinya / ትግርኛ',         // ~40K speakers
    'Wolof / Wolof',             // ~20K speakers
    'Twi / Twi',                 // ~30K speakers
    'Bambara / Bamanankan',      // ~15K speakers
    'Fulani / Fulfulde',         // ~20K speakers
    'Hausa / Harshen Hausa',     // ~25K speakers
    'Lingala / Lingála',         // ~15K speakers
    'Kinyarwanda / Ikinyarwanda', // ~15K speakers
    'Luganda / Luganda',         // ~10K speakers
    'Shona / chiShona',          // ~15K speakers
    'Zulu / isiZulu',            // ~10K speakers
    'Xhosa / isiXhosa',          // ~8K speakers
    
    // Additional Asian languages
    'Nepali / नेपाली',           // ~40K speakers
    'Sinhala / සිංහල',          // ~25K speakers
    'Burmese / မြန်မာဘာသာ',      // ~30K speakers
    'Mongolian / Монгол хэл',    // ~15K speakers
    'Tibetan / བོད་ཡིག',        // ~20K speakers
    'Uyghur / ئۇيغۇرچە',         // ~15K speakers
    'Kazakh / Қазақша',          // ~12K speakers
    'Uzbek / Oʻzbekcha',         // ~20K speakers
    'Kyrgyz / Кыргызча',         // ~8K speakers
    'Tajik / Тоҷикӣ',            // ~10K speakers
    'Turkmen / Türkmen dili',    // ~8K speakers
    'Pashto / پښتو',             // ~25K speakers
    'Dari / دری',                // ~20K speakers
    'Sindhi / سنڌي',            // ~15K speakers
    
    // Pacific and Oceanic languages
    'Samoan / Gagana Sāmoa',     // ~50K speakers
    'Tongan / Lea fakatonga',    // ~25K speakers
    'Fijian / Bau Fijian',       // ~15K speakers
    'Hawaiian / ʻŌlelo Hawaiʻi', // ~24K speakers
    'Marshallese / Kajin M̧ajeļ', // ~12K speakers
    'Chamorro / Fino\' Chamoru', // ~15K speakers
    'Chuukese / Chuukese',       // ~8K speakers
    
    // Native American languages
    'Navajo / Diné bizaad',      // ~170K speakers
    'Cherokee / ᏣᎳᎩ ᎦᏬᏂᎯᏍᏗ',      // ~2K speakers
    'Yupik / Yup\'ik',           // ~10K speakers
    'Inuktut (Syllabics) / ᐃᓄᒃᑎᑐᑦ', // ~8K speakers
    'Inuktut (Latin) / Inuktitut', // ~8K speakers
    
    // Celtic languages
    'Irish / Gaeilge',           // ~25K speakers
    'Welsh / Cymraeg',           // ~15K speakers
    'Scots Gaelic / Gàidhlig',   // ~3K speakers
    'Manx / Gaelg',              // ~2K speakers
    'Breton / Brezhoneg',        // ~3K speakers
    
    // Other European languages
    'Basque / Euskera',          // ~8K speakers
    'Maltese / Malti',           // ~5K speakers
    'Icelandic / Íslenska',      // ~4K speakers
    'Faroese / Føroyskt',        // ~2K speakers
    'Luxembourgish / Lëtzebuergesch', // ~3K speakers
    'Frisian / Frysk',           // ~2K speakers
    'Corsican / Corsu',          // ~5K speakers
    'Sardinian / Sardu',         // ~3K speakers
    'Galician / Galego',         // ~8K speakers
    
    // Additional languages from the user's list
    'Abkhaz / Аҧсуа бызшәа',     // ~2K speakers
    'Acehnese / Bahsa Acèh',     // ~3K speakers
    'Acholi / Luo',              // ~5K speakers
    'Afar / Afaraf',             // ~1K speakers
    'Afrikaans / Afrikaans',     // ~15K speakers
    'Alur / Alur',               // ~2K speakers
    'Assamese / অসমীয়া',        // ~10K speakers
    'Avar / Авар мацӏ',          // ~2K speakers
    'Awadhi / अवधी',             // ~5K speakers
    'Aymara / Aymar aru',        // ~3K speakers
    'Azerbaijani / Azərbaycan dili', // ~15K speakers
    'Balinese / Basa Bali',      // ~3K speakers
    'Baluchi / بلۏچی',           // ~8K speakers
    'Baoulé / Baoulé',           // ~2K speakers
    'Bashkir / Башҡорт теле',    // ~3K speakers
    'Batak Karo / Cakap Karo',   // ~2K speakers
    'Batak Simalungun / Hata Simalungun', // ~1K speakers
    'Batak Toba / Hata Batak',   // ~2K speakers
    'Belarusian / Беларуская',   // ~8K speakers
    'Bemba / Ichibemba',         // ~3K speakers
    'Betawi / Betawi',           // ~2K speakers
    'Bhojpuri / भोजपुरी',        // ~8K speakers
    'Bikol / Bikol',             // ~5K speakers
    'Cantonese / 粵語',           // ~500K speakers
    'Cebuano / Cebuano',         // ~80K speakers
    'Chechen / Нохчийн мотт',    // ~5K speakers
    'Chichewa / Chichewa',       // ~8K speakers
    'Chuvash / Чӑваш чӗлхи',     // ~2K speakers
    'Crimean Tatar (Cyrillic) / Къырымтатар тили', // ~3K speakers
    'Crimean Tatar (Latin) / Qırımtatar tili', // ~3K speakers
    'Dhivehi / ދިވެހި',          // ~2K speakers
    'Dinka / Thuɔŋjäŋ',          // ~8K speakers
    'Dogri / डोगरी',             // ~3K speakers
    'Dombe / Dombe',             // ~1K speakers
    'Dyula / Julakan',           // ~3K speakers
    'Dzongkha / རྫོང་ཁ',         // ~2K speakers
    'Esperanto / Esperanto',     // ~5K speakers
    'Ewe / Èʋegbe',              // ~5K speakers
    'Fon / Fongbe',              // ~3K speakers
    'French (Canada) / Français (Canada)', // ~100K speakers
    'Friulian / Furlan',         // ~2K speakers
    'Ga / Gã',                   // ~2K speakers
    'Georgian / ქართული',        // ~8K speakers
    'Guarani / Avañe\'ẽ',        // ~5K speakers
    'Hakha Chin / Laiholh',      // ~15K speakers
    'Hiligaynon / Ilonggo',      // ~20K speakers
    'Hunsrik / Hunsrik',         // ~3K speakers
    'Iban / Jaku Iban',          // ~2K speakers
    'Ilocano / Ilokano',         // ~150K speakers
    'Jamaican Patois / Patwa',   // ~80K speakers
    'Javanese / Basa Jawa',      // ~10K speakers
    'Jingpo / Jinghpaw',         // ~2K speakers
    'Kalaallisut / Kalaallisut', // ~1K speakers
    'Kanuri / Kanuri',           // ~3K speakers
    'Kapampangan / Kapampangan', // ~25K speakers
    'Khasi / Ka Ktien Khasi',    // ~2K speakers
    'Kiga / Rukiga',             // ~2K speakers
    'Kikongo / Kikongo',         // ~8K speakers
    'Kituba / Kituba',           // ~3K speakers
    'Kokborok / Kokborok',       // ~2K speakers
    'Komi / Коми кыв',           // ~1K speakers
    'Konkani / कोंकणी',          // ~5K speakers
    'Krio / Krio',               // ~3K speakers
    'Kurdish (Kurmanji) / Kurmancî', // ~15K speakers
    'Kurdish (Sorani) / سۆرانی', // ~10K speakers
    'Lao / ລາວ',                 // ~200K speakers (same as Laotian)
    'Latgalian / Latgalīšu',     // ~1K speakers
    'Latin / Latina',            // ~5K speakers
    'Ligurian / Ligure',         // ~2K speakers
    'Limburgish / Limburgs',     // ~2K speakers
    'Lombard / Lombard',         // ~3K speakers
    'Luo / Dholuo',              // ~5K speakers
    'Madurese / Basa Madhura',   // ~3K speakers
    'Maithili / मैथिली',         // ~8K speakers
    'Makassar / Basa Mangkasarak', // ~2K speakers
    'Malagasy / Malagasy',       // ~5K speakers
    'Malay / Bahasa Melayu',     // ~15K speakers
    'Malay (Jawi) / بهاس ملايو',  // ~8K speakers
    'Mam / Mam',                 // ~8K speakers
    'Maori / Te Reo Māori',      // ~3K speakers
    'Marwadi / मारवाड़ी',         // ~15K speakers
    'Mauritian Creole / Kreol Morisien', // ~5K speakers
    'Meadow Mari / Олык марий йылме', // ~1K speakers
    'Meiteilon (Manipuri) / মেইতেই লোন্', // ~3K speakers
    'Minang / Baso Minangkabau', // ~2K speakers
    'Mizo / Mizo ṭawng',         // ~3K speakers
    'Nahuatl (Eastern Huasteca) / Nāhuatl', // ~2K speakers
    'Ndau / ChiNdau',            // ~2K speakers
    'Ndebele (South) / isiNdebele', // ~3K speakers
    'Nepalbhasa (Newari) / नेपाल भाषा', // ~3K speakers
    'NKo / ߒߞߏ',                  // ~2K speakers
    'Nuer / Thok Naath',         // ~8K speakers
    'Occitan / Occitan',         // ~2K speakers
    'Odia (Oriya) / ଓଡ଼ିଆ',      // ~15K speakers
    'Ossetian / Ирон æвзаг',     // ~3K speakers
    'Pangasinan / Salitan Pangasinan', // ~8K speakers
    'Papiamento / Papiamentu',   // ~5K speakers
    'Punjabi (Shahmukhi) / پنجابی', // ~50K speakers
    'Quechua / Runa Simi',       // ~8K speakers
    'Qʼeqchiʼ / Qʼeqchiʼ',       // ~5K speakers
    'Romani / Romani čhib',      // ~8K speakers
    'Rundi / Ikirundi',          // ~5K speakers
    'Sami (North) / Davvisámegiella', // ~2K speakers
    'Sango / Sängö',             // ~3K speakers
    'Sanskrit / संस्कृतम्',       // ~3K speakers
    'Santali (Latin) / Santali', // ~2K speakers
    'Santali (Ol Chiki) / ᱥᱟᱱᱛᱟᱲᱤ', // ~2K speakers
    'Sepedi / Sepedi',           // ~5K speakers
    'Sesotho / Sesotho',         // ~8K speakers
    'Seychellois Creole / Seselwa', // ~2K speakers
    'Shan / လိၵ်ႈတႆး',           // ~3K speakers
    'Sicilian / Sicilianu',      // ~5K speakers
    'Silesian / Ślōnsko godka',  // ~3K speakers
    'Sundanese / Basa Sunda',    // ~5K speakers
    'Susu / Sosoxui',            // ~2K speakers
    'Swati / siSwati',           // ~3K speakers
    'Tahitian / Reo Tahiti',     // ~2K speakers
    'Tamazight / ⵜⴰⵎⴰⵣⵉⵖⵜ',      // ~3K speakers
    'Tamazight (Tifinagh) / ⵜⴰⵎⴰⵣⵉⵖⵜ', // ~3K speakers
    'Tatar / Татар теле',        // ~8K speakers
    'Tetum / Tetun',             // ~3K speakers
    'Tiv / Tiv',                 // ~3K speakers
    'Tok Pisin / Tok Pisin',     // ~2K speakers
    'Tshiluba / Tshiluba',       // ~5K speakers
    'Tsonga / Xitsonga',         // ~3K speakers
    'Tswana / Setswana',         // ~5K speakers
    'Tulu / ತುಳು',               // ~3K speakers
    'Tumbuka / Chitumbuka',      // ~2K speakers
    'Tuvan / Тыва дыл',          // ~1K speakers
    'Udmurt / Удмурт кыл',       // ~1K speakers
    'Venda / Tshivenḓa',         // ~3K speakers
    'Venetian / Vèneto',         // ~5K speakers
    'Waray / Winaray',           // ~15K speakers
    'Yakut / Саха тыла',         // ~2K speakers
    'Yiddish / יידיש',           // ~50K speakers
    'Yucatec Maya / Maaya T\'aan', // ~3K speakers
    'Zapotec / Diidxazá',        // ~8K speakers
  ],
  
  /** Language code mappings for TTS and API calls */
  CODES: {
    // Top languages in USA
    'English': 'en-US',
    'Spanish / Español': 'es-US',
    'Chinese (Simplified) / 中文(简体)': 'zh-CN',
    'Chinese (Traditional) / 中文(繁體)': 'zh-TW',
    'French / Français': 'fr-FR',
    'Filipino / Filipino': 'fil-PH',
    'Vietnamese / Tiếng Việt': 'vi-VN',
    'Arabic / العربية': 'ar-SA',
    'Korean / 한국어': 'ko-KR',
    'Russian / Русский': 'ru-RU',
    'German / Deutsch': 'de-DE',
    'Haitian Creole / Kreyòl Ayisyen': 'ht-HT',
    'Hindi / हिन्दी': 'hi-IN',
    'Portuguese (Brazil) / Português (Brasil)': 'pt-BR',
    'Italian / Italiano': 'it-IT',
    'Polish / Polski': 'pl-PL',
    'Urdu / اردو': 'ur-PK',
    'Japanese / 日本語': 'ja-JP',
    'Persian / فارسی': 'fa-IR',
    'Gujarati / ગુજરાતી': 'gu-IN',
    'Telugu / తెలుగు': 'te-IN',
    'Bengali / বাংলা': 'bn-BD',
    'Thai / ไทย': 'th-TH',
    'Punjabi (Gurmukhi) / ਪੰਜਾਬੀ': 'pa-IN',
    'Tamil / தமிழ்': 'ta-IN',
    'Armenian / Հայերեն': 'hy-AM',
    'Hebrew / עברית': 'he-IL',
    'Khmer / ខ្មែរ': 'km-KH',
    'Laotian / ລາວ': 'lo-LA',
    'Dutch / Nederlands': 'nl-NL',
    'Greek / Ελληνικά': 'el-GR',
    'Ukrainian / Українська': 'uk-UA',
    'Hmong / Hmoob': 'hmn-CN',
    'Turkish / Türkçe': 'tr-TR',
    'Marathi / मराठी': 'mr-IN',
    'Kannada / ಕನ್ನಡ': 'kn-IN',
    'Indonesian / Bahasa Indonesia': 'id-ID',
    'Somali / Soomaali': 'so-SO',
    'Amharic / አማርኛ': 'am-ET',
    'Malayalam / മലയാളം': 'ml-IN',
    'Czech / Čeština': 'cs-CZ',
    'Swedish / Svenska': 'sv-SE',
    'Hungarian / Magyar': 'hu-HU',
    'Norwegian / Norsk': 'no-NO',
    'Danish / Dansk': 'da-DK',
    'Finnish / Suomi': 'fi-FI',
    'Romanian / Română': 'ro-RO',
    'Bulgarian / Български': 'bg-BG',
    'Slovak / Slovenčina': 'sk-SK',
    'Croatian / Hrvatski': 'hr-HR',
    'Lithuanian / Lietuvių': 'lt-LT',
    'Latvian / Latviešu': 'lv-LV',
    'Serbian / Српски': 'sr-RS',
    'Bosnian / Bosanski': 'bs-BA',
    'Albanian / Shqip': 'sq-AL',
    'Estonian / Eesti': 'et-EE',
    'Slovenian / Slovenščina': 'sl-SI',
    'Macedonian / Македонски': 'mk-MK',
    'Portuguese (Portugal) / Português (Portugal)': 'pt-PT',
    'Catalan / Català': 'ca-ES',
    'Yoruba / Yorùbá': 'yo-NG',
    'Igbo / Igbo': 'ig-NG',
    'Swahili / Kiswahili': 'sw-KE',
    'Oromo / Afaan Oromoo': 'om-ET',
    'Tigrinya / ትግርኛ': 'ti-ER',
    'Wolof / Wolof': 'wo-SN',
    'Twi / Twi': 'tw-GH',
    'Bambara / Bamanankan': 'bm-ML',
    'Fulani / Fulfulde': 'ff-SN',
    'Hausa / Harshen Hausa': 'ha-NG',
    'Lingala / Lingála': 'ln-CD',
    'Kinyarwanda / Ikinyarwanda': 'rw-RW',
    'Luganda / Luganda': 'lg-UG',
    'Shona / chiShona': 'sn-ZW',
    'Zulu / isiZulu': 'zu-ZA',
    'Xhosa / isiXhosa': 'xh-ZA',
    'Nepali / नेपाली': 'ne-NP',
    'Sinhala / සිංහල': 'si-LK',
    'Burmese / မြန်မာဘာသာ': 'my-MM',
    'Mongolian / Монгол хэл': 'mn-MN',
    'Tibetan / བོད་ཡིག': 'bo-CN',
    'Uyghur / ئۇيغۇرچە': 'ug-CN',
    'Kazakh / Қазақша': 'kk-KZ',
    'Uzbek / Oʻzbekcha': 'uz-UZ',
    'Kyrgyz / Кыргызча': 'ky-KG',
    'Tajik / Тоҷикӣ': 'tg-TJ',
    'Turkmen / Türkmen dili': 'tk-TM',
    'Pashto / پښتو': 'ps-AF',
    'Dari / دری': 'prs-AF',
    'Sindhi / سنڌي': 'sd-PK',
    'Samoan / Gagana Sāmoa': 'sm-WS',
    'Tongan / Lea fakatonga': 'to-TO',
    'Fijian / Bau Fijian': 'fj-FJ',
    'Hawaiian / ʻŌlelo Hawaiʻi': 'haw-US',
    'Marshallese / Kajin M̧ajeļ': 'mh-MH',
    'Chamorro / Fino\' Chamoru': 'ch-GU',
    'Chuukese / Chuukese': 'chk-FM',
    'Navajo / Diné bizaad': 'nv-US',
    'Cherokee / ᏣᎳᎩ ᎦᏬᏂᎯᏍᏗ': 'chr-US',
    'Yupik / Yup\'ik': 'esu-US',
    'Inuktut (Syllabics) / ᐃᓄᒃᑎᑐᑦ': 'iu-CA',
    'Inuktut (Latin) / Inuktitut': 'iu-Latn-CA',
    'Irish / Gaeilge': 'ga-IE',
    'Welsh / Cymraeg': 'cy-GB',
    'Scots Gaelic / Gàidhlig': 'gd-GB',
    'Manx / Gaelg': 'gv-IM',
    'Breton / Brezhoneg': 'br-FR',
    'Basque / Euskera': 'eu-ES',
    'Maltese / Malti': 'mt-MT',
    'Icelandic / Íslenska': 'is-IS',
    'Faroese / Føroyskt': 'fo-FO',
    'Luxembourgish / Lëtzebuergesch': 'lb-LU',
    'Frisian / Frysk': 'fy-NL',
    'Corsican / Corsu': 'co-FR',
    'Sardinian / Sardu': 'sc-IT',
    'Galician / Galego': 'gl-ES',
    
    // Additional languages from user's list
    'Abkhaz / Аҧсуа бызшәа': 'ab-GE',
    'Acehnese / Bahsa Acèh': 'ace-ID',
    'Acholi / Luo': 'ach-UG',
    'Afar / Afaraf': 'aa-ET',
    'Afrikaans / Afrikaans': 'af-ZA',
    'Alur / Alur': 'alz-UG',
    'Assamese / অসমীয়া': 'as-IN',
    'Avar / Авар мацӏ': 'av-RU',
    'Awadhi / अवधी': 'awa-IN',
    'Aymara / Aymar aru': 'ay-BO',
    'Azerbaijani / Azərbaycan dili': 'az-AZ',
    'Balinese / Basa Bali': 'ban-ID',
    'Baluchi / بلۏچی': 'bal-PK',
    'Baoulé / Baoulé': 'bci-CI',
    'Bashkir / Башҡорт теле': 'ba-RU',
    'Batak Karo / Cakap Karo': 'btx-ID',
    'Batak Simalungun / Hata Simalungun': 'bts-ID',
    'Batak Toba / Hata Batak': 'bbc-ID',
    'Belarusian / Беларуская': 'be-BY',
    'Bemba / Ichibemba': 'bem-ZM',
    'Betawi / Betawi': 'bew-ID',
    'Bhojpuri / भोजपुरी': 'bho-IN',
    'Bikol / Bikol': 'bik-PH',
    'Cantonese / 粵語': 'yue-HK',
    'Cebuano / Cebuano': 'ceb-PH',
    'Chechen / Нохчийн мотт': 'ce-RU',
    'Chichewa / Chichewa': 'ny-MW',
    'Chuvash / Чӑваш чӗлхи': 'cv-RU',
    'Crimean Tatar (Cyrillic) / Къырымтатар тили': 'crh-UA',
    'Crimean Tatar (Latin) / Qırımtatar tili': 'crh-Latn-UA',
    'Dhivehi / ދިވެހި': 'dv-MV',
    'Dinka / Thuɔŋjäŋ': 'din-SS',
    'Dogri / डोगरी': 'doi-IN',
    'Dombe / Dombe': 'dov-MZ',
    'Dyula / Julakan': 'dyu-BF',
    'Dzongkha / རྫོང་ཁ': 'dz-BT',
    'Esperanto / Esperanto': 'eo-001',
    'Ewe / Èʋegbe': 'ee-GH',
    'Fon / Fongbe': 'fon-BJ',
    'French (Canada) / Français (Canada)': 'fr-CA',
    'Friulian / Furlan': 'fur-IT',
    'Ga / Gã': 'gaa-GH',
    'Georgian / ქართული': 'ka-GE',
    'Guarani / Avañe\'ẽ': 'gn-PY',
    'Hakha Chin / Laiholh': 'cnh-MM',
    'Hiligaynon / Ilonggo': 'hil-PH',
    'Hunsrik / Hunsrik': 'hrx-BR',
    'Iban / Jaku Iban': 'iba-MY',
    'Ilocano / Ilokano': 'ilo-PH',
    'Jamaican Patois / Patwa': 'jam-JM',
    'Javanese / Basa Jawa': 'jv-ID',
    'Jingpo / Jinghpaw': 'kac-MM',
    'Kalaallisut / Kalaallisut': 'kl-GL',
    'Kanuri / Kanuri': 'kr-NE',
    'Kapampangan / Kapampangan': 'pam-PH',
    'Khasi / Ka Ktien Khasi': 'kha-IN',
    'Kiga / Rukiga': 'cgg-UG',
    'Kikongo / Kikongo': 'kg-CD',
    'Kituba / Kituba': 'ktu-CD',
    'Kokborok / Kokborok': 'trp-IN',
    'Komi / Коми кыв': 'kv-RU',
    'Konkani / कोंकणी': 'kok-IN',
    'Krio / Krio': 'kri-SL',
    'Kurdish (Kurmanji) / Kurmancî': 'kmr-TR',
    'Kurdish (Sorani) / سۆرانی': 'ckb-IQ',
    'Lao / ລາວ': 'lo-LA',
    'Latgalian / Latgalīšu': 'ltg-LV',
    'Latin / Latina': 'la-VA',
    'Ligurian / Ligure': 'lij-IT',
    'Limburgish / Limburgs': 'li-NL',
    'Lombard / Lombard': 'lmo-IT',
    'Luo / Dholuo': 'luo-KE',
    'Madurese / Basa Madhura': 'mad-ID',
    'Maithili / मैथिली': 'mai-IN',
    'Makassar / Basa Mangkasarak': 'mak-ID',
    'Malagasy / Malagasy': 'mg-MG',
    'Malay / Bahasa Melayu': 'ms-MY',
    'Malay (Jawi) / بهاس ملايو': 'ms-Arab-MY',
    'Mam / Mam': 'mam-GT',
    'Maori / Te Reo Māori': 'mi-NZ',
    'Marwadi / मारवाड़ी': 'mwr-IN',
    'Mauritian Creole / Kreol Morisien': 'mfe-MU',
    'Meadow Mari / Олык марий йылме': 'mhr-RU',
    'Meiteilon (Manipuri) / মেইতেই লোন্': 'mni-IN',
    'Minang / Baso Minangkabau': 'min-ID',
    'Mizo / Mizo ṭawng': 'lus-IN',
    'Nahuatl (Eastern Huasteca) / Nāhuatl': 'nhe-MX',
    'Ndau / ChiNdau': 'ndc-ZW',
    'Ndebele (South) / isiNdebele': 'nr-ZA',
    'Nepalbhasa (Newari) / नेपाल भाषा': 'new-NP',
    'NKo / ߒߞߏ': 'nqo-GN',
    'Nuer / Thok Naath': 'nus-SS',
    'Occitan / Occitan': 'oc-FR',
    'Odia (Oriya) / ଓଡ଼ିଆ': 'or-IN',
    'Ossetian / Ирон æвзаг': 'os-GE',
    'Pangasinan / Salitan Pangasinan': 'pag-PH',
    'Papiamento / Papiamentu': 'pap-AW',
    'Punjabi (Shahmukhi) / پنجابی': 'pa-Arab-PK',
    'Quechua / Runa Simi': 'qu-PE',
    'Qʼeqchiʼ / Qʼeqchiʼ': 'kek-GT',
    'Romani / Romani čhib': 'rom-RO',
    'Rundi / Ikirundi': 'rn-BI',
    'Sami (North) / Davvisámegiella': 'se-NO',
    'Sango / Sängö': 'sg-CF',
    'Sanskrit / संस्कृतम्': 'sa-IN',
    'Santali (Latin) / Santali': 'sat-Latn-IN',
    'Santali (Ol Chiki) / ᱥᱟᱱᱛᱟᱲᱤ': 'sat-Olck-IN',
    'Sepedi / Sepedi': 'nso-ZA',
    'Sesotho / Sesotho': 'st-ZA',
    'Seychellois Creole / Seselwa': 'crs-SC',
    'Shan / လိၵ်ႈတႆး': 'shn-MM',
    'Sicilian / Sicilianu': 'scn-IT',
    'Silesian / Ślōnsko godka': 'szl-PL',
    'Sundanese / Basa Sunda': 'su-ID',
    'Susu / Sosoxui': 'sus-GN',
    'Swati / siSwati': 'ss-SZ',
    'Tahitian / Reo Tahiti': 'ty-PF',
    'Tamazight / ⵜⴰⵎⴰⵣⵉⵖⵜ': 'tzm-MA',
    'Tamazight (Tifinagh) / ⵜⴰⵎⴰⵣⵉⵖⵜ': 'tzm-Tfng-MA',
    'Tatar / Татар теле': 'tt-RU',
    'Tetum / Tetun': 'tet-TL',
    'Tiv / Tiv': 'tiv-NG',
    'Tok Pisin / Tok Pisin': 'tpi-PG',
    'Tshiluba / Tshiluba': 'lua-CD',
    'Tsonga / Xitsonga': 'ts-ZA',
    'Tswana / Setswana': 'tn-BW',
    'Tulu / ತುಳು': 'tcy-IN',
    'Tumbuka / Chitumbuka': 'tum-MW',
    'Tuvan / Тыва дыл': 'tyv-RU',
    'Udmurt / Удмурт кыл': 'udm-RU',
    'Venda / Tshivenḓa': 've-ZA',
    'Venetian / Vèneto': 'vec-IT',
    'Waray / Winaray': 'war-PH',
    'Yakut / Саха тыла': 'sah-RU',
    'Yiddish / יידיש': 'yi-001',
    'Yucatec Maya / Maaya T\'aan': 'yua-MX',
    'Zapotec / Diidxazá': 'zap-MX'
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