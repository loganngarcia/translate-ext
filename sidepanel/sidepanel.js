/**
 * @fileoverview Sidepanel JavaScript for Uno Translate Chrome Extension
 * 
 * This is the main UI controller for the sidepanel. It handles:
 * - Language selection and preference management
 * - Translation initiation and progress feedback
 * - AI summary display and formatting
 * - Text-to-speech functionality
 * - Copy operations with user feedback
 * - Inter-component communication with background scripts
 * 
 * Architecture:
 * - State management through AppStateManager
 * - Event handling through EventManager
 * - UI updates through UIManager
 * - Storage operations through StorageManager
 * - Speech functionality through SpeechManager
 * 
 * @author Uno Translate Team
 * @version 1.0.0
 */

// Import shared modules (Note: These imports work in Chrome extension context)
// In a real Chrome extension, these would be loaded differently since ES6 modules
// aren't fully supported in manifest v3. For now, we'll reference them globally.

// =============================================================================
// CONSTANTS AND CONFIGURATION
// =============================================================================

/**
 * Application configuration
 * @const {Object}
 */
const CONFIG = {
  // UI timing constants
  COPY_FEEDBACK_DURATION: 2000, // milliseconds
  ANIMATION_DURATION: 300,       // milliseconds
  RETRY_DELAY: 1000,            // milliseconds
  
  // Speech synthesis settings
  SPEECH: {
    RATE: 0.9,
    PITCH: 1,
    VOLUME: 1,
    MAX_DURATION: 300000 // 5 minutes
  },
  
  // Storage keys
  STORAGE_KEYS: {
    TARGET_LANGUAGE: 'targetLanguage',
    USER_PREFERENCES: 'userPreferences'
  },
  
  // Chrome message types
  MESSAGES: {
    TRANSLATE_PAGE: 'translatePage',
    UPDATE_SUMMARY: 'updateSummary',
    SUMMARY_UPDATE: 'summaryUpdate', // Auto-generated summary from background
    TRANSLATION_STARTED: 'translationStarted',
    TRANSLATION_COMPLETE: 'translationComplete',
    TRANSLATION_ERROR: 'translationError',
    PAGE_CONTENT_EXTRACTED: 'pageContentExtracted'
  },
  
  // Error types for better error handling
  ERROR_TYPES: {
    TRANSLATION: 'translation',
    SPEECH: 'speech',
    STORAGE: 'storage',
    NETWORK: 'network'
  }
};

/**
 * Default language mappings for TTS - comprehensive list sorted by most spoken in USA
 * @const {Object}
 */
const LANGUAGE_CODES = {
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
};

// =============================================================================
// APPLICATION STATE MANAGER
// =============================================================================

/**
 * Manages the application state in a centralized way
 * @class
 */
class AppStateManager {
  /**
   * Initialize the application state
   */
  constructor() {
    /** @type {Object} Application state object */
    this.state = {
      // Language settings
      currentLanguage: 'auto',
      targetLanguage: 'English',
      
      // Operation states
      isTranslating: false,
      isSpeaking: false,
      isInitialized: false,
      continuousTranslation: false,
      
      // Content data
      currentSummary: null,
      currentTabId: null,
      
      // UI state
      isAIOverviewVisible: false,
      
      // Speech synthesis
      speechSynthesis: null
    };
    
    /** @type {Array<Function>} State change listeners */
    this.listeners = [];
  }

  /**
   * Get current state value
   * @param {string} key - State key to retrieve
   * @returns {any} State value
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Set state value and notify listeners
   * @param {string} key - State key to set
   * @param {any} value - New value
   */
  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    
    this.notifyListeners(key, value, oldValue);
    this.logStateChange(key, value, oldValue);
  }

  /**
   * Update multiple state values at once
   * @param {Object} updates - Object with key-value pairs to update
   */
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function for state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of state change
   * @param {string} key - Changed key
   * @param {any} newValue - New value
   * @param {any} oldValue - Previous value
   * @private
   */
  notifyListeners(key, newValue, oldValue) {
    this.listeners.forEach(listener => {
      try {
        listener(key, newValue, oldValue);
      } catch (error) {
        Logger.error('State listener error', error, 'AppStateManager');
      }
    });
  }

  /**
   * Log state changes for debugging
   * @param {string} key - Changed key
   * @param {any} newValue - New value
   * @param {any} oldValue - Previous value
   * @private
   */
  logStateChange(key, newValue, oldValue) {
    if (newValue !== oldValue) {
      Logger.debug(`State changed: ${key}`, { oldValue, newValue }, 'AppStateManager');
    }
  }

  /**
   * Reset state to initial values
   */
  reset() {
    const initialState = {
      currentLanguage: 'auto',
      targetLanguage: 'English',
      isTranslating: false,
      isSpeaking: false,
      currentSummary: null,
      currentTabId: null,
      isAIOverviewVisible: false,
      speechSynthesis: null
    };
    
    this.update(initialState);
    Logger.info('Application state reset', 'AppStateManager');
  }
}

// =============================================================================
// STORAGE MANAGER
// =============================================================================

/**
 * Handles all Chrome storage operations with error handling and validation
 * @class
 */
class StorageManager {
  /**
   * Load user preferences from Chrome storage
   * @returns {Promise<Object>} User preferences object
   */
  static async loadUserPreferences() {
    try {
      const result = await chrome.storage.sync.get([CONFIG.STORAGE_KEYS.TARGET_LANGUAGE]);
      
      Logger.debug('Loaded user preferences', result, 'StorageManager');
      
      return {
        targetLanguage: result[CONFIG.STORAGE_KEYS.TARGET_LANGUAGE] || 'English'
      };
    } catch (error) {
      Logger.error('Failed to load user preferences', error, 'StorageManager');
      
      // Return default preferences on error
      return {
        targetLanguage: 'English'
      };
    }
  }

