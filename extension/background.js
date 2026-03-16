// WebSight background service worker
// Handles extension install events and icon state management.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[WebSight] Extension installed.');
});

// Keep service worker alive while a job is running (MV3 workaround)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ pong: true });
  }
});
