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
function compressMessageText(text) {
  if (!text) return '';
  
  // 1. Split into lines and filter out short/numeric/tabular noise
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (line.length === 0) return false;
      // Filter out lines that are very short (less than 4 characters) and are not standard short words
      if (line.length < 4 && !/^[a-zA-Z]{2,3}$/.test(line)) return false;
      // Filter out lines that only contain numbers, temperatures, or layout symbols
      if (/^[0-9°C\/F\-\+\s:,]+$/i.test(line)) return false;
      return true;
    });

  if (lines.length === 0) return 'Content summarized to general references.';

  // 2. Remove consecutive duplicate lines
  const uniqueLines = [];
  lines.forEach((line, index) => {
    if (index === 0 || line !== lines[index - 1]) {
      uniqueLines.push(line);
    }
  });

  const cleanedText = uniqueLines.join(' ');

  // 3. Sentence extraction
  // Split by standard punctuation
  const sentences = cleanedText.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  
  if (sentences.length <= 3) {
    return cleanedText;
  }

  // Take the first two sentences and the last sentence to form a cohesive summary
  return `${sentences[0]} ${sentences[1]} [...] ${sentences[sentences.length - 1]}`;
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

  // 1. Identify the Problem / Goal
  // Heuristic: Use the user's very first message as the primary goal/problem statement.
  let problem = 'Not explicitly defined.';
  if (userMessages.length > 0) {
    problem = compressMessageText(userMessages[0].content.trim());
  }

  // 2. Identify Progress
  // Heuristic: List the size of the exchange and key topics based on message count.
  const totalTurns = messages.length;
  let progress = `Conversation contains ${totalTurns} total messages (${userMessages.length} user prompts, ${assistantMessages.length} assistant responses).`;
  
  // 3. Identify Important Decisions / Tech Constraints
  // Heuristic: Scan message history for keywords like "decided", "prefer", "use", "need", "should", "must", or code references.
  const decisions = [];
  const technologies = new Set();
  
  // Tech stack patterns to scan for
  const techKeywords = [
    'javascript', 'typescript', 'react', 'vue', 'angular', 'svelte', 'nextjs', 'vite',
    'tailwind', 'css', 'html', 'python', 'django', 'flask', 'fastapi', 'node', 'express',
    'postgres', 'mongodb', 'sqlite', 'chrome extension', 'manifest v3', 'indexeddb', 'rust', 'go'
  ];

  // Extract code blocks from the messages history (Option 1: Raw Code Preservation)
  const rawCodeBlocks = [];
  const codeBlockRegex = /```[a-zA-Z]*\n([\s\S]*?)\n```/g;

  messages.forEach(msg => {
    const textLower = msg.content.toLowerCase();
    
    // Scan tech stack
    techKeywords.forEach(tech => {
      if (textLower.includes(tech)) {
        technologies.add(tech.charAt(0).toUpperCase() + tech.slice(1));
      }
    });

    // Detect explicit decision keywords
    const decisionMatches = msg.content.match(/(?:we decided to|we will use|implementing|using|preference is for)\s+([^.\n]+)/i);
    if (decisionMatches && decisionMatches[1]) {
      decisions.push(decisionMatches[1].trim());
    }

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
    decisionsSection = decisions.map(d => `- Decided to use/do: ${d}`).join('\n');
  } else {
    decisionsSection = '- Kept technical setup focused on default parameters.\n- No explicitly stated decisions found.';
  }

  // 4. Identify Next Steps (Compressed last message)
  let nextStep = 'Continue the conversation where it left off.';
  if (messages.length > 1) {
    const lastMsg = messages[messages.length - 1];
    nextStep = compressMessageText(lastMsg.content.trim());
  }

  // 5. User Preferences & Tech Stack
  let techStackString = technologies.size > 0 
    ? Array.from(technologies).join(', ') 
    : 'Not explicitly specified.';

  // 6. Build Code Block Section
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

#### 2. Progress
- ${progress}
- Key Tech Detected: ${techStackString}

#### 3. Important Decisions
${decisionsSection}

#### 4. Next Step / Current Status
\`\`\`text
${nextStep}
\`\`\`

#### 5. User Context & Preferences
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
