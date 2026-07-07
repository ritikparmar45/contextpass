/**
 * Context Passport - IndexedDB Utility
 * Handles database operations for storing messages and exports.
 * This script is shared and loaded via importScripts in the background worker
 * and via script tags in the popup.
 */

const DB_NAME = 'ContextPassportDB';
const DB_VERSION = 2; // Incremented to v2 to force schema recreation and fix missing index bugs

/**
 * Opens the IndexedDB database and creates object stores if needed.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Recreate stores on upgrade to guarantee clean schema & indexes
      if (db.objectStoreNames.contains('messages')) {
        db.deleteObjectStore('messages');
      }
      if (db.objectStoreNames.contains('exports')) {
        db.deleteObjectStore('exports');
      }

      // Object store for captured messages
      const messageStore = db.createObjectStore('messages', {
        keyPath: 'id',
        autoIncrement: true
      });
      messageStore.createIndex('conversationId', 'conversationId', { unique: false });
      messageStore.createIndex('site', 'site', { unique: false });

      // Object store for exported summaries
      const exportStore = db.createObjectStore('exports', {
        keyPath: 'id',
        autoIncrement: true
      });
      exportStore.createIndex('timestamp', 'timestamp', { unique: false });
      
      console.log('Context Passport DB: Schema upgraded to version', DB_VERSION);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Saves a message to the IndexedDB, preventing duplicates.
 * @param {Object} message - The message to save { conversationId, site, role, content, timestamp }
 * @returns {Promise<boolean>} Resolves to true if saved, false if duplicate or error.
 */
async function saveMessageToDB(message) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');

      // Check for duplicate message in the same conversation
      const index = store.index('conversationId');
      const request = index.getAll(message.conversationId);

      request.onsuccess = () => {
        const existingMessages = request.result;
        const isDuplicate = existingMessages.some(
          (m) =>
            m.site === message.site &&
            m.role === message.role &&
            m.content.trim() === message.content.trim()
        );

        if (isDuplicate) {
          resolve(false); // Duplicate, skip saving
          return;
        }

        // Not duplicate, save message
        const addRequest = store.add(message);
        addRequest.onsuccess = () => {
          resolve(true);
        };
        addRequest.onerror = (e) => {
          console.error('Failed to add message:', e.target.error);
          reject(e.target.error);
        };
      };

      request.onerror = (e) => {
        console.error('Duplicate check query failed:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Database connection failed in saveMessageToDB:', error);
    return false;
  }
}

/**
 * Renames all messages of an old conversationId to a new conversationId.
 * Used when a draft session gets promoted to a real conversation UUID.
 * @param {string} oldId 
 * @param {string} newId 
 * @returns {Promise<boolean>}
 */
async function renameConversationInDB(oldId, newId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const index = store.index('conversationId');
      const request = index.getAll(oldId);

      request.onsuccess = () => {
        const messages = request.result;
        if (messages.length === 0) {
          resolve(true);
          return;
        }

        let updatedCount = 0;
        messages.forEach((msg) => {
          msg.conversationId = newId;
          const putRequest = store.put(msg);
          putRequest.onsuccess = () => {
            updatedCount++;
            if (updatedCount === messages.length) {
              resolve(true);
            }
          };
          putRequest.onerror = (e) => {
            console.error('Failed to update message conversation ID:', e.target.error);
            reject(e.target.error);
          };
        });
      };

      request.onerror = (e) => {
        console.error('Query for old conversation ID failed:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Database connection failed in renameConversationInDB:', error);
    return false;
  }
}

/**
 * Gets all captured messages for a specific conversation ID.
 * @param {string} conversationId 
 * @returns {Promise<Array>}
 */
async function getMessagesFromDB(conversationId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        const messages = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(messages);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Database connection failed in getMessagesFromDB:', error);
    return [];
  }
}

/**
 * Gets the total count of messages stored in the database.
 * @returns {Promise<number>}
 */
async function getMessageCountFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Database connection failed in getMessageCountFromDB:', error);
    return 0;
  }
}

/**
 * Saves a summary export to the database.
 * @param {Object} exportData - { summaryText, timestamp, site }
 * @returns {Promise<boolean>}
 */
async function saveExportToDB(exportData) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['exports'], 'readwrite');
      const store = transaction.objectStore('exports');
      const request = store.add(exportData);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (e) => {
        console.error('Failed to save export:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Database connection failed in saveExportToDB:', error);
    return false;
  }
}

/**
 * Gets the latest summary export from the database.
 * @returns {Promise<Object|null>}
 */
async function getLatestExportFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['exports'], 'readonly');
      const store = transaction.objectStore('exports');
      const index = store.index('timestamp');
      const request = store.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          resolve(cursor.value);
        } else {
          resolve(null);
        }
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Database connection failed in getLatestExportFromDB:', error);
    return null;
  }
}

/**
 * Clears all data from both object stores.
 * @returns {Promise<boolean>}
 */
async function clearAllDataFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['messages', 'exports'], 'readwrite');
      const messageStore = transaction.objectStore('messages');
      const exportStore = transaction.objectStore('exports');

      let messagesCleared = false;
      let exportsCleared = false;

      messageStore.clear().onsuccess = () => {
        messagesCleared = true;
        if (messagesCleared && exportsCleared) resolve(true);
      };

      exportStore.clear().onsuccess = () => {
        exportsCleared = true;
        if (messagesCleared && exportsCleared) resolve(true);
      };

      transaction.onerror = (e) => {
        console.error('Clear database transaction failed:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (error) {
    console.error('Database connection failed in clearAllDataFromDB:', error);
    return false;
  }
}
