// Sidepanel JavaScript for AI Page Translator Chrome Extension

// Application state
const appState = {
  currentLanguage: 'auto',
  targetLanguage: 'English',
  isTranslating: false,
  isSpeaking: false,
  currentSummary: null,
  speechSynthesis: null
};

// DOM elements
let elements = {};

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  loadUserPreferences();
  setupEventListeners();
  initializeLanguageDetection();
  
  // Hide AI overview initially - only show after translation
  hideAIOverview();
});

function initializeElements() {
  elements = {
    targetLanguageSelect: document.getElementById('target-language-select'),
    summaryPoints: document.getElementById('summary-points'),
    aiOverviewTitle: document.querySelector('.ai-overview-title'),
    aiOverviewContainer: document.querySelector('.ai-overview-container'),
    copyBtn: document.getElementById('copy-btn'),
    ttsBtn: document.getElementById('tts-btn'),
    checkmarkBtn: document.getElementById('checkmark-btn'),
    stopTtsBtn: document.getElementById('stop-tts-btn'),
    translateBtn: document.getElementById('translate-btn')
  };
}

async function loadUserPreferences() {
  try {
    // Load saved target language from storage
    const result = await chrome.storage.sync.get(['targetLanguage']);
    if (result.targetLanguage) {
      appState.targetLanguage = result.targetLanguage;
      elements.targetLanguageSelect.value = result.targetLanguage;
      console.log('Loaded saved language:', result.targetLanguage);
    }
  } catch (error) {
    console.error('Error loading user preferences:', error);
  }
}

async function saveUserPreferences() {
  try {
    await chrome.storage.sync.set({
      targetLanguage: appState.targetLanguage
    });
    console.log('Saved language preference:', appState.targetLanguage);
  } catch (error) {
    console.error('Error saving user preferences:', error);
  }
}

function setupEventListeners() {
  // Language selection
  elements.targetLanguageSelect.addEventListener('change', handleLanguageChange);
  
  // Control buttons
  elements.copyBtn.addEventListener('click', handleCopy);
  elements.ttsBtn.addEventListener('click', handleTTS);
  elements.stopTtsBtn.addEventListener('click', handleStopTTS);
  
  // Translate button
  elements.translateBtn.addEventListener('click', handleTranslate);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleMessage);
}

async function handleLanguageChange(event) {
  appState.targetLanguage = event.target.value;
  console.log('Language changed to:', appState.targetLanguage);
  
  // Save to storage immediately
  await saveUserPreferences();
}

async function handleCopy() {
  if (!appState.currentSummary) {
    console.warn('No summary available to copy');
    return;
  }
  
  try {
    // Create clean text without markdown
    const summaryText = appState.currentSummary.points
      .map(point => `${point.emoji} ${point.text}`)
      .join('\n');
    
    const fullText = `${appState.currentSummary.title}\n\n${summaryText}`;
    
    await navigator.clipboard.writeText(fullText);
    showCopySuccess();
    console.log('Summary copied to clipboard');
  } catch (error) {
    console.error('Failed to copy summary:', error);
  }
}

function showCopySuccess() {
  // Show checkmark and hide copy button temporarily
  elements.copyBtn.classList.add('hidden');
  elements.checkmarkBtn.classList.remove('hidden');
  elements.checkmarkBtn.classList.add('success');
  
  setTimeout(() => {
    elements.checkmarkBtn.classList.add('hidden');
    elements.copyBtn.classList.remove('hidden');
    elements.checkmarkBtn.classList.remove('success');
  }, 2000);
}

function handleTTS() {
  if (!appState.currentSummary) {
    console.warn('No summary available for TTS');
    return;
  }
  
  const summaryText = appState.currentSummary.points
    .map(point => point.text)
    .join('. ');
    
  startTextToSpeech(summaryText);
}

function startTextToSpeech(text) {
  try {
    // Stop any existing speech
    if (appState.speechSynthesis) {
      speechSynthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure speech settings
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Set language based on target language
    const languageCode = getLanguageCode(appState.targetLanguage);
    if (languageCode) {
      utterance.lang = languageCode;
    }
    
    // Event listeners
    utterance.onstart = () => {
      appState.isSpeaking = true;
      updateTTSButtons(true);
    };
    
    utterance.onend = () => {
      appState.isSpeaking = false;
      updateTTSButtons(false);
      appState.speechSynthesis = null;
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      appState.isSpeaking = false;
      updateTTSButtons(false);
      appState.speechSynthesis = null;
    };
    
    appState.speechSynthesis = utterance;
    speechSynthesis.speak(utterance);
    
  } catch (error) {
    console.error('Text-to-speech error:', error);
  }
}

function handleStopTTS() {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    appState.isSpeaking = false;
    updateTTSButtons(false);
    appState.speechSynthesis = null;
  }
}