  /**
   * Save user preferences to Chrome storage
   * @param {Object} preferences - Preferences object to save
   * @returns {Promise<boolean>} Success status
   */
  static async saveUserPreferences(preferences) {
    try {
      const dataToSave = {
        [CONFIG.STORAGE_KEYS.TARGET_LANGUAGE]: preferences.targetLanguage
      };
      
      await chrome.storage.sync.set(dataToSave);
      
      Logger.info('User preferences saved successfully', 'StorageManager');
      return true;
    } catch (error) {
      Logger.error('Failed to save user preferences', error, 'StorageManager');
      return false;
    }
  }

  /**
   * Clear all stored user preferences
   * @returns {Promise<boolean>} Success status
   */
  static async clearUserPreferences() {
    try {
      await chrome.storage.sync.remove([CONFIG.STORAGE_KEYS.TARGET_LANGUAGE]);
      Logger.info('User preferences cleared', 'StorageManager');
      return true;
    } catch (error) {
      Logger.error('Failed to clear user preferences', error, 'StorageManager');
      return false;
    }
  }
}

// =============================================================================
// UI MANAGER
// =============================================================================

/**
 * Manages all UI operations and DOM interactions
 * @class
 */
class UIManager {
  /**
   * Initialize UI manager with DOM elements
   */
  constructor() {
    /** @type {Object} Cached DOM elements */
    this.elements = {};
    
    /** @type {boolean} UI initialization status */
    this.isInitialized = false;
  }

  /**
   * Initialize and cache all DOM elements
   * @returns {boolean} Success status
   */
  initializeElements() {
    try {
      this.elements = {
        // Language selection
        targetLanguageSelect: document.getElementById('target-language-select'),
        
        // Summary display
        summaryPoints: document.getElementById('summary-points'),
        aiOverviewTitle: document.querySelector('.ai-overview-title'),
        aiOverviewContainer: document.querySelector('.ai-overview-container'),
        
        // Control buttons
        copyBtn: document.getElementById('copy-btn'),
        ttsBtn: document.getElementById('tts-btn'),
        checkmarkBtn: document.getElementById('checkmark-btn'),
        stopTtsBtn: document.getElementById('stop-tts-btn'),
        
        // Main action button
        translateBtn: document.getElementById('translate-btn')
      };

      // Validate that all required elements exist
      const missingElements = Object.entries(this.elements)
        .filter(([key, element]) => !element)
        .map(([key]) => key);

      if (missingElements.length > 0) {
        throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
      }

      this.isInitialized = true;
      Logger.info('UI elements initialized successfully', 'UIManager');
      return true;
    } catch (error) {
      Logger.error('Failed to initialize UI elements', error, 'UIManager');
      return false;
    }
  }

  /**
   * Update the target language selector
   * @param {string} language - Language to select
   */
  updateLanguageSelector(language) {
    if (!this.elements.targetLanguageSelect) {
      Logger.warn('Language selector element not found', 'UIManager');
      return;
    }

    this.elements.targetLanguageSelect.value = language;
    Logger.debug(`Language selector updated to: ${language}`, null, 'UIManager');
  }

  /**
   * Update the translate button state
   * @param {boolean} isLoading - Whether translation is in progress
   * @param {boolean} isContinuous - Whether continuous translation is enabled
   */
  updateTranslateButton(isLoading, isContinuous = false) {
    const button = this.elements.translateBtn;
    if (!button) return;

    const span = button.querySelector('span');
    if (!span) return;

    if (isLoading) {
      button.classList.add('loading');
      button.disabled = true;
      span.textContent = 'Translating...';
      Logger.debug('Translate button set to loading state', null, 'UIManager');
    } else if (isContinuous) {
      button.classList.remove('loading');
      button.classList.add('continuous');
      button.disabled = false;
      span.textContent = 'Stop Translation';
      Logger.debug('Translate button set to continuous mode', null, 'UIManager');
    } else {
      button.classList.remove('loading', 'continuous');
      button.disabled = false;
      span.textContent = 'Translate';
      Logger.debug('Translate button reset to normal state', null, 'UIManager');
    }
  }

  /**
   * Update TTS control buttons based on speech state
   * @param {boolean} isSpeaking - Whether TTS is currently active
   */
  updateTTSButtons(isSpeaking) {
    const ttsBtn = this.elements.ttsBtn;
    const stopBtn = this.elements.stopTtsBtn;
    
    if (!ttsBtn || !stopBtn) return;

    if (isSpeaking) {
      ttsBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      Logger.debug('TTS buttons updated: showing stop button', null, 'UIManager');
    } else {
      stopBtn.classList.add('hidden');
      ttsBtn.classList.remove('hidden');
      Logger.debug('TTS buttons updated: showing play button', null, 'UIManager');
    }
  }

  /**
   * Show copy success feedback
   */
  showCopySuccess() {
    const copyBtn = this.elements.copyBtn;
    const checkmarkBtn = this.elements.checkmarkBtn;
    
    if (!copyBtn || !checkmarkBtn) return;

    // Show checkmark animation
    copyBtn.classList.add('hidden');
    checkmarkBtn.classList.remove('hidden');
    checkmarkBtn.classList.add('success');
    
    Logger.debug('Copy success feedback shown', null, 'UIManager');

    // Reset after delay
    setTimeout(() => {
      checkmarkBtn.classList.add('hidden');
      copyBtn.classList.remove('hidden');
      checkmarkBtn.classList.remove('success');
      Logger.debug('Copy success feedback reset', null, 'UIManager');
    }, CONFIG.COPY_FEEDBACK_DURATION);
  }

  /**
   * Update the AI summary display
   * @param {Object} summary - Summary object with title and points
   */
  updateSummaryDisplay(summary) {
    if (!summary || !this.elements.summaryPoints || !this.elements.aiOverviewTitle) {
      Logger.warn('Cannot update summary: missing data or elements', 'UIManager');
      return;
    }

    try {
      // Update title
      this.elements.aiOverviewTitle.textContent = summary.title || 'AI Overview';
      
      // Clear existing points
      this.elements.summaryPoints.innerHTML = '';
      
      // Add new summary points
      if (summary.points && Array.isArray(summary.points)) {
        summary.points.forEach((point, index) => {
          const pointElement = this.createSummaryPointElement(point, index);
          this.elements.summaryPoints.appendChild(pointElement);
        });
      }
      
      Logger.debug('Summary display updated successfully', 'UIManager');
    } catch (error) {
      Logger.error('Failed to update summary display', error, 'UIManager');
    }
  }

