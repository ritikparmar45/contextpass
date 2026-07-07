/**
 * Context Passport - Popup Logic
 * Controls dashboard stats, triggers exports, and manages database clearing.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const activeSiteBadge = document.getElementById('active-site-badge');
  const activeSiteText = document.getElementById('active-site-text');
  const msgCountEl = document.getElementById('msg-count');
  const exportBtn = document.getElementById('export-btn');
  const clearBtn = document.getElementById('clear-btn');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');

  let activeTabUrl = '';
  let activeTabConversationId = null;
  let activeSiteName = 'unsupported';

  // 1. Initialize Popup Stats
  initPopup();

  // 2. Event Listeners
  exportBtn.addEventListener('click', handleExport);
  clearBtn.addEventListener('click', handleClear);

  /**
   * Initializes popup UI based on current tab state and database contents.
   */
  async function initPopup() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url) {
        activeTabUrl = tab.url;
        detectActiveSite(activeTabUrl);
      } else {
        setSiteUnsupported();
      }

      // Update message counts
      await updateStats();
    } catch (err) {
      console.error('Failed to initialize popup:', err);
      setSiteUnsupported();
    }
  }

  /**
   * Detects if the current tab is a supported AI website and extracts URL parameters.
   * @param {string} urlString 
   */
  function detectActiveSite(urlString) {
    try {
      const url = new URL(urlString);
      const hostname = url.hostname;
      const pathname = url.pathname;

      if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        activeSiteName = 'chatgpt';
        // Extract conversation ID from /c/<uuid>
        const match = pathname.match(/\/c\/([a-f0-9\-]+)/);
        activeTabConversationId = match ? match[1] : null;

        setSiteSupported('ChatGPT');
      } else if (hostname.includes('claude.ai')) {
        activeSiteName = 'claude';
        // Extract conversation ID from /chat/<uuid>
        const match = pathname.match(/\/chat\/([a-f0-9\-]+)/);
        activeTabConversationId = match ? match[1] : null;

        setSiteSupported('Claude');
      } else {
        setSiteUnsupported();
      }
    } catch (e) {
      console.error('Error parsing tab URL:', e);
      setSiteUnsupported();
    }
  }

  /**
   * Sets UI state for supported site.
   * @param {string} name 
   */
  function setSiteSupported(name) {
    activeSiteText.textContent = name;
    activeSiteBadge.className = 'status-badge active';
    // Enable export button (will check if count > 0 later)
    exportBtn.removeAttribute('disabled');
  }

  /**
   * Sets UI state for unsupported site.
   */
  function setSiteUnsupported() {
    activeSiteText.textContent = 'Unsupported Site';
    activeSiteBadge.className = 'status-badge inactive';
    activeSiteName = 'unsupported';
    activeTabConversationId = null;
    exportBtn.setAttribute('disabled', 'true');
  }

  /**
   * Fetches latest database counts and updates the UI.
   */
  async function updateStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getMessageCount' });
      if (response && response.success) {
        const count = response.count;
        msgCountEl.textContent = count;

        // If on an unsupported site, button stays disabled.
        // If on supported site, disable export button only if there are absolutely no messages in the database.
        if (activeSiteName !== 'unsupported') {
          if (count === 0) {
            exportBtn.setAttribute('disabled', 'true');
          } else {
            exportBtn.removeAttribute('disabled');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching message stats:', err);
    }
  }

  /**
   * Triggers export context routine in background service worker.
   */
  async function handleExport() {
    exportBtn.setAttribute('disabled', 'true');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = `
      <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Exporting...
    `;

    try {
      // Request background to export conversation
      const response = await chrome.runtime.sendMessage({
        action: 'exportContext',
        conversationId: activeTabConversationId
      });

      if (response && response.success) {
        showToast('Context exported successfully!');
      } else {
        showToast(`Failed: ${response.error || 'No messages logged.'}`, true);
      }
    } catch (err) {
      console.error('Export context runtime error:', err);
      showToast('Export failed: Connection error.', true);
    } finally {
      exportBtn.innerHTML = originalText;
      await updateStats();
    }
  }

  /**
   * Triggers clearing database routine in background service worker.
   */
  async function handleClear() {
    if (!confirm('Are you sure you want to clear the entire context history? This action is irreversible.')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearDatabase' });
      if (response && response.success) {
        showToast('Database cleared.');
        await updateStats();
      } else {
        showToast('Failed to clear database.', true);
      }
    } catch (err) {
      console.error('Clear database error:', err);
      showToast('Action failed.', true);
    }
  }

  /**
   * Helper to display a status toast in the popup.
   * @param {string} message 
   * @param {boolean} isError 
   */
  function showToast(message, isError = false) {
    toastMsg.textContent = message;
    
    if (isError) {
      toast.style.background = 'rgba(239, 68, 68, 0.9)';
      toast.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.4)';
      toast.querySelector('.toast-icon').textContent = '✕';
    } else {
      toast.style.background = 'rgba(16, 185, 129, 0.9)';
      toast.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.4)';
      toast.querySelector('.toast-icon').textContent = '✓';
    }

    toast.classList.remove('hidden');
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }
});
