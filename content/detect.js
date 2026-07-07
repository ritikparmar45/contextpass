/**
 * Context Passport - Website Detection Script
 * Detects whether the user is on ChatGPT or Claude and prints to the console.
 */

(function () {
  const hostname = window.location.hostname;

  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    console.log('ChatGPT Detected');
  } else if (hostname.includes('claude.ai')) {
    console.log('Claude Detected');
  }
})();