function updateTTSButtons(isSpeaking) {
  if (isSpeaking) {
    elements.ttsBtn.classList.add('hidden');
    elements.stopTtsBtn.classList.remove('hidden');
  } else {
    elements.stopTtsBtn.classList.add('hidden');
    elements.ttsBtn.classList.remove('hidden');
  }
}

async function handleTranslate() {
  if (appState.isTranslating) return;
  
  try {
    appState.isTranslating = true;
    updateTranslateButton(true);
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    console.log('Starting translation to:', appState.targetLanguage);
    
    // Send translation request to background script
    const response = await chrome.runtime.sendMessage({
      action: 'translatePage',
      tabId: tab.id,
      sourceLanguage: appState.currentLanguage,
      targetLanguage: appState.targetLanguage
    });
    
    if (response.success) {
      console.log('Translation initiated successfully');
      // AI overview will be shown when translation completes
    } else {
      throw new Error(response.error || 'Translation failed');
    }
    
  } catch (error) {
    console.error('Translation error:', error);
    showErrorState('Translation failed. Please try again.');
  } finally {
    appState.isTranslating = false;
    updateTranslateButton(false);
  }
}

function updateTranslateButton(isLoading) {
  if (isLoading) {
    elements.translateBtn.classList.add('loading');
    elements.translateBtn.disabled = true;
    elements.translateBtn.querySelector('span').textContent = 'Translating...';
  } else {
    elements.translateBtn.classList.remove('loading');
    elements.translateBtn.disabled = false;
    elements.translateBtn.querySelector('span').textContent = 'Translate';
  }
}

function handleMessage(message, sender, sendResponse) {
  switch (message.action) {
    case 'updateSummary':
      if (message.summary) {
        updateSummaryDisplay(message.summary);
        showAIOverview();
      }
      break;
      
    case 'translationComplete':
      handleTranslationComplete(message);
      break;
      
    case 'translationError':
      handleTranslationError(message.error);
      break;
      
    case 'pageContentExtracted':
      handlePageContent(message.content);
      break;
  }
}

function updateSummaryDisplay(summary) {
  console.log('Updating summary display:', summary);
  
  appState.currentSummary = summary;
  
  // Update title
  elements.aiOverviewTitle.textContent = summary.title || 'AI Overview';
  
  // Clear existing points
  elements.summaryPoints.innerHTML = '';
  
  // Add new summary points from JSON structure
  if (summary.points && Array.isArray(summary.points)) {
    summary.points.forEach(point => {
      const pointElement = document.createElement('div');
      pointElement.className = 'summary-point';
      
      const emojiElement = document.createElement('div');
      emojiElement.className = 'emoji';
      emojiElement.textContent = point.emoji || '📄';
      
      const textElement = document.createElement('div');
      textElement.className = 'summary-text';
      textElement.textContent = point.text || '';
      
      pointElement.appendChild(emojiElement);
      pointElement.appendChild(textElement);
      elements.summaryPoints.appendChild(pointElement);
    });
  }
  
  console.log('Summary display updated successfully');
}

function hideAIOverview() {
  elements.aiOverviewContainer.style.display = 'none';
}

function showAIOverview() {
  elements.aiOverviewContainer.style.display = 'flex';
}

function handleTranslationComplete(data) {
  console.log('Translation completed:', data);
}

function handleTranslationError(error) {
  console.error('Translation error received:', error);
  showErrorState(error);
}

function handlePageContent(content) {
  console.log('Page content received:', content);
}

async function detectLanguage(text) {
  // This could be enhanced to actually detect language
  return 'auto';
}

function initializeLanguageDetection() {
  // Get current page information when sidepanel opens
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      console.log('Current page:', tabs[0].url);
    }
  });
}

function showErrorState(message) {
  console.error('Error state:', message);
  // Could show error in UI here
}

// Language code mapping for TTS and API calls
function getLanguageCode(languageName) {
  const languageMap = {
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
  };
  
  return languageMap[languageName] || 'en-US';
}

function getLanguageName(languageCode) {
  const codeMap = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'no': 'Norwegian',
    'da': 'Danish',
    'fi': 'Finnish',
    'pl': 'Polish',
    'cs': 'Czech',
    'hu': 'Hungarian',
    'ro': 'Romanian',
    'bg': 'Bulgarian',
    'hr': 'Croatian',
    'sr': 'Serbian',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'et': 'Estonian',
    'lv': 'Latvian',
    'lt': 'Lithuanian',
    'el': 'Greek',
    'tr': 'Turkish',
    'he': 'Hebrew',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'id': 'Indonesian',
    'ms': 'Malay',
    'fil': 'Filipino',
    'sw': 'Swahili',
    'af': 'Afrikaans',
    'cy': 'Welsh',
    'ga': 'Irish',
    'uk': 'Ukrainian',
    'be': 'Belarusian',
    'sq': 'Albanian',
    'mk': 'Macedonian'
  };
  
  return codeMap[languageCode] || 'English';
} 