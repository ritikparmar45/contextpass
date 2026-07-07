/**
 * Context Passport - Background Service Worker
 * Manages central database storage and handles messages from content scripts and popup.
 */

// Import database and compression scripts using absolute paths from the extension root
// This prevents any parent directory traversal restrictions in the service worker
importScripts('/utils/db.js', '/utils/compress.js');

// Listener for runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle actions asynchronously
  handleMessage(request, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('Error handling message:', request, error);
      sendResponse({ success: false, error: error.message });
    });

  return true; // Keep message channel open for asynchronous response
});

/**
 * Routes and handles incoming extension messages.
 * @param {Object} request - The message request.
 * @param {Object} sender - The message sender.
 * @returns {Promise<Object>}
 */
async function handleMessage(request, sender) {
  switch (request.action) {
    case 'saveMessage':
      const saved = await saveMessageToDB(request.message);
      return { success: saved };

    case 'renameConversation':
      const renamed = await renameConversationInDB(request.oldId, request.newId);
      return { success: renamed };

    case 'getMessages':
      const messages = await getMessagesFromDB(request.conversationId);
      return { success: true, messages };

    case 'getMessageCount':
      const count = await getMessageCountFromDB();
      return { success: true, count };

    case 'getLatestExport':
      const latestExport = await getLatestExportFromDB();
      return { success: true, export: latestExport };

    case 'clearDatabase':
      const cleared = await clearAllDataFromDB();
      return { success: cleared };

    case 'exportContext':
      let conversationId = request.conversationId;
      
      // Fallback: If no conversationId is supplied, find the latest conversation ID in the database
      if (!conversationId) {
        conversationId = await findLatestConversationId();
      }

      if (!conversationId) {
        return { success: false, error: 'No conversations found to export.' };
      }

      // Retrieve all messages for this conversation
      const conversationMessages = await getMessagesFromDB(conversationId);
      if (!conversationMessages || conversationMessages.length === 0) {
        return { success: false, error: `No messages found for conversation: ${conversationId}` };
      }

      // Generate the summary text
      const summaryText = generateLocalSummary(conversationMessages);

      // Save summary in exports store
      const exportObject = {
        summaryText,
        timestamp: Date.now(),
        site: conversationMessages[0].site
      };
      const exportSaved = await saveExportToDB(exportObject);

      return { 
        success: exportSaved, 
        summaryText, 
        conversationId,
        site: conversationMessages[0].site 
      };

    default:
      throw new Error(`Unknown message action: ${request.action}`);
  }
}

/**
 * Heuristic to find the conversation ID of the most recently logged message.
 * @returns {Promise<string|null>}
 */
async function findLatestConversationId() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      
      // Open cursor going backwards to inspect latest messages first
      const request = store.openCursor(null, 'prev');
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && cursor.value && cursor.value.conversationId) {
          resolve(cursor.value.conversationId);
        } else {
          resolve(null);
        }
      };
      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Error finding latest conversation ID:', error);
    return null;
  }
}