  /**
   * Create a summary point DOM element
   * @param {Object} point - Point object with emoji and text
   * @param {number} index - Point index for accessibility
   * @returns {HTMLElement} Created DOM element
   * @private
   */
  createSummaryPointElement(point, index) {
    const pointElement = document.createElement('div');
    pointElement.className = 'summary-point';
    pointElement.setAttribute('role', 'listitem');
    pointElement.setAttribute('aria-label', `Summary point ${index + 1}`);
    
    const emojiElement = document.createElement('div');
    emojiElement.className = 'emoji';
    emojiElement.textContent = point.emoji || '📄';
    emojiElement.setAttribute('aria-hidden', 'true');
    
    const textElement = document.createElement('div');
    textElement.className = 'summary-text';
    textElement.textContent = point.text || '';
    
    pointElement.appendChild(emojiElement);
    pointElement.appendChild(textElement);
    
    return pointElement;
  }

  /**
   * Show or hide the AI overview section
   * @param {boolean} show - Whether to show the overview
   */
  toggleAIOverview(show) {
    const container = this.elements.aiOverviewContainer;
    if (!container) return;

    if (show) {
      container.style.display = 'flex';
      Logger.debug('AI overview shown', null, 'UIManager');
    } else {
      container.style.display = 'none';
      Logger.debug('AI overview hidden', null, 'UIManager');
    }
  }

