/**
 * @fileoverview Chat functionality for Uno Translate Chrome Extension
 * 
 * Handles chatbot interactions focused on website content and translations.
 * Integrates with existing translation workflow and maintains conversation context.
 * 
 * @author Uno Translate Team
 * @version 1.0.0
 */

// =============================================================================
// CHAT MANAGER CLASS
// =============================================================================

/**
 * Manages chat functionality and conversation state
 */
class ChatManager {
  constructor() {
    this.conversationHistory = [];
    this.isLoading = false;
    this.currentPageContent = null;
    this.currentSummary = null;
    this.currentLanguage = 'English';
    this.maxHistoryLength = 20; // Keep last 20 messages
    
    this.initializeElements();
    this.attachEventListeners();
    this.loadConversationHistory();
  }

  /**
   * Initialize DOM elements
   */
  initializeElements() {
    this.elements = {
      chatContainer: document.getElementById('chat-container'),
      chatMessages: document.getElementById('chat-messages'),
      chatInput: document.getElementById('chat-input'),
      chatSendBtn: document.getElementById('chat-send-btn'),
      chatSuggestions: document.getElementById('chat-suggestions'),
      summaryTab: document.getElementById('summary-tab'),
      chatTab: document.getElementById('chat-tab')
    };
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Tab switching
    this.elements.summaryTab?.addEventListener('click', () => this.switchTab('summary'));
    this.elements.chatTab?.addEventListener('click', () => this.switchTab('chat'));

    // Chat input handling
    this.elements.chatInput?.addEventListener('input', () => this.handleInputChange());
    this.elements.chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send button
    this.elements.chatSendBtn?.addEventListener('click', () => this.sendMessage());

    // Suggestion buttons
    this.elements.chatSuggestions?.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion-btn')) {
        this.sendSuggestion(e.target.textContent);
      }
    });

    // Listen for background script messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
    });
  }

  /**
   * Switch between Summary and Chat tabs
   */
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    if (tabName === 'summary') {
      this.elements.summaryTab?.classList.add('active');
      this.elements.chatContainer.style.display = 'none';
      document.querySelector('.summary-section').style.display = 'block';
    } else if (tabName === 'chat') {
      this.elements.chatTab?.classList.add('active');
      this.elements.chatContainer.style.display = 'flex';
      document.querySelector('.summary-section').style.display = 'none';
      
      // Focus chat input when switching to chat
      setTimeout(() => {
        this.elements.chatInput?.focus();
      }, 100);
    }
  }

  /**
   * Handle input change to enable/disable send button
   */
  handleInputChange() {
    const hasText = this.elements.chatInput.value.trim().length > 0;
    this.elements.chatSendBtn.disabled = !hasText || this.isLoading;
  }

  /**
   * Send a message from user input
   */
  async sendMessage() {
    const message = this.elements.chatInput.value.trim();
    if (!message || this.isLoading) return;

    // Add user message to chat
    this.addMessage('user', message);
    
    // Clear input and disable send button
    this.elements.chatInput.value = '';
    this.handleInputChange();

    // Show loading indicator
    this.showLoading();

    try {
      // Send message to background script
      const response = await this.sendChatRequest(message);
      
      // Hide loading and show response
      this.hideLoading();
      this.addMessage('assistant', response.response);
      
      // Update suggestions if provided
      if (response.suggestedQuestions) {
        this.updateSuggestions(response.suggestedQuestions);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      this.hideLoading();
      this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    }
  }

  /**
   * Send a suggestion as a message
   */
  sendSuggestion(suggestionText) {
    this.elements.chatInput.value = suggestionText;
    this.handleInputChange();
    this.sendMessage();
  }

  /**
   * Add a message to the chat interface
   */
  addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role} new`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = content;
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(timestampDiv);
    
    // Remove welcome message if it exists
    const welcomeMsg = this.elements.chatMessages.querySelector('.chat-welcome');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }
    
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    
    // Add to conversation history
    this.conversationHistory.push({ role, content, timestamp: Date.now() });
    this.saveConversationHistory();
    
    // Remove animation class after animation completes
    setTimeout(() => {
      messageDiv.classList.remove('new');
    }, 300);
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    this.isLoading = true;
    this.handleInputChange();
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-loading';
    loadingDiv.innerHTML = `
      <div class="loading-dots">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
      </div>
      <span>Thinking...</span>
    `;
    
    this.elements.chatMessages.appendChild(loadingDiv);
    this.scrollToBottom();
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.isLoading = false;
    this.handleInputChange();
    
    const loadingDiv = this.elements.chatMessages.querySelector('.chat-loading');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }

  /**
   * Scroll chat to bottom
   */
  scrollToBottom() {
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  }

  /**
   * Update suggestion buttons
   */
  updateSuggestions(suggestions) {
    if (!this.elements.chatSuggestions || !Array.isArray(suggestions)) return;
    
    this.elements.chatSuggestions.innerHTML = '';
    suggestions.slice(0, 3).forEach(suggestion => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-btn';
      btn.textContent = suggestion;
      this.elements.chatSuggestions.appendChild(btn);
    });
  }

  /**
   * Send chat request to background script
   */
  async sendChatRequest(message) {
    return new Promise(async (resolve, reject) => {
      // Get target language from current UI state if available
      const targetLanguageSelect = document.getElementById('target-language-select');
      const targetLanguage = targetLanguageSelect?.value || this.currentLanguage || 'English';
      
      // If we don't have page content, try to get it
      if (!this.currentPageContent) {
        console.log('💬 No page content available, requesting fresh extraction...');
        try {
          await this.requestPageContent();
        } catch (error) {
          console.warn('Failed to get fresh page content:', error);
        }
      }
      
      console.log('💬 Chat context debug:', {
        hasPageContent: !!this.currentPageContent,
        hasSummary: !!this.currentSummary,
        targetLanguage: targetLanguage,
        pageContentLength: this.currentPageContent?.length || 0,
        summaryPointsCount: this.currentSummary?.points?.length || 0
      });
      
      chrome.runtime.sendMessage({
        action: 'chatMessage',
        message: message,
        conversationHistory: this.conversationHistory.slice(-10), // Send last 10 messages
        pageContent: this.currentPageContent,
        summary: this.currentSummary,
        targetLanguage: targetLanguage
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      });
    });
  }

  /**
   * Handle messages from background script
   */
  handleBackgroundMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'updateChatContext':
        this.updateContext(message.data);
        break;
      case 'chatResponse':
        // Handle streaming responses if implemented later
        break;
    }
  }

  /**
   * Update chat context with page content and summary
   */
  updateContext(data) {
    console.log('💬 Chat manager receiving context update:', {
      hasPageContent: !!data.pageContent,
      hasSummary: !!data.summary,
      hasTargetLanguage: !!data.targetLanguage,
      pageContentLength: data.pageContent?.length || 0,
      summaryPointsCount: data.summary?.points?.length || 0
    });
    
    if (data.pageContent) {
      this.currentPageContent = data.pageContent;
      console.log('📄 Updated page content:', data.pageContent.substring(0, 100) + '...');
    }
    if (data.summary) {
      this.currentSummary = data.summary;
      console.log('📝 Updated summary:', data.summary);
    }
    if (data.targetLanguage) {
      this.currentLanguage = data.targetLanguage;
      console.log('🌐 Updated target language:', data.targetLanguage);
    }
    
    // Update contextual suggestions based on new context
    this.updateContextualSuggestions();
  }

  /**
   * Request fresh page content from content script
   */
  async requestPageContent() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'getPageContent'
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success && response.content) {
              this.currentPageContent = response.content;
              console.log('📄 Received fresh page content:', response.content.substring(0, 100) + '...');
              resolve(response.content);
            } else {
              reject(new Error('No content received'));
            }
          });
        } else {
          reject(new Error('No active tab found'));
        }
      });
    });
  }

  /**
   * Load conversation history from storage
   */
  async loadConversationHistory() {
    try {
      const result = await chrome.storage.session.get(['chatHistory']);
      if (result.chatHistory) {
        this.conversationHistory = result.chatHistory;
        
        // Restore messages to UI
        this.conversationHistory.forEach(msg => {
          this.addMessageToUI(msg.role, msg.content, false); // Don't save again
        });
        
        if (this.conversationHistory.length > 0) {
          // Remove welcome message if there's existing conversation
          const welcomeMsg = this.elements.chatMessages.querySelector('.chat-welcome');
          if (welcomeMsg) {
            welcomeMsg.remove();
          }
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }

  /**
   * Save conversation history to storage
   */
  async saveConversationHistory() {
    try {
      // Keep only recent messages to avoid storage bloat
      const recentHistory = this.conversationHistory.slice(-this.maxHistoryLength);
      await chrome.storage.session.set({ chatHistory: recentHistory });
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }

  /**
   * Add message to UI without saving to history (for restoration)
   */
  addMessageToUI(role, content, shouldSave = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = content;
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(timestampDiv);
    
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
    
    if (shouldSave) {
      this.conversationHistory.push({ role, content, timestamp: Date.now() });
      this.saveConversationHistory();
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.elements.chatMessages.innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome-icon">💬</div>
        <div class="chat-welcome-text">Ask me anything about this page or its translation!</div>
        <div class="chat-suggestions" id="chat-suggestions">
          <button class="suggestion-btn">What's the main topic?</button>
          <button class="suggestion-btn">Explain this translation</button>
          <button class="suggestion-btn">Cultural context?</button>
        </div>
      </div>
    `;
    this.saveConversationHistory();
  }

  /**
   * Update chat suggestions based on current context
   */
  updateContextualSuggestions() {
    const suggestions = [];
    
    if (this.currentPageContent) {
      suggestions.push("What's the main topic?");
      suggestions.push("Summarize this page");
    }
    
    if (this.currentSummary) {
      suggestions.push("Explain this summary");
    }
    
    if (this.currentLanguage !== 'English') {
      suggestions.push("Cultural context?");
      suggestions.push("Translation tips?");
    }
    
    // Fallback suggestions
    if (suggestions.length === 0) {
      suggestions.push("How does translation work?");
      suggestions.push("Language learning tips");
      suggestions.push("About this extension");
    }
    
    this.updateSuggestions(suggestions.slice(0, 3));
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize chat functionality when DOM is loaded
 */
let chatManager = null;

document.addEventListener('DOMContentLoaded', () => {
  chatManager = new ChatManager();
});

// Export for use in other scripts
window.ChatManager = ChatManager;
window.chatManager = chatManager;