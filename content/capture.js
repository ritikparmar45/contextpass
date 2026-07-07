/**
 * Context Passport - Conversation Capture Script
 * Uses MutationObserver to capture user and assistant messages,
 * resolves draft session IDs to real conversation UUIDs, and sends data to background database.
 */

(function () {
  // Session variables
  let site = '';
  let tempSessionId = '';
  let currentConversationId = '';
  let debounceTimeout = null;
  const sentMessageHashes = new Set(); // Local deduplication cache

  // Identify site
  const hostname = window.location.hostname;
  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    site = 'chatgpt';
  } else if (hostname.includes('claude.ai')) {
    site = 'claude';
  }

  // If not a supported site, exit early
  if (!site) return;

  // Initialize temporary session ID for drafts
  tempSessionId = `temp_${site}_${Date.now()}`;

  /**
   * Helper to parse conversation ID from the URL.
   * @returns {string|null} The conversation UUID, or null if on draft/root page.
   */
  function getUrlConversationId() {
    const pathname = window.location.pathname;
    if (site === 'chatgpt') {
      const match = pathname.match(/\/c\/([a-f0-9\-]+)/);
      return match ? match[1] : null;
    } else if (site === 'claude') {
      const match = pathname.match(/\/chat\/([a-f0-9\-]+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  /**
   * Utility to generate a hash for local message deduplication.
   * @param {string} role 
   * @param {string} content 
   * @returns {string}
   */
  function getMessageHash(role, content) {
    const sanitizedContent = content.trim().replace(/\s+/g, ' ');
    return `${role}_${sanitizedContent.substring(0, 150)}_${sanitizedContent.length}`;
  }

  /**
   * Cleans text content of a message element, stripping action buttons, icons, and svgs.
   * @param {Element} element 
   * @returns {string}
   */
  function cleanElementText(element) {
    const clone = element.cloneNode(true);
    // Remove UI elements like buttons, svgs, and interaction menus
    const elementsToRemove = clone.querySelectorAll('button, svg, [role="button"], .text-token-text-tertiary, style, script');
    elementsToRemove.forEach(el => el.remove());
    return clone.innerText || clone.textContent || '';
  }

  /**
   * Parses the DOM to find all message elements.
   * @returns {Array<Object>} List of parsed messages.
   */
  function parseMessagesFromDOM() {
    const parsedMessages = [];

    if (site === 'chatgpt') {
      // Find all elements with data-message-author-role directly (can be articles or divs)
      const messageElements = document.querySelectorAll('[data-message-author-role]');
      
      messageElements.forEach((el) => {
        const role = el.getAttribute('data-message-author-role'); // 'user' or 'assistant'
        if (role !== 'user' && role !== 'assistant') return;

        let content = '';
        if (role === 'assistant') {
          // Assistant message text resides in markdown container
          const markdownEl = el.querySelector('.markdown');
          content = markdownEl ? markdownEl.innerText : cleanElementText(el);
        } else {
          // User message text resides in whitespace-pre-wrap container
          const userTextEl = el.querySelector('.whitespace-pre-wrap');
          content = userTextEl ? userTextEl.innerText : cleanElementText(el);
        }

        if (content.trim()) {
          parsedMessages.push({ role, content: content.trim() });
        }
      });
    } else if (site === 'claude') {
      // Claude messages reside in bubble containers.
      const bubbles = document.querySelectorAll('.font-user, .font-claude, [data-testid="user-message"], [data-testid="claude-message"], [data-is-user]');
      
      bubbles.forEach((bubble) => {
        let role = '';
        if (bubble.classList.contains('font-user') || 
            bubble.getAttribute('data-testid') === 'user-message' || 
            bubble.getAttribute('data-is-user') === 'true') {
          role = 'user';
        } else if (bubble.classList.contains('font-claude') || 
                   bubble.getAttribute('data-testid') === 'claude-message' || 
                   bubble.getAttribute('data-is-user') === 'false') {
          role = 'assistant';
        }

        if (!role) return;

        const content = cleanElementText(bubble);
        if (content.trim()) {
          parsedMessages.push({ role, content: content.trim() });
        }
      });
    }

    return parsedMessages;
  }

  /**
   * Main processing function. Parses messages, syncs conversation IDs,
   * and saves new messages to IndexedDB via the service worker.
   */
  async function processMessages() {
    try {
      const urlId = getUrlConversationId();
      
      // Handle Transition: From draft (tempSessionId) to real conversation ID (urlId)
      if (urlId && tempSessionId) {
        console.log(`Context Passport: Transitioning draft session ${tempSessionId} to live ID ${urlId}`);
        const response = await chrome.runtime.sendMessage({
          action: 'renameConversation',
          oldId: tempSessionId,
          newId: urlId
        });
        
        if (response && response.success) {
          tempSessionId = null;
        }
      }

      currentConversationId = urlId || tempSessionId;

      if (!currentConversationId) return;

      // Parse messages from DOM
      const messages = parseMessagesFromDOM();
      
      console.log(`Context Passport: Found ${messages.length} message(s) on active page.`);

      // Process and save messages
      let newSaves = 0;
      for (const msg of messages) {
        const hash = getMessageHash(msg.role, msg.content);
        
        if (sentMessageHashes.has(hash)) continue;

        const payload = {
          conversationId: currentConversationId,
          site: site,
          role: msg.role,
          content: msg.content,
          timestamp: Date.now()
        };

        const response = await chrome.runtime.sendMessage({
          action: 'saveMessage',
          message: payload
        });

        if (response && response.success) {
          sentMessageHashes.add(hash);
          newSaves++;
        }
      }
      
      if (newSaves > 0) {
        console.log(`Context Passport: Successfully saved ${newSaves} new message(s) to database.`);
      }
    } catch (error) {
      console.error('Context Passport: Error in capture loop:', error);
    }
  }

  /**
   * Debounces execution of processMessages to avoid freezing during streaming or rapid typing.
   */
  function triggerCaptureDebounced() {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    debounceTimeout = setTimeout(() => {
      processMessages();
    }, 800);
  }

  // Start observing DOM changes after DOM has loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
  } else {
    startObserving();
  }

  function startObserving() {
    console.log(`Context Passport: Initiated Capture Observer for ${site.toUpperCase()}`);
    
    // Initial run to capture any messages already on page
    triggerCaptureDebounced();

    // Create MutationObserver
    const observer = new MutationObserver((mutations) => {
      let shouldTrigger = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
          shouldTrigger = true;
          break;
        }
      }

      if (shouldTrigger) {
        triggerCaptureDebounced();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener('popstate', triggerCaptureDebounced);
    
    // Periodically sweep (every 3 seconds) as a fallback
    setInterval(() => {
      triggerCaptureDebounced();
    }, 3000);
  }
})();