  /**
   * Display an error message to the user (only for persistent failures)
   * @param {string} message - Error message to display
   * @param {string} [type='error'] - Error type for styling
   * @param {Object} [options={}] - Additional options
   */
  showErrorMessage(message, type = 'error', options = {}) {
    // Only show error popups for critical failures, not temporary issues
    const isCritical = options.critical || type === 'critical';
    
    if (!isCritical && type === 'error') {
      // For non-critical errors, just log them and return
      Logger.warn(`Translation issue (not showing popup): ${message}`, 'UIManager');
      return;
    }

    // Create or update error display element
    let errorElement = document.getElementById('extension-error-message');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'extension-error-message';
      errorElement.className = `error-message error-${type}`;
      errorElement.style.cssText = `
        position: fixed;
        top: 58px;
        left: 10px;
        right: 10px;
        background: #ff3b30;
        color: white;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateY(-10px);
        opacity: 0;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Animate in
    requestAnimationFrame(() => {
      errorElement.style.transform = 'translateY(0)';
      errorElement.style.opacity = '1';
    });
    
    Logger.info(`Error message displayed: ${message}`, 'UIManager');

    // Auto-hide after shorter time for better UX
    setTimeout(() => {
      if (errorElement) {
        errorElement.style.transform = 'translateY(-10px)';
        errorElement.style.opacity = '0';
        setTimeout(() => {
          if (errorElement) {
            errorElement.style.display = 'none';
          }
        }, 300);
      }
    }, 3000); // Reduced from 5 seconds to 3 seconds
  }

  /**
   * Update translation progress
   * @param {Object} progress - Progress information
   */
  updateTranslationProgress(progress) {
    try {
      const button = this.elements.translateBtn;
      if (!button) return;

      const span = button.querySelector('span');
      if (span && progress.message) {
        span.textContent = progress.message;
      }

      Logger.debug('Translation progress updated', progress, 'UIManager');
    } catch (error) {
      Logger.error('Failed to update translation progress', error, 'UIManager');
    }
  }

  /**
   * Show summary loading state
   * @param {string} message - Loading message
   */
  showSummaryLoading(message) {
    try {
      const aiOverview = this.elements.aiOverview;
      if (!aiOverview) return;

      // Create loading indicator
      const loadingHtml = `
        <div class="summary-loading">
          <div class="loading-spinner"></div>
          <p>${message}</p>
        </div>
      `;

      aiOverview.innerHTML = loadingHtml;
      aiOverview.style.display = 'block';

      Logger.debug('Summary loading state shown', null, 'UIManager');
    } catch (error) {
      Logger.error('Failed to show summary loading', error, 'UIManager');
    }
  }

  /**
   * Update partial summary during streaming
   * @param {Object} partial - Partial summary data
   */
  updatePartialSummary(partial) {
    try {
      const aiOverview = this.elements.aiOverview;
      if (!aiOverview) return;

      // Update with partial content
      if (partial.title) {
        const titleElement = aiOverview.querySelector('.summary-title');
        if (titleElement) {
          titleElement.textContent = partial.title;
        }
      }

      if (partial.points && Array.isArray(partial.points)) {
        const pointsContainer = aiOverview.querySelector('.summary-points');
        if (pointsContainer) {
          pointsContainer.innerHTML = '';
          partial.points.forEach((point, index) => {
            const pointElement = this.createSummaryPointElement(point, index);
            pointsContainer.appendChild(pointElement);
          });
        }
      }

      Logger.debug('Partial summary updated', partial, 'UIManager');
    } catch (error) {
      Logger.error('Failed to update partial summary', error, 'UIManager');
    }
  }

  /**
   * Hide summary loading state
   */
  hideSummaryLoading() {
    try {
      const loadingElements = document.querySelectorAll('.summary-loading');
      loadingElements.forEach(element => {
        element.remove();
      });
      
      Logger.debug('Summary loading state hidden', null, 'UIManager');
    } catch (error) {
      Logger.error('Failed to hide summary loading', error, 'UIManager');
    }
  }

  /**
   * Show cache indicator for cached summaries
   */
  showCacheIndicator() {
    try {
      const aiOverview = this.elements.aiOverview;
      if (!aiOverview) return;

      // Remove any existing cache indicators
      const existingIndicator = aiOverview.querySelector('.cache-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }

      // Create cache indicator
      const cacheIndicator = document.createElement('div');
      cacheIndicator.className = 'cache-indicator';
      cacheIndicator.innerHTML = `
        <span class="cache-icon">⚡</span>
        <span class="cache-text">Instant (cached)</span>
      `;

      // Add to AI overview header
      const summaryHeader = aiOverview.querySelector('.ai-overview-header') || 
                           aiOverview.querySelector('.summary-title')?.parentElement ||
                           aiOverview.firstElementChild;
      
      if (summaryHeader) {
        summaryHeader.appendChild(cacheIndicator);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          if (cacheIndicator.parentElement) {
            cacheIndicator.remove();
          }
        }, 3000);
      }

      Logger.debug('Cache indicator shown', null, 'UIManager');
    } catch (error) {
      Logger.error('Failed to show cache indicator', error, 'UIManager');
    }
  }
}

// =============================================================================
// SPEECH MANAGER
// =============================================================================

/**
 * Manages text-to-speech functionality with error handling
 * @class
 */
class SpeechManager {
  /**
   * Initialize speech manager
   */
  constructor() {
    /** @type {SpeechSynthesisUtterance|null} Current speech utterance */
    this.currentUtterance = null;
    
    /** @type {boolean} Speech synthesis availability */
    this.isSupported = 'speechSynthesis' in window;
    
    if (!this.isSupported) {
      Logger.warn('Speech synthesis not supported in this browser', 'SpeechManager');
    }
  }

  /**
   * Start speaking the provided text
   * @param {string} text - Text to speak
   * @param {string} language - Target language for speech
   * @returns {Promise<boolean>} Success status
   */
  async startSpeaking(text, language = 'English') {
    if (!this.isSupported) {
      Logger.error('Speech synthesis not supported', null, 'SpeechManager');
      return false;
    }

    if (!text || typeof text !== 'string') {
      Logger.error('Invalid text provided for speech', null, 'SpeechManager');
      return false;
    }

    try {
      // Stop any existing speech
      this.stopSpeaking();

      // Create new utterance
      this.currentUtterance = new SpeechSynthesisUtterance(text);
      
      // Configure speech settings
      this.configureSpeechSettings(this.currentUtterance, language);
      
      // Set up event listeners
      this.setupSpeechEventListeners(this.currentUtterance);
      
      // Start speaking
      speechSynthesis.speak(this.currentUtterance);
      
      Logger.info('Speech synthesis started', 'SpeechManager');
      return true;
    } catch (error) {
      Logger.error('Failed to start speech synthesis', error, 'SpeechManager');
      return false;
    }
  }

  /**
   * Stop current speech synthesis
   */
  stopSpeaking() {
    if (this.isSupported && speechSynthesis.speaking) {
      speechSynthesis.cancel();
      this.currentUtterance = null;
      Logger.info('Speech synthesis stopped', 'SpeechManager');
    }
  }

  /**
   * Check if currently speaking
   * @returns {boolean} Speaking status
   */
  isSpeaking() {
    return this.isSupported && speechSynthesis.speaking;
  }

  /**
   * Configure speech synthesis settings
   * @param {SpeechSynthesisUtterance} utterance - Utterance to configure
   * @param {string} language - Target language
   * @private
   */
  configureSpeechSettings(utterance, language) {
    utterance.rate = CONFIG.SPEECH.RATE;
    utterance.pitch = CONFIG.SPEECH.PITCH;
    utterance.volume = CONFIG.SPEECH.VOLUME;
    
    // Set language-specific voice
    const languageCode = this.getLanguageCode(language);
    if (languageCode) {
      utterance.lang = languageCode;
    }
    
    Logger.debug(`Speech configured for language: ${language} (${languageCode})`, null, 'SpeechManager');
  }

  /**
   * Set up event listeners for speech utterance
   * @param {SpeechSynthesisUtterance} utterance - Utterance to set up
   * @private
   */
  setupSpeechEventListeners(utterance) {
    utterance.onstart = () => {
      Logger.debug('Speech started', null, 'SpeechManager');
      // Notify state manager or UI as needed
    };
    
    utterance.onend = () => {
      Logger.debug('Speech ended', null, 'SpeechManager');
      this.currentUtterance = null;
      // Notify state manager or UI as needed
    };
    
    utterance.onerror = (event) => {
      Logger.error('Speech synthesis error', event, 'SpeechManager');
      this.currentUtterance = null;
      // Notify state manager or UI as needed
    };
  }

  /**
   * Get language code for speech synthesis
   * @param {string} languageName - Language name
   * @returns {string} Language code
   * @private
   */
  getLanguageCode(languageName) {
    return LANGUAGE_CODES[languageName] || 'en-US';
  }
}

// =============================================================================
// EVENT MANAGER
// =============================================================================

/**
 * Manages all event handling and user interactions
 * @class
 */
class EventManager {
  /**
   * Initialize event manager with dependencies
   * @param {AppStateManager} stateManager - Application state manager
   * @param {UIManager} uiManager - UI manager
   * @param {SpeechManager} speechManager - Speech manager
   */
  constructor(stateManager, uiManager, speechManager) {
    this.stateManager = stateManager;
    this.uiManager = uiManager;
    this.speechManager = speechManager;
    
    /** @type {boolean} Event listeners setup status */
    this.isInitialized = false;
  }

  /**
   * Set up all event listeners
   * @returns {boolean} Success status
   */
  setupEventListeners() {
    try {
      this.setupLanguageSelectionEvents();
      this.setupControlButtonEvents();
      this.setupTranslateButtonEvents();
      this.setupChromeMessageListeners();
      this.setupStateChangeListeners();
      
      this.isInitialized = true;
      Logger.info('Event listeners setup successfully', 'EventManager');
      return true;
    } catch (error) {
      Logger.error('Failed to setup event listeners', error, 'EventManager');
      return false;
    }
  }

  /**
   * Set up language selection event handlers
   * @private
   */
  setupLanguageSelectionEvents() {
    const languageSelect = this.uiManager.elements.targetLanguageSelect;
    if (!languageSelect) return;

    languageSelect.addEventListener('change', async (event) => {
      const newLanguage = event.target.value;
      
      Logger.info(`Language changed to: ${newLanguage}`, 'EventManager');
      
      // Update state
      this.stateManager.set('targetLanguage', newLanguage);
      
      // If continuous translation is enabled, update the continuous translation language
      const isContinuousEnabled = this.stateManager.get('continuousTranslation');
      const currentTabId = this.stateManager.get('currentTabId');
      
      if (isContinuousEnabled && currentTabId) {
        try {
          const sourceLanguage = this.stateManager.get('currentLanguage');
          
          Logger.info(`Updating continuous translation language: ${sourceLanguage} → ${newLanguage}`, 'EventManager');
          
          // Send update continuous language request to background script
          const response = await this.sendChromeMessage({
            action: 'updateContinuousLanguage',
            tabId: currentTabId,
            sourceLanguage,
            targetLanguage: newLanguage
          });

          if (!response || !response.success) {
            throw new Error(response?.error || 'Failed to update continuous translation language');
          }

          Logger.info('Continuous translation language updated successfully', 'EventManager');
        } catch (error) {
          Logger.error('Failed to update continuous translation language', error, 'EventManager');
          this.uiManager.showErrorMessage('Failed to update translation language. Please try again.');
        }
      }
      
      // Save to storage
      const success = await StorageManager.saveUserPreferences({
        targetLanguage: newLanguage
      });
      
      if (!success) {
        this.uiManager.showErrorMessage('Failed to save language preference');
      }
    });
  }

  /**
   * Set up control button event handlers
   * @private
   */
  setupControlButtonEvents() {
    // Copy button
    const copyBtn = this.uiManager.elements.copyBtn;
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.handleCopyAction());
    }

    // TTS button
    const ttsBtn = this.uiManager.elements.ttsBtn;
    if (ttsBtn) {
      ttsBtn.addEventListener('click', () => this.handleTTSAction());
    }

    // Stop TTS button
    const stopTtsBtn = this.uiManager.elements.stopTtsBtn;
    if (stopTtsBtn) {
      stopTtsBtn.addEventListener('click', () => this.handleStopTTSAction());
    }
  }

  /**
   * Set up translate button event handlers
   * @private
   */
  setupTranslateButtonEvents() {
    const translateBtn = this.uiManager.elements.translateBtn;
    if (!translateBtn) return;

    translateBtn.addEventListener('click', async () => {
      // Remove the broken isTranslating check that prevents stopping translation
      // The handleTranslateAction function handles the start/stop logic properly
      await this.handleTranslateAction();
    });
  }

  /**
   * Set up Chrome extension message listeners
   * @private
   */
  setupChromeMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      Logger.debug('Received message', message, 'EventManager');
      
      try {
        switch (message.action) {
          case CONFIG.MESSAGES.UPDATE_SUMMARY:
            this.handleSummaryUpdate(message.summary);
            break;

          case CONFIG.MESSAGES.SUMMARY_UPDATE:
            this.handleAutoSummaryUpdate(message);
            break;
            
          case CONFIG.MESSAGES.TRANSLATION_STARTED:
            Logger.info('Streaming translation started', 'EventManager');
            this.stateManager.set('isTranslating', true);
            break;
            
          case CONFIG.MESSAGES.TRANSLATION_COMPLETE:
            Logger.info('Streaming translation completed', 'EventManager');
            this.stateManager.set('isTranslating', false);
            this.handleTranslationComplete(message);
            break;
            
          case CONFIG.MESSAGES.TRANSLATION_ERROR:
            Logger.error('Translation error received', message.error, 'EventManager');
            this.stateManager.set('isTranslating', false);
            this.handleTranslationError(message.error);
            break;
            
          case CONFIG.MESSAGES.PAGE_CONTENT_EXTRACTED:
            this.handlePageContentExtracted(message.content);
            break;

          case 'continuousTranslationRestarting':
            this.handleContinuousTranslationRestarting(message);
            break;

          case 'continuousTranslationRestarted':
            this.handleContinuousTranslationRestarted(message);
            break;

          case 'continuousTranslationError':
            this.handleContinuousTranslationError(message);
            break;

          case 'streamTranslationChunk':
            this.handleStreamTranslationChunk(message);
            break;

          case 'streamSummaryChunk':
            this.handleStreamSummaryChunk(message);
            break;
            
          default:
            Logger.debug(`Unhandled message action: ${message.action}`, null, 'EventManager');
        }
      } catch (error) {
        Logger.error('Error handling message', error, 'EventManager');
      }
    });
  }

  /**
   * Set up state change listeners
   * @private
   */
  setupStateChangeListeners() {
    this.stateManager.subscribe((key, newValue, oldValue) => {
      switch (key) {
        case 'isTranslating':
        case 'continuousTranslation':
          // Update button based on both translation and continuous states
          const isTranslating = this.stateManager.get('isTranslating');
          const isContinuous = this.stateManager.get('continuousTranslation');
          this.uiManager.updateTranslateButton(isTranslating && !isContinuous, isContinuous);
          break;
          
        case 'isSpeaking':
          this.uiManager.updateTTSButtons(newValue);
          break;
          
        case 'targetLanguage':
          this.uiManager.updateLanguageSelector(newValue);
          break;
          
        case 'isAIOverviewVisible':
          this.uiManager.toggleAIOverview(newValue);
          break;
      }
    });
  }

  /**
   * Handle copy action
   * @private
   */
  async handleCopyAction() {
    const summary = this.stateManager.get('currentSummary');
    
    if (!summary) {
      Logger.warn('No summary available to copy', 'EventManager');
      this.uiManager.showErrorMessage('No summary available to copy');
      return;
    }

    try {
      // Create formatted text for clipboard
      const summaryText = summary.points
        .map(point => `${point.emoji} ${point.text}`)
        .join('\n');
      
      const fullText = `${summary.title}\n\n${summaryText}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(fullText);
      
      // Show success feedback
      this.uiManager.showCopySuccess();
      
      Logger.info('Summary copied to clipboard successfully', 'EventManager');
    } catch (error) {
      Logger.error('Failed to copy summary', error, 'EventManager');
      this.uiManager.showErrorMessage('Failed to copy summary to clipboard');
    }
  }

  /**
   * Handle TTS action
   * @private
   */
  async handleTTSAction() {
    const summary = this.stateManager.get('currentSummary');
    
    if (!summary) {
      Logger.warn('No summary available for TTS', 'EventManager');
      this.uiManager.showErrorMessage('No summary available to read aloud');
      return;
    }

    try {
      // Extract text for speech
      const summaryText = summary.points
        .map(point => point.text)
        .join('. ');
      
      const targetLanguage = this.stateManager.get('targetLanguage');
      
      // Start speech
      this.stateManager.set('isSpeaking', true);
      const success = await this.speechManager.startSpeaking(summaryText, targetLanguage);
      
      if (!success) {
        this.stateManager.set('isSpeaking', false);
        this.uiManager.showErrorMessage('Failed to start text-to-speech');
      }
      
      Logger.info('TTS started successfully', 'EventManager');
    } catch (error) {
      this.stateManager.set('isSpeaking', false);
      Logger.error('Failed to start TTS', error, 'EventManager');
      this.uiManager.showErrorMessage('Failed to start text-to-speech');
    }
  }

  /**
   * Handle stop TTS action
   * @private
   */
  handleStopTTSAction() {
    this.speechManager.stopSpeaking();
    this.stateManager.set('isSpeaking', false);
    Logger.info('TTS stopped by user', 'EventManager');
  }

  /**
   * Handle translate button click - toggles continuous translation mode
   * @returns {Promise<void>}
   * @private
   */
  async handleTranslateAction() {
    try {
      const isContinuousEnabled = this.stateManager.get('continuousTranslation');
      
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      const sourceLanguage = this.stateManager.get('currentLanguage');
      const targetLanguage = this.stateManager.get('targetLanguage');

      if (!targetLanguage || targetLanguage === 'Select Language') {
        this.uiManager.showErrorMessage('Please select a target language first', 'error', { critical: true });
        return;
      }

      if (!isContinuousEnabled) {
        // Start continuous translation mode
        this.stateManager.set('isTranslating', true);
        this.stateManager.set('continuousTranslation', true);
        this.stateManager.set('currentTabId', tab.id);

        Logger.info(`Starting continuous translation: ${sourceLanguage} → ${targetLanguage}`, 'EventManager');

        // Send start continuous translation request to background script
        const response = await this.sendChromeMessage({
          action: 'startContinuousTranslation',
          tabId: tab.id,
          sourceLanguage,
          targetLanguage
        });

        if (!response || !response.success) {
          // Only show critical errors after retries failed
          const errorMsg = response?.error || 'Failed to start continuous translation';
          if (errorMsg.includes('rate limited') || 
              errorMsg.includes('Authentication') ||
              errorMsg.includes('Service unavailable')) {
            this.uiManager.showErrorMessage(errorMsg, 'error', { critical: true });
          } else {
            // For other errors, just log - user can try again
            Logger.info('Translation start failed, user can retry', 'EventManager');
          }
          
          // Reset state on failure
          this.stateManager.set('isTranslating', false);
          this.stateManager.set('continuousTranslation', false);
          return;
        }

        // Update UI to show continuous translation is active
        this.uiManager.updateTranslateButton(false, true); // not loading, but continuous mode
        Logger.info('Continuous translation started successfully', 'EventManager');
        
      } else {
        // Stop continuous translation mode - reset state immediately
        this.stateManager.set('isTranslating', false);
        this.stateManager.set('continuousTranslation', false);

        // Update UI immediately to prevent button state issues
        this.uiManager.updateTranslateButton(false, false);
        
        Logger.info('Stopping continuous translation', 'EventManager');

        // Send stop continuous translation request to background script
        const response = await this.sendChromeMessage({
          action: 'stopContinuousTranslation',
          tabId: tab.id
        });

        if (!response || !response.success) {
          Logger.error('Failed to stop continuous translation', response?.error || 'Unknown error', 'EventManager');
          // Don't throw here - we already reset the UI state
        }

        Logger.info('Continuous translation stopped successfully', 'EventManager');
      }
      
    } catch (error) {
      Logger.error('Translation action failed', error, 'EventManager');
      
      // Only show critical errors to user
      if (error.message.includes('No active tab') || 
          error.message.includes('Extension context')) {
        this.uiManager.showErrorMessage('Unable to access current page', 'error', { critical: true });
      }
      
      // Reset state on any error
      this.stateManager.set('isTranslating', false);
      this.stateManager.set('continuousTranslation', false);
      this.uiManager.updateTranslateButton(false, false);
    }
  }

  /**
   * Handle summary update message
   * @param {Object} summary - Summary data
   * @private
   */
  handleSummaryUpdate(summary) {
    if (!summary) {
      Logger.warn('Received empty summary update', 'EventManager');
      return;
    }

    Logger.info('Updating summary display', 'EventManager');
    
    this.stateManager.set('currentSummary', summary);
    this.stateManager.set('isAIOverviewVisible', true);
    this.uiManager.updateSummaryDisplay(summary);
  }

  /**
   * Handle auto-generated summary update from background script
   * @param {Object} message - Message containing summary and metadata
   * @private
   */
  handleAutoSummaryUpdate(message) {
    const { summary, fromCache, error, tabId } = message;
    
    if (!summary) {
      Logger.warn('Received empty auto-summary update', 'EventManager');
      return;
    }

    const source = fromCache ? 'cache' : 'API';
    Logger.debug(`Auto-summary received from ${source}`, 'EventManager');
    
    // Show visual indicator for cached vs fresh summaries
    if (fromCache) {
      this.uiManager.showCacheIndicator();
    }
    
    // Update summary state and display
    this.stateManager.set('currentSummary', summary);
    this.stateManager.set('isAIOverviewVisible', true);
    this.stateManager.set('summarySource', source);
    
    // Update UI with the new summary
    this.uiManager.updateSummaryDisplay(summary);
    
    // If this was an error fallback, show appropriate state
    if (error) {
      this.uiManager.showSummaryLoading('Generating improved summary...');
    } else {
      // Hide any loading states
      this.uiManager.hideSummaryLoading();
    }
    
    Logger.debug('Auto-summary display updated', { fromCache, error }, 'EventManager');
  }

  /**
   * Handle translation complete message
   * @param {Object} data - Translation completion data
   * @private
   */
  handleTranslationComplete(data) {
    Logger.info('Translation completed successfully', 'EventManager');
    this.stateManager.set('isTranslating', false);
  }

  /**
   * Handle translation error message
   * @param {string} error - Error message
   * @private
   */
  handleTranslationError(error) {
    Logger.error('Translation error received', error, 'EventManager');
    this.stateManager.set('isTranslating', false);
    
    // Only show popup for critical errors (after all retries failed)
    // Most temporary network issues should be handled in background with retries
    const isCriticalError = error && (
      error.includes('API endpoint') || 
      error.includes('rate limited') ||
      error.includes('Authentication') ||
      error.includes('exceeded maximum')
    );
    
    if (isCriticalError) {
      this.uiManager.showErrorMessage(error || 'Translation service unavailable', 'error', { critical: true });
    } else {
      // For non-critical errors, just log and let user try again
      Logger.info('Translation temporarily failed, user can retry', 'EventManager');
    }
  }

  /**
   * Handle page content extracted message
   * @param {Object} content - Page content data
   * @private
   */
  handlePageContentExtracted(content) {
    Logger.debug('Page content extracted', content, 'EventManager');
    // Could be used for language detection or other features
  }

  /**
   * Handle continuous translation restarting message
   * @param {Object} message - Message data
   * @private
   */
  handleContinuousTranslationRestarting(message) {
    const { tabId, sourceLanguage, targetLanguage } = message;
    const currentTabId = this.stateManager.get('currentTabId');
    
    // Only handle if this is for the current tab
    if (tabId === currentTabId) {
      Logger.info(`Continuous translation restarting on new page: ${sourceLanguage} → ${targetLanguage}`, 'EventManager');
      
      // Update state to show translation is restarting
      this.stateManager.set('isTranslating', true);
      
      // Keep continuous translation enabled and update languages if they changed
      this.stateManager.set('currentLanguage', sourceLanguage);
      this.stateManager.set('targetLanguage', targetLanguage);
      
      // Clear any existing summary since we're on a new page
      this.stateManager.set('currentSummary', null);
      this.uiManager.toggleAIOverview(false);
    }
  }

  /**
   * Handle continuous translation restarted message
   * @param {Object} message - Message data
   * @private
   */
  handleContinuousTranslationRestarted(message) {
    const { tabId, sourceLanguage, targetLanguage } = message;
    const currentTabId = this.stateManager.get('currentTabId');
    
    // Only handle if this is for the current tab
    if (tabId === currentTabId) {
      Logger.info(`Continuous translation restarted successfully: ${sourceLanguage} → ${targetLanguage}`, 'EventManager');
      
      // Update state to show translation completed
      this.stateManager.set('isTranslating', false);
      
      // Ensure continuous translation state is maintained
      this.stateManager.set('continuousTranslation', true);
    }
  }

  /**
   * Handle continuous translation error message
   * @param {Object} message - Message data
   * @private
   */
  handleContinuousTranslationError(message) {
    const { tabId, error } = message;
    const currentTabId = this.stateManager.get('currentTabId');
    
    // Only handle if this is for the current tab
    if (tabId === currentTabId) {
      Logger.error(`Continuous translation error: ${error}`, null, 'EventManager');
      
      // Reset states
      this.stateManager.set('isTranslating', false);
      this.stateManager.set('continuousTranslation', false);
      
      // Only show error for critical issues, not temporary page navigation problems
      if (error && error.includes('Failed to restart translation')) {
        // This is usually just a page navigation issue, don't bother the user
        Logger.info('Continuous translation stopped due to page change', 'EventManager');
      } else {
        // Show critical errors only
        this.uiManager.showErrorMessage(`Translation service error: ${error}`, 'error', { critical: true });
      }
    }
  }

  /**
   * Handle streaming translation chunk
   * @param {Object} message - Message data
   * @private
   */
  handleStreamTranslationChunk(message) {
    const { chunk, tabId } = message;
    const currentTabId = this.stateManager.get('currentTabId');
    
    // Only handle if this is for the current tab
    if (tabId === currentTabId) {
      Logger.debug('Received translation chunk', chunk, 'EventManager');
      
      if (chunk.type === 'start') {
        // Translation starting
        this.stateManager.set('isTranslating', true);
      } else if (chunk.type === 'progress') {
        // Translation progress update
        if (chunk.progress) {
          this.uiManager.updateTranslationProgress(chunk.progress);
        }
      } else if (chunk.type === 'complete') {
        // Translation completed
        this.stateManager.set('isTranslating', false);
      } else if (chunk.type === 'error') {
        // Translation error
        this.stateManager.set('isTranslating', false);
        this.uiManager.showErrorMessage(`Translation error: ${chunk.error}`);
      }
    }
  }

  /**
   * Handle streaming summary chunk
   * @param {Object} message - Message data
   * @private
   */
  handleStreamSummaryChunk(message) {
    const { chunk, tabId } = message;
    const currentTabId = this.stateManager.get('currentTabId');
    
    // Only handle if this is for the current tab
    if (tabId === currentTabId) {
      Logger.debug('Received summary chunk', chunk, 'EventManager');
      
      if (chunk.type === 'start') {
        // Summary generation starting
        this.uiManager.showSummaryLoading(chunk.message || 'Generating summary...');
      } else if (chunk.type === 'progress') {
        // Summary progress update
        if (chunk.partial) {
          this.uiManager.updatePartialSummary(chunk.partial);
        }
      } else if (chunk.type === 'complete') {
        // Summary completed
        if (chunk.summary) {
          this.handleSummaryUpdate(chunk.summary);
        }
      } else if (chunk.type === 'error') {
        // Summary error
        const errorSummary = {
          title: 'Summary Error',
          points: [
            { emoji: '⚠️', text: `Failed to generate summary: ${chunk.error}` }
          ]
        };
        this.handleSummaryUpdate(errorSummary);
      }
    }
  }

  /**
   * Send message to Chrome runtime with error handling
   * @param {Object} message - Message to send
   * @returns {Promise<Object>} Response from runtime
   * @private
   */
  async sendChromeMessage(message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 10000);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

