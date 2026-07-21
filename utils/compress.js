/**
 * Context Passport - Context Compression & Summarization Utility
 * Creates a local structured summary of the conversation without calling external APIs.
 * Preserves exact code blocks to prevent critical information loss (Option 1 Hybrid Approach).
 */

/**
 * Heuristic-based text compressor that cleans up tabular noise,
 * removes layout text, and extracts key sentences to form a concise summary.
 * @param {string} text 
 * @returns {string} The compressed text.
 */
function compressMessageText(text, maxLength = 800) {
  if (!text) return '';
  
  // Clean up typical chat platform UI noise (e.g. Copy code, Share, etc.)
  let cleaned = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (line.length === 0) return true; // keep empty lines for structure
      if (/^(Copy|Copy code|Share|Edit|Regenerate|Retry|Thumbs up|Thumbs down)$/i.test(line)) return false;
      return true;
    })
    .join('\n')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Gracefully truncate at word/sentence boundary
  let truncated = cleaned.substring(0, maxLength);
  const lastDot = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastNewline = truncated.lastIndexOf('\n');
  
  const cutIndex = Math.max(lastDot, lastQuestion, lastExclamation, lastNewline);
  if (cutIndex > maxLength * 0.7) {
    truncated = truncated.substring(0, cutIndex + 1);
  } else {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.substring(0, lastSpace);
    }
  }

  return truncated.trim() + '\n\n*... [Truncated for conciseness]*';
}

/**
 * Generates a structured context summary from a list of conversation messages.
 * @param {Array} messages - List of messages { role, content, timestamp, site }
 * @returns {string} The structured markdown summary.
 */
