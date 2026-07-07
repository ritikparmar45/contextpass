/**
 * Context Passport - Context Inserter & Exporter Widget Script
 * Injects a premium floating action widget into ChatGPT and Claude containing
 * both "Export Context" and "Import Previous Context" options.
 */

(function () {
  let site = '';
  const hostname = window.location.hostname;
  
  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    site = 'chatgpt';
  } else if (hostname.includes('claude.ai')) {
    site = 'claude';
  }

  // Only inject if on a supported site
  if (!site) return;

  // Wait for page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInjector);
  } else {
    initInjector();
  }

  function initInjector() {
    // Delay slightly to let the page UI load and stabilize
    setTimeout(createFloatingWidget, 1500);
  }

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
   * Creates and appends the floating widget containing Export and Import buttons.
   */
  function createFloatingWidget() {
    // Prevent duplicate injections
    if (document.getElementById('context-passport-floating-widget')) return;

    // 1. Inject Styles
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      #context-passport-floating-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        transform: translateY(40px) scale(0.9);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      
      #context-passport-floating-widget.visible {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      
      .cp-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .cp-action-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        padding: 9px 15px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* Export button style (indigo gradient) */
      .cp-btn-export {
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
      }
      .cp-btn-export:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(124, 58, 237, 0.4);
        border-color: rgba(255, 255, 255, 0.3);
      }
      
      /* Import button style (emerald gradient) */
      .cp-btn-import {
        background: linear-gradient(135deg, #0d9488, #059669);
      }
      .cp-btn-import:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(5, 150, 105, 0.4);
        border-color: rgba(255, 255, 255, 0.3);
      }
      
      .cp-action-btn:active {
        transform: translateY(0);
      }
      
      .cp-action-btn svg {
        width: 14px;
        height: 14px;
      }
      
      /* Status states */
      .cp-action-btn.status-success {
        background: #10b981 !important;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4) !important;
      }
      
      .cp-action-btn.status-error {
        background: #ef4444 !important;
        box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4) !important;
      }
      
      /* Close button */
      .cp-dismiss-btn {
        background: rgba(15, 12, 30, 0.7);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.6);
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s ease;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
      }
      
      .cp-dismiss-btn:hover {
        color: #ffffff;
        background: rgba(15, 12, 30, 0.9);
        border-color: rgba(255, 255, 255, 0.25);
        transform: scale(1.05);
      }
    `;
    document.head.appendChild(styleEl);

    // 2. Create Widget Structure
    const widget = document.createElement('div');
    widget.id = 'context-passport-floating-widget';
    
    widget.innerHTML = `
      <div class="cp-row">
        <!-- Close/Dismiss -->
        <button class="cp-dismiss-btn" title="Dismiss Panel">✕</button>
        
        <!-- Export Button -->
        <button id="cp-export-trigger" class="cp-action-btn cp-btn-export" title="Export current chat context">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span class="export-text">Export Context</span>
        </button>

        <!-- Import Button -->
        <button id="cp-import-trigger" class="cp-action-btn cp-btn-import" title="Import latest exported context">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 12 15 15"/>
          </svg>
          <span class="import-text">Import Context</span>
        </button>
      </div>
    `;

    document.body.appendChild(widget);

    // Fade/Slide in animation
    setTimeout(() => {
      widget.classList.add('visible');
    }, 100);

    // 3. Button Selectors
    const dismissBtn = widget.querySelector('.cp-dismiss-btn');
    const exportBtn = widget.querySelector('#cp-export-trigger');
    const importBtn = widget.querySelector('#cp-import-trigger');
    const exportText = widget.querySelector('.export-text');
    const importText = widget.querySelector('.import-text');

    // Dismiss Handler
    dismissBtn.addEventListener('click', () => {
      widget.classList.remove('visible');
      setTimeout(() => {
        widget.remove();
      }, 400);
    });

    // Export Handler
    exportBtn.addEventListener('click', async () => {
      try {
        exportText.textContent = 'Saving...';
        
        // Trigger export action in service worker
        const response = await chrome.runtime.sendMessage({
          action: 'exportContext',
          conversationId: getUrlConversationId()
        });

        if (response && response.success) {
          exportBtn.classList.add('status-success');
          exportText.textContent = 'Exported!';
          
          setTimeout(() => {
            exportBtn.classList.remove('status-success');
            exportText.textContent = 'Export Context';
          }, 2000);
        } else {
          throw new Error(response.error || 'Capture list empty.');
        }
      } catch (err) {
        console.error('Context Passport: Page export failed:', err);
        exportBtn.classList.add('status-error');
        exportText.textContent = err.message.includes('invalidated') ? 'Reload Page' : 'No logs yet';
        
        setTimeout(() => {
          exportBtn.classList.remove('status-error');
          exportText.textContent = 'Export Context';
        }, 3000);
      }
    });

    // Import Handler
    importBtn.addEventListener('click', async () => {
      try {
        importText.textContent = 'Fetching...';
        
        // Fetch latest exported summary
        const response = await chrome.runtime.sendMessage({ action: 'getLatestExport' });

        if (response && response.success && response.export) {
          const summaryText = response.export.summaryText;
          
          // Inject into active input box
          const success = injectTextIntoChatbox(summaryText);
          
          if (success) {
            importBtn.classList.add('status-success');
            importText.textContent = 'Imported!';
            
            setTimeout(() => {
              importBtn.classList.remove('status-success');
              importText.textContent = 'Import Context';
            }, 2000);
          } else {
            throw new Error('Input box not found.');
          }
        } else {
          throw new Error(response.error || 'No saved export');
        }
      } catch (err) {
        console.error('Context Passport: Page import failed:', err);
        importBtn.classList.add('status-error');
        importText.textContent = err.message.includes('invalidated') ? 'Reload Page' : 'No export found';
        
        setTimeout(() => {
          importBtn.classList.remove('status-error');
          importText.textContent = 'Import Context';
        }, 3000);
      }
    });
  }

  /**
   * Locates the chat input editor on ChatGPT or Claude and inserts context.
   * @param {string} text 
   * @returns {boolean} True if successfully injected, false otherwise.
   */
  function injectTextIntoChatbox(text) {
    const selectors = [
      '#prompt-textarea', // ChatGPT textarea
      'div[contenteditable="true"]', // Claude & ChatGPT edit container
      '.ProseMirror', // Claude ProseMirror wrapper
      'textarea[placeholder*="message"]', // Generic prompt area
      'textarea'
    ];

    let targetEl = null;

    // Search selectors sequentially
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && (el.offsetHeight > 0 || el.offsetWidth > 0)) {
        targetEl = el;
        break;
      }
    }

    if (!targetEl) return false;

    try {
      targetEl.focus();

      // Gold Standard: Use document.execCommand('insertText') to mock user keystrokes
      const selection = window.getSelection();
      if (selection && targetEl.tagName !== 'TEXTAREA') {
        selection.selectAllChildren(targetEl);
        selection.collapseToEnd();
      }
      
      const executed = document.execCommand('insertText', false, text);

      // Fallback
      if (!executed) {
        if (targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'INPUT') {
          targetEl.value = text;
        } else {
          targetEl.innerText = text;
        }
        
        targetEl.dispatchEvent(new Event('input', { bubbles: true }));
        targetEl.dispatchEvent(new Event('change', { bubbles: true }));
      }

      console.log('Context Passport: Context successfully injected.');
      return true;
    } catch (e) {
      console.error('Context Passport: Error during chatbox text insertion:', e);
      return false;
    }
  }
})();