// =============================================================================
// APPLICATION CONTROLLER
// =============================================================================

/**
 * Main application controller that orchestrates all components
 * @class
 */
class SidepanelApp {
  /**
   * Initialize the application
   */
  constructor() {
    /** @type {AppStateManager} State manager instance */
    this.stateManager = new AppStateManager();
    
    /** @type {UIManager} UI manager instance */
    this.uiManager = new UIManager();
    
    /** @type {SpeechManager} Speech manager instance */
    this.speechManager = new SpeechManager();
    
    /** @type {EventManager} Event manager instance */
    this.eventManager = new EventManager(
      this.stateManager,
      this.uiManager,
      this.speechManager
    );
    
    /** @type {boolean} Application initialization status */
    this.isInitialized = false;
  }

  /**
   * Initialize the entire application
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      Logger.info('Starting sidepanel application initialization', 'SidepanelApp');
      
      // Initialize UI elements
      if (!this.uiManager.initializeElements()) {
        throw new Error('Failed to initialize UI elements');
      }
      
      // Load user preferences
      await this.loadUserPreferences();
      
      // Set up event listeners
      if (!this.eventManager.setupEventListeners()) {
        throw new Error('Failed to setup event listeners');
      }
      
      // Hide AI overview initially
      this.uiManager.toggleAIOverview(false);
      
      // Mark as initialized
      this.isInitialized = true;
      this.stateManager.set('isInitialized', true);
      
      Logger.info('Sidepanel application initialized successfully', 'SidepanelApp');
      return true;
    } catch (error) {
      Logger.error('Failed to initialize sidepanel application', error, 'SidepanelApp');
      this.uiManager.showErrorMessage('Failed to initialize extension');
      return false;
    }
  }

  /**
   * Load and apply user preferences
   * @private
   */
  async loadUserPreferences() {
    try {
      const preferences = await StorageManager.loadUserPreferences();
      
      // Update state with loaded preferences (this will trigger UI update)
      this.stateManager.set('targetLanguage', preferences.targetLanguage);
      
      // Ensure UI reflects the loaded language immediately
      this.uiManager.updateLanguageSelector(preferences.targetLanguage);
      
      Logger.info(`User preferences loaded: language=${preferences.targetLanguage}`, 'SidepanelApp');
    } catch (error) {
      Logger.error('Failed to load user preferences', error, 'SidepanelApp');
      // Continue with defaults
    }
  }

