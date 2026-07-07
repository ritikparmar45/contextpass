# Context Passport 🛂

A production-quality Chrome Extension that allows users to seamlessly transfer conversation context between AI assistants like **ChatGPT** and **Claude** completely locally and privately.

No server, no backend, and no external APIs are utilized. Everything remains stored securely inside the browser's IndexedDB.

---

## ✨ Features

*   **Silent Background Capture**: Monitors active chat rooms on supported sites using a lightweight, debounced `MutationObserver` without causing UI thread freezes.
*   **Dual-Button Floating Widget**: Injects an elegant control panel on the page containing **Export Context** and **Import Context** triggers.
*   **Hybrid Compression (Option 1)**: Summarizes the chit-chat (Problem, Decisions, Next Steps) but extracts and appends raw code blocks (` ```...``` `) un-truncated to ensure **zero code-details loss**.
*   **Persistent Client-Side Database**: Uses an `IndexedDB` schema to manage local history logs and handle dynamic draft-to-UUID conversation migrations.
*   **Glassmorphic Dashboard**: A premium dark-mode popup panel showing active connection indicators, message log count statistics, and quick triggers.

---

## 🛠️ Project Structure

```
context-passport/
├── manifest.json         # Extension configurations and injection matches
├── README.md             # Project documentation
├── .gitignore            # Git exclusion guidelines
├── background/
│   └── service-worker.js # Coordinates DB actions and isolates SOP boundaries
├── content/
│   ├── detect.js         # Site audit and diagnostic logger
│   ├── capture.js        # DOM observer and message logger
│   └── inject.js         # Web-page floating widget constructor
├── popup/
│   ├── popup.html        # Dashboard visual frame
│   ├── popup.css         # Glassmorphic visual declarations
│   └── popup.js          # Dashboard controller
└── utils/
    ├── db.js             # Promise-based IndexedDB schema and operations wrapper
    └── compress.js       # Local NLP heuristic-based summarizer
```

---

## 🚀 Installation & Loading

1.  Download or clone this repository to your local machine.
2.  Open Google Chrome and go to **`chrome://extensions/`**.
3.  Enable **Developer mode** using the toggle switch in the top-right corner.
4.  Click the **Load unpacked** button in the top-left corner.
5.  Select the `context-passport` project directory.
6.  Pin the **Context Passport** icon to your extensions toolbar for quick dashboard status updates.

---

## 📖 How to Use

1.  **Start Chatting**: Open a chat on [ChatGPT](https://chatgpt.com) or [Claude](https://claude.ai). The observer will initialize (you can see `ChatGPT/Claude Detected` inside DevTools Console).
2.  **Export Context**: Once messages are exchanged, click the purple **`Export Context`** button inside the floating widget in the bottom-right corner of the screen.
3.  **Import Context**: Go to the other AI site (e.g. Claude). Click the green **`Import Context`** button in the floating widget.
4.  **Prompt & Continue**: The context snapshot (along with any reference code blocks intact) is instantly pasted into the chat prompt input container, focused and ready to send.

---

## 🔒 Privacy & Security

*   **100% Client-Side**: All databases reside in the extension origin partitioning inside Chrome. No third-party servers ever read your chats.
*   **No API Keys Required**: Compression is performed locally via light parsing heuristics.

---

## ⚡ Technology Stack

*   Manifest V3 Architecture
*   Vanilla JavaScript (ES6+)
*   Service Workers
*   IndexedDB Storage API
*   DOM MutationObserver API
*   CSS Grid, Flexbox, & Variables (Custom gradients & frosted glass effects)
