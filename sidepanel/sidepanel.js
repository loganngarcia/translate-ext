/**
 * @fileoverview Sidepanel JavaScript for AI Page Translator Chrome Extension
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
 * @author AI Page Translator Team
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
 * Default language mappings for TTS
 * @const {Object}
 */
const LANGUAGE_CODES = {
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
  'Dutch': 'nl-NL'
  // ... (other languages would be included here)
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
      
      Logger.info('Summary display updated successfully', 'UIManager');
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
   * Display an error message to the user
   * @param {string} message - Error message to display
   * @param {string} [type='error'] - Error type for styling
   */
  showErrorMessage(message, type = 'error') {
    // Create or update error display element
    let errorElement = document.getElementById('extension-error-message');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'extension-error-message';
      errorElement.className = `error-message error-${type}`;
      errorElement.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        background: #ff3b30;
        color: white;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      document.body.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    Logger.info(`Error message displayed: ${message}`, 'UIManager');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorElement) {
        errorElement.style.display = 'none';
      }
    }, 5000);
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
      if (this.stateManager.get('isTranslating')) {
        Logger.warn('Translation already in progress', 'EventManager');
        return;
      }

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
   * Handle translate action
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
          throw new Error(response?.error || 'Failed to start continuous translation');
        }

        // Update UI to show continuous translation is active
        this.uiManager.updateTranslateButton(false, true); // not loading, but continuous mode
        Logger.info('Continuous translation started successfully', 'EventManager');
      } else {
        // Stop continuous translation mode
        this.stateManager.set('continuousTranslation', false);
        
        Logger.info('Stopping continuous translation', 'EventManager');

        // Send stop continuous translation request to background script
        const response = await this.sendChromeMessage({
          action: 'stopContinuousTranslation',
          tabId: tab.id
        });

        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to stop continuous translation');
        }

        // Update UI to show continuous translation is stopped
        this.uiManager.updateTranslateButton(false, false);
        this.stateManager.set('isTranslating', false);
        Logger.info('Continuous translation stopped successfully', 'EventManager');
      }
    } catch (error) {
      Logger.error('Translation action failed', error, 'EventManager');
      this.uiManager.showErrorMessage('Translation failed. Please try again.');
      this.stateManager.set('isTranslating', false);
      this.stateManager.set('continuousTranslation', false);
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
    this.uiManager.showErrorMessage(error || 'Translation failed');
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
      
      // Show error message
      this.uiManager.showErrorMessage(`Failed to restart translation on new page: ${error}`);
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