  /**
   * Clean up resources when shutting down
   */
  async cleanup() {
    try {
      // Stop continuous translation if enabled
      const isContinuousEnabled = this.stateManager.get('continuousTranslation');
      const currentTabId = this.stateManager.get('currentTabId');
      
      if (isContinuousEnabled && currentTabId) {
        try {
          Logger.info('Stopping continuous translation due to sidepanel closure', 'SidepanelApp');
          
          // Send stop continuous translation request
          await this.eventManager.sendChromeMessage({
            action: 'stopContinuousTranslation',
            tabId: currentTabId
          });
          
          // Notify background script that sidepanel is closing
          await this.eventManager.sendChromeMessage({
            action: 'sidepanelClosed',
            tabId: currentTabId
          });
          
          Logger.info('Continuous translation stopped successfully', 'SidepanelApp');
        } catch (error) {
          Logger.error('Failed to stop continuous translation on cleanup', error, 'SidepanelApp');
        }
      }
      
      // Stop any ongoing speech
      this.speechManager.stopSpeaking();
      
      // Reset state
      this.stateManager.reset();
      
      Logger.info('Application cleanup completed', 'SidepanelApp');
    } catch (error) {
      Logger.error('Error during application cleanup', error, 'SidepanelApp');
    }
  }
}

