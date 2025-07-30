# Developer Guide - AI Page Translator Chrome Extension

## 📚 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Code Organization](#code-organization)
4. [Design Patterns](#design-patterns)
5. [Getting Started](#getting-started)
6. [Making Changes](#making-changes)
7. [Testing & Debugging](#testing--debugging)
8. [Common Tasks](#common-tasks)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## 📋 Overview

This Chrome extension translates web pages using AI and provides intelligent summaries. The codebase has been designed with **maintainability** and **readability** as top priorities, making it easy for new developers (especially interns) to understand and contribute.

### 🎯 Key Goals

- **Clean Architecture**: Clear separation of concerns
- **Comprehensive Documentation**: Every function and class is documented
- **Error Handling**: Robust error handling throughout
- **Performance**: Caching and optimization built-in
- **Testability**: Modular design makes testing easier

---

## 🏗️ Architecture

The extension follows a **modular architecture** with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sidepanel     │    │   Background    │    │   Content       │
│   (UI Layer)    │◄──►│   (Coordinator) │◄──►│   (Page Layer)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ User Interface  │    │ State & Cache   │    │ DOM Manipulation│
│ Event Handling  │    │ API Calls       │    │ Text Extraction │
│ State Display   │    │ Message Routing │    │ Translation     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔧 Core Components

#### 1. **Sidepanel (`sidepanel/`)**
- **Purpose**: User interface and interaction handling
- **Components**:
  - `AppStateManager`: Manages UI state
  - `UIManager`: DOM manipulation and updates
  - `EventManager`: Handles user interactions
  - `SpeechManager`: Text-to-speech functionality
  - `StorageManager`: Chrome storage operations

#### 2. **Background (`background/`)**
- **Purpose**: Central coordinator and API handler
- **Components**:
  - `StateManager`: Manages translation states across tabs
  - `APIManager`: Handles AWS API communications
  - `CacheManager`: Translation caching and optimization
  - `MessageRouter`: Routes messages between components
  - `TabManager`: Tab lifecycle management

#### 3. **Content (`content/`)**
- **Purpose**: Web page interaction and translation
- **Features**: DOM manipulation, text extraction, overlay creation

#### 4. **Shared (`shared/`)**
- **Purpose**: Common utilities and constants
- **Files**:
  - `constants.js`: All configuration values
  - `utils.js`: Reusable helper functions

---

## 📁 Code Organization

### 📂 File Structure

```
translate-ext/
├── 📄 manifest.json              # Extension configuration
├── 📄 DEVELOPER_GUIDE.md         # This guide
├── 📄 README.md                  # User documentation
├── 📁 sidepanel/
│   ├── 📄 sidepanel.html         # UI structure
│   ├── 📄 sidepanel.css          # Styling
│   └── 📄 sidepanel.js           # UI logic (1,000+ lines)
├── 📁 background/
│   └── 📄 background.js          # Service worker (1,300+ lines)
├── 📁 content/
│   ├── 📄 content.js             # Page interaction
│   └── 📄 overlay.css            # Translation overlay styles
├── 📁 shared/
│   ├── 📄 constants.js           # Configuration constants
│   └── 📄 utils.js               # Utility functions
├── 📁 aws/
│   └── 📄 lambda.js              # AWS Lambda function
└── 📁 assets/
    └── 📁 icons/                 # Extension icons
```

### 🏷️ Naming Conventions

- **Classes**: PascalCase (`StateManager`, `APIManager`)
- **Functions**: camelCase (`handleTranslation`, `updateUI`)
- **Constants**: SCREAMING_SNAKE_CASE (`CONFIG`, `API_ENDPOINTS`)
- **Files**: kebab-case (`background.js`, `constants.js`)
- **CSS Classes**: kebab-case (`.translate-btn`, `.ai-overview`)

---

## 🎨 Design Patterns

### 1. **Manager Pattern**
Each major functionality is handled by a dedicated manager class:

```javascript
// Example: StateManager handles all state operations
class StateManager {
  constructor() {
    this.state = {};
    this.listeners = [];
  }
  
  get(key) { /* Get state value */ }
  set(key, value) { /* Set state and notify listeners */ }
  subscribe(listener) { /* Add state change listener */ }
}
```

### 2. **Observer Pattern**
State changes trigger automatic UI updates:

```javascript
// StateManager notifies listeners when state changes
stateManager.subscribe((key, newValue, oldValue) => {
  if (key === 'isTranslating') {
    uiManager.updateTranslateButton(newValue);
  }
});
```

### 3. **Dependency Injection**
Managers receive their dependencies through constructors:

```javascript
// EventManager receives all its dependencies
class EventManager {
  constructor(stateManager, uiManager, speechManager) {
    this.stateManager = stateManager;
    this.uiManager = uiManager;
    this.speechManager = speechManager;
  }
}
```

### 4. **Error-First Callbacks**
Consistent error handling pattern:

```javascript
try {
  const result = await apiCall();
  return { success: true, data: result };
} catch (error) {
  Logger.error('Operation failed', error, 'ComponentName');
  return { success: false, error: error.message };
}
```

---

## 🚀 Getting Started

### 📋 Prerequisites

1. **Node.js 18+** (for AWS Lambda development)
2. **Chrome 114+** (for sidepanel support)
3. **Code Editor** with JavaScript support (VS Code recommended)

### 🛠️ Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd translate-ext
   ```

2. **Load extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

3. **Configure AWS (if testing API)**
   - Set up AWS Lambda function
   - Update `AWS_ENDPOINT` in `shared/constants.js`

### 🔍 Understanding the Code

#### Start Here: `sidepanel/sidepanel.js`
This is the main UI controller. Look for:
- `SidepanelApp` class: Main application controller
- `AppStateManager`: How state is managed
- `EventManager`: How user interactions are handled

#### Then: `background/background.js`
This is the central coordinator. Key classes:
- `BackgroundApp`: Main background controller
- `MessageRouter`: How components communicate
- `APIManager`: How API calls are made

---

## ✏️ Making Changes

### 🎯 Before You Start

1. **Understand the flow**: Trace through how a translation request flows through the system
2. **Check existing patterns**: Look for similar functionality before creating new code
3. **Read the JSDoc**: Every function has detailed documentation

### 🔄 Common Change Patterns

#### 1. **Adding a New UI Feature**

```javascript
// 1. Add to UIManager
class UIManager {
  showNewFeature(data) {
    // DOM manipulation here
    Logger.info('New feature displayed', 'UIManager');
  }
}

// 2. Add event handling in EventManager
class EventManager {
  setupNewFeatureEvents() {
    const button = this.uiManager.elements.newFeatureBtn;
    button.addEventListener('click', () => this.handleNewFeature());
  }
}

// 3. Update state as needed
this.stateManager.set('newFeatureEnabled', true);
```

#### 2. **Adding a New API Endpoint**

```javascript
// 1. Add to constants
const CONFIG = {
  API: {
    ENDPOINTS: {
      NEW_FEATURE: '/new-feature'
    }
  }
};

// 2. Add API method
class APIManager {
  async callNewFeature(data) {
    return await this.makeAPICall(CONFIG.API.ENDPOINTS.NEW_FEATURE, data);
  }
}

// 3. Add message handling
case CONFIG.MESSAGES.NEW_FEATURE:
  await this.handleNewFeature(message, sender, sendResponse);
  break;
```

#### 3. **Adding Configuration Options**

```javascript
// 1. Add to shared/constants.js
export const CONFIG = {
  NEW_FEATURE: {
    ENABLED: true,
    TIMEOUT: 5000,
    MAX_RETRIES: 3
  }
};

// 2. Use throughout codebase
if (CONFIG.NEW_FEATURE.ENABLED) {
  // Feature logic here
}
```

### ⚠️ What NOT to Do

- ❌ Don't modify multiple files for a single feature without understanding dependencies
- ❌ Don't add `console.log()` - use the `Logger` utility
- ❌ Don't hardcode values - add them to `constants.js`
- ❌ Don't ignore errors - always handle them gracefully
- ❌ Don't skip JSDoc comments for new functions

---

## 🧪 Testing & Debugging

### 🔍 Debugging Tools

#### 1. **Console Logging**
The extension has a sophisticated logging system:

```javascript
// Different log levels
Logger.error('Something went wrong', error, 'ComponentName');
Logger.warn('This might be a problem', 'ComponentName');
Logger.info('Important information', 'ComponentName');
Logger.debug('Detailed debugging info', data, 'ComponentName');

// Change log level for development
Logger.currentLevel = Logger.levels.DEBUG; // See all logs
```

#### 2. **Chrome DevTools**

**Background Script Debugging:**
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "Inspect views: service worker"

**Sidepanel Debugging:**
1. Open sidepanel
2. Right-click → "Inspect"

**Content Script Debugging:**
1. Open any webpage
2. F12 → Console
3. Look for extension logs

#### 3. **State Inspection**

```javascript
// In sidepanel console
app.stateManager.state  // See current state

// In background console
backgroundApp.stateManager.getStatistics()  // See state stats
backgroundApp.cacheManager.getStatistics()  // See cache stats
```

### 🧪 Testing Strategies

#### 1. **Manual Testing Checklist**
- [ ] Extension loads without errors
- [ ] Sidepanel opens on icon click
- [ ] Language selection works
- [ ] Translation request succeeds
- [ ] Summary appears after translation
- [ ] Copy function works
- [ ] TTS function works
- [ ] Error states display properly

#### 2. **Error Testing**
- Test with no internet connection
- Test with invalid API endpoint
- Test with very large pages
- Test with pages that have no text

---

## 📋 Common Tasks

### 🎨 UI Changes

**Adding a new button:**
```javascript
// 1. Add to HTML
<button id="new-feature-btn">New Feature</button>

// 2. Add to UIManager.initializeElements()
newFeatureBtn: document.getElementById('new-feature-btn'),

// 3. Add event listener in EventManager
this.uiManager.elements.newFeatureBtn.addEventListener('click', 
  () => this.handleNewFeature());
```

### 🔧 API Changes

**Adding a new API call:**
```javascript
// 1. Add endpoint to constants.js
NEW_ENDPOINT: '/new-endpoint'

// 2. Add method to APIManager
async callNewEndpoint(data) {
  return await this.makeAPICall(CONFIG.API.ENDPOINTS.NEW_ENDPOINT, data);
}

// 3. Add message handler
case 'newEndpoint':
  const result = await this.apiManager.callNewEndpoint(message.data);
  sendResponse({ success: true, result });
  break;
```

### 💾 Storage Changes

**Adding new storage:**
```javascript
// 1. Add key to constants.js
STORAGE_KEYS: {
  NEW_SETTING: 'newSetting'
}

// 2. Add to StorageManager
static async saveNewSetting(value) {
  await chrome.storage.sync.set({ [CONFIG.STORAGE_KEYS.NEW_SETTING]: value });
}
```

### 🎯 State Management

**Adding new state:**
```javascript
// 1. Add to initial state in AppStateManager
this.state = {
  newFeatureEnabled: false,
  // ... other state
};

// 2. Add listener in EventManager.setupStateChangeListeners()
case 'newFeatureEnabled':
  this.uiManager.toggleNewFeature(newValue);
  break;
```

---

## ✅ Best Practices

### 📝 Code Style

1. **Use JSDoc for all functions**
   ```javascript
   /**
    * Translates text content using the API
    * @param {string} text - Text to translate
    * @param {string} targetLanguage - Target language
    * @returns {Promise<string>} Translated text
    */
   async translateText(text, targetLanguage) {
     // Implementation here
   }
   ```

2. **Use the Logger utility**
   ```javascript
   // ✅ Good
   Logger.info('Translation started', 'TranslationManager');
   
   // ❌ Bad
   console.log('Translation started');
   ```

3. **Handle errors gracefully**
   ```javascript
   try {
     const result = await apiCall();
     return { success: true, data: result };
   } catch (error) {
     Logger.error('API call failed', error, 'ComponentName');
     return { success: false, error: error.message };
   }
   ```

4. **Use constants instead of magic numbers**
   ```javascript
   // ✅ Good
   setTimeout(callback, CONFIG.UI.COPY_FEEDBACK_DURATION);
   
   // ❌ Bad
   setTimeout(callback, 2000);
   ```

### 🔧 Architecture Guidelines

1. **Single Responsibility**: Each class should have one clear purpose
2. **Dependency Injection**: Pass dependencies through constructors
3. **Error Boundaries**: Catch and handle errors at appropriate levels
4. **Consistent Patterns**: Follow existing patterns for new features

### 🚀 Performance Guidelines

1. **Use caching**: Check `CacheManager` before making API calls
2. **Debounce user inputs**: Avoid too many rapid API calls
3. **Clean up resources**: Remove event listeners, clear timers
4. **Monitor performance**: Use `PerformanceMonitor` for slow operations

---

## 🐛 Troubleshooting

### ❗ Common Issues

#### 1. **Sidepanel Won't Open**
```javascript
// Check manifest.json
{
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html",
    "openPanelOnActionClick": true  // ← This is crucial
  }
}
```

#### 2. **API Calls Failing**
```javascript
// Check network tab in DevTools
// Look for CORS errors or 429 rate limiting
// Verify AWS_ENDPOINT in constants.js
```

#### 3. **State Not Updating**
```javascript
// Make sure you're using set() method
stateManager.set('key', value);  // ✅ Triggers listeners

// Not direct assignment
stateManager.state.key = value;  // ❌ Won't trigger listeners
```

#### 4. **Memory Leaks**
```javascript
// Always clean up in cleanup methods
cleanup() {
  this.speechManager.stopSpeaking();
  this.stateManager.reset();
  // Clear intervals, remove listeners, etc.
}
```

### 🔍 Debugging Steps

1. **Check console for errors** in both background and sidepanel
2. **Verify all files are loaded** correctly
3. **Check message passing** between components
4. **Validate API responses** in network tab
5. **Test with minimal reproduction** case

### 📞 Getting Help

1. **Read the JSDoc** comments for the function you're working with
2. **Check existing similar functionality** for patterns
3. **Look at the error logs** with full context
4. **Test with simple cases** first, then add complexity

---

## 📖 Learning Resources

### 🎓 Chrome Extension Development
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

### 🏗️ Architecture Patterns
- [JavaScript Design Patterns](https://addyosmani.com/resources/essentialjsdesignpatterns/book/)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)

### 🔧 JavaScript Best Practices
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [JSDoc Documentation](https://jsdoc.app/)

---

## 🎯 Next Steps for New Developers

1. **Read through this entire guide** 📖
2. **Load the extension** and test basic functionality 🧪
3. **Open DevTools** and explore the console logs 🔍
4. **Make a small change** (like adding a console log) and test it ✏️
5. **Understand the translation flow** by tracing through the code 🔄
6. **Start with UI changes** before moving to API/backend changes 🎨

Remember: **It's better to ask questions than to break things!** 💬

---

*Happy coding! 🚀* 