function generateLocalSummary(messages) {
  if (!messages || messages.length === 0) {
    return 'No conversation history found to export.';
  }

  // Filter messages
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  // 1. Identify Goal / Problem with Greeting Filtering
  let problem = 'Not explicitly defined.';
  if (userMessages.length > 0) {
    let firstSubstantialMsg = '';
    const greetingsRegex = /^(hi|hello|hey|greetings|good morning|good afternoon|test|can you help|yo|dear)/i;
    
    for (let i = 0; i < Math.min(userMessages.length, 3); i++) {
      const content = userMessages[i].content.trim();
      if (!greetingsRegex.test(content) && content.length > 15) {
        firstSubstantialMsg = content;
        break;
      }
    }
    
    if (!firstSubstantialMsg) {
      firstSubstantialMsg = userMessages[0].content.trim();
    }
    
    problem = compressMessageText(firstSubstantialMsg, 600);
  }

  // 2. Extract Key Entities & Topics (capitalized phrases)
  const entities = new Set();
  const entityRegex = /\b([A-Z][a-zA-Z0-9']+(?:\s+[A-Z][a-zA-Z0-9']+)+)\b/g;
  const commonPhrasesToExclude = new Set([
    'The User', 'The Assistant', 'Chrome Extension', 'Manifest V3', 'IndexedDB', 'Tailwind CSS',
    'Google Chrome', 'New Chat', 'Web Page', 'Service Worker'
  ]);
  
  messages.forEach(msg => {
    let match;
    entityRegex.lastIndex = 0;
    while ((match = entityRegex.exec(msg.content)) !== null) {
      const phrase = match[1].trim();
      if (phrase.length > 3 && phrase.length < 50 && !commonPhrasesToExclude.has(phrase)) {
        const firstWord = phrase.split(' ')[0].toLowerCase();
        if (!['i', 'we', 'you', 'he', 'she', 'they', 'it', 'this', 'that', 'there', 'here', 'first', 'second', 'then', 'now', 'if', 'when', 'the', 'a', 'an', 'our', 'my', 'your', 'his', 'her', 'their', 'india', 'jaise'].includes(firstWord)) {
          entities.add(phrase);
        }
      }
    }
  });

  const sortedEntities = Array.from(entities).sort((a, b) => b.length - a.length);
  const filteredEntities = [];
  sortedEntities.forEach(ent => {
    if (!filteredEntities.some(existing => existing.includes(ent))) {
      filteredEntities.push(ent);
    }
  });

  let entitiesSection = '';
  if (filteredEntities.length > 0) {
    entitiesSection = filteredEntities.map(e => `- **${e}**`).join('\n');
  } else {
    entitiesSection = '- No major specific entities or projects detected.';
  }

  // 3. Extract Active Questions / Requests
  const questions = [];
  const lastMessages = messages.slice(-3); // Look at last 3 messages
  const hindiQuestionKeywords = ['kya', 'kaise', 'bta', 'konsa', 'opportunity', 'project', 'konse', 'kab', 'kidhar'];

  lastMessages.forEach(msg => {
    if (msg.role === 'user') {
      const content = msg.content;
      const lines = content.split(/(?:[.?!\n]+)/);
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.length > 10 && trimmed.length < 200) {
          const lower = trimmed.toLowerCase();
          const hasHindiKeyword = hindiQuestionKeywords.some(kw => lower.includes(kw));
          const hasQuestionMark = trimmed.includes('?');
          
          if (hasQuestionMark || hasHindiKeyword || lower.startsWith('q:') || lower.startsWith('bhai ')) {
            if (!questions.includes(trimmed)) {
              questions.push(trimmed);
            }
          }
        }
      });
    }
  });

  let questionsSection = '';
  if (questions.length > 0) {
    questionsSection = questions.map(q => `- ${q}`).join('\n');
  } else {
    questionsSection = '- No active pending questions found in the latest turns.';
  }

  // 4. Progress and Tech Stack
  const totalTurns = messages.length;
  let progress = `Conversation contains ${totalTurns} total messages (${userMessages.length} user prompts, ${assistantMessages.length} assistant responses).`;
  
  const decisions = [];
  const technologies = new Set();
  
  const techKeywords = [
    'javascript', 'typescript', 'react', 'vue', 'angular', 'svelte', 'nextjs', 'vite',
    'tailwind', 'css', 'html', 'python', 'django', 'flask', 'fastapi', 'node', 'express',
    'postgres', 'mongodb', 'sqlite', 'chrome extension', 'manifest v3', 'indexeddb', 'rust', 'go'
  ];

  const rawCodeBlocks = [];
  const codeBlockRegex = /```[a-zA-Z]*\n([\s\S]*?)\n```/g;

  const decisionKeywords = [
    /we decided to\s+([^.\n]+)/i,
    /let's (?:use|go with|do)\s+([^.\n]+)/i,
    /we will (?:use|implement|setup|need to)\s+([^.\n]+)/i,
    /i prefer\s+([^.\n]+)/i,
    /we're going to\s+([^.\n]+)/i,
    /chosen to\s+([^.\n]+)/i,
    /preferred stack is\s+([^.\n]+)/i,
    /instead of\s+([^,\n.]+),\s*(?:we will|let's)\s+([^.\n]+)/i
  ];

  messages.forEach(msg => {
    const textLower = msg.content.toLowerCase();
    
    // Scan tech stack
    techKeywords.forEach(tech => {
      if (textLower.includes(tech)) {
        technologies.add(tech.charAt(0).toUpperCase() + tech.slice(1));
      }
    });

    // Detect decisions sentence-by-sentence to keep sentence context
    const sentences = msg.content.split(/(?<=[.!?])\s+/);
    sentences.forEach(sentence => {
      for (const regex of decisionKeywords) {
        const match = sentence.match(regex);
        if (match) {
          let extracted = sentence.trim().replace(/\s+/g, ' ');
          // Capitalize first letter
          extracted = extracted.charAt(0).toUpperCase() + extracted.slice(1);
          if (extracted.length >= 10 && extracted.length < 180 && !decisions.includes(extracted)) {
            decisions.push(extracted);
          }
          break;
        }
      }
    });

    // Extract all raw code blocks
    let match;
    codeBlockRegex.lastIndex = 0; // Reset regex cursor
    while ((match = codeBlockRegex.exec(msg.content)) !== null) {
      if (match[0] && !rawCodeBlocks.some(b => b.block === match[0])) {
        rawCodeBlocks.push({
          role: msg.role,
          block: match[0]
        });
      }
    }
  });

  let decisionsSection = '';
  if (decisions.length > 0) {
    decisionsSection = decisions.map(d => `- ${d}`).join('\n');
  } else {
    decisionsSection = '- Kept technical setup focused on default parameters.\n- No explicitly stated decisions found.';
  }

  // 5. Identify Next Steps (Compressed last message, preserving lists/code block alignment)
  let nextStep = 'Continue the conversation where it left off.';
  if (messages.length > 1) {
    const lastMsg = messages[messages.length - 1];
    nextStep = compressMessageText(lastMsg.content.trim(), 800);
  }

  // 6. User Preferences & Tech Stack
  let techStackString = technologies.size > 0 
    ? Array.from(technologies).join(', ') 
    : 'Not explicitly specified.';

  // 7. Build Code Block Section
  let codeSection = '';
  if (rawCodeBlocks.length > 0) {
    // Keep raw code blocks completely un-truncated for accurate reconstruction
    codeSection = '\n#### 6. Reference Code Blocks (Un-truncated)\n' + 
      rawCodeBlocks.map(cb => `*From ${cb.role.toUpperCase()}:*\n${cb.block}`).join('\n\n');
  }

  // Build the markdown summary structure
  const summary = `### CONTEXT PASSPORT: CONVERSATION SNAPSHOT
---
**Original Source**: ${messages[0].site.toUpperCase()} (ID: ${messages[0].conversationId})
**Total Turns**: ${totalTurns} messages

#### 1. Problem / Goal
> ${problem}

#### 2. Key Entities & Discussed Topics
${entitiesSection}

#### 3. Active Questions & Requests
${questionsSection}

#### 4. Progress & Technical Stack
- ${progress}
- Key Tech Detected: ${techStackString}

#### 5. Important Decisions
${decisionsSection}

#### 6. Next Step / Current Status
\`\`\`text
${nextStep}
\`\`\`

#### 7. User Context & Preferences
- Preferred Tech Stack: ${techStackString}
- Please resume assistance based on the details above.
${codeSection}
---
*Context imported via Context Passport.*`;

  return summary;
}

// Export for popup/service worker environments
if (typeof self !== 'undefined') {
  self.generateLocalSummary = generateLocalSummary;
}