// =============================================================================
// LOGGING UTILITY (Simplified version for Chrome extension context)
// =============================================================================

/**
 * Simple logging utility with levels
 * @namespace
 */
const Logger = {
  /**
   * Log levels for filtering
   */
  levels: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  },

  /**
   * Current log level (can be changed for development)
   */
  currentLevel: 2, // INFO level

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Error|Object} [error] - Error object
   * @param {string} [context] - Context string
   */
  error(message, error = null, context = '') {
    if (this.currentLevel >= this.levels.ERROR) {
      const prefix = `[ERROR]${context ? ` [${context}]` : ''}`;
      console.error(prefix, message, error);
    }
  },

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {string} [context] - Context string
   */
  warn(message, context = '') {
    if (this.currentLevel >= this.levels.WARN) {
      const prefix = `[WARN]${context ? ` [${context}]` : ''}`;
      console.warn(prefix, message);
    }
  },

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {string} [context] - Context string
   */
  info(message, context = '') {
    if (this.currentLevel >= this.levels.INFO) {
      const prefix = `[INFO]${context ? ` [${context}]` : ''}`;
      console.info(prefix, message);
    }
  },

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {any} [data] - Additional data
   * @param {string} [context] - Context string
   */
  debug(message, data = null, context = '') {
    if (this.currentLevel >= this.levels.DEBUG) {
      const prefix = `[DEBUG]${context ? ` [${context}]` : ''}`;
      console.debug(prefix, message, data);
    }
  }
};

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Global application instance
 * @type {SidepanelApp}
 */
let app;

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    Logger.info('DOM content loaded, starting application', 'Main');
    
    // Create and initialize application
    app = new SidepanelApp();
    const success = await app.initialize();
    
    if (!success) {
      Logger.error('Application initialization failed', null, 'Main');
    }
  } catch (error) {
    Logger.error('Fatal error during application startup', error, 'Main');
  }
});

/**
 * Handle page unload cleanup
 */
window.addEventListener('beforeunload', async () => {
  if (app) {
    await app.cleanup();
  }
});

/**
 * Handle unhandled errors
 */
window.addEventListener('error', (event) => {
  Logger.error('Unhandled error', event.error, 'Global');
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
  Logger.error('Unhandled promise rejection', event.reason, 'Global');
}); 