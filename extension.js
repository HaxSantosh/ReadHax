let currentEnabledState = true; // Local cache for enabled state

// Save toggle status
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ enabled: true });
  currentEnabledState = true;
  console.log("ReadHax installed and enabled state set to true.");
});

// Initialize enabled state when service worker starts
chrome.storage.sync.get("enabled", (data) => {
  if (chrome.runtime.lastError) {
    console.error("Error getting 'enabled' state from storage:", chrome.runtime.lastError.message);
    // Default to true or handle error appropriately if storage access fails
    currentEnabledState = true;
    return;
  }
  // data should be an object, e.g., {} if 'enabled' is not set,
  // or { enabled: true/false } if it is set.
  if (data && typeof data === 'object') {
    currentEnabledState = data.enabled !== undefined ? data.enabled : true;
  } else {
    console.warn("Storage.sync.get 'enabled' returned unexpected data format, defaulting to true. Data:", data);
    currentEnabledState = true;
  }
});

// Listen for storage changes to keep currentEnabledState in sync
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.enabled) {
    currentEnabledState = changes.enabled.newValue;
    console.log('Service worker "enabled" state updated to:', currentEnabledState);
  }
});

// Listener for messages (e.g., from content scripts if they were to initiate)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "stopSpeech") {
    window.speechSynthesis.cancel();
    sendResponse({ status: "speech stopped by message" });
  }
  // Add other message handlers if needed
  return true; // Indicates async response possibility
});

// Listener for commands defined in manifest.json
chrome.commands.onCommand.addListener(async (command, tab) => {
  console.log(`Command received: ${command}`);
  // Ensure 'enabled' state is fresh from storage for command execution
  const storageData = await chrome.storage.sync.get("enabled");
  currentEnabledState = storageData.enabled !== undefined ? storageData.enabled : true;

  if (!currentEnabledState && command === "trigger_popup") {
    console.log("ReadHax is disabled. Command ignored.");
    return;
  }

  if (command === "trigger_popup") { // Corresponds to "Read selected text"
    if (tab && tab.id) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: getSelectedTextFromPage,
        });
        if (results && results[0] && results[0].result) {
          const selectedText = results[0].result;
          if (selectedText) {
            await processSelection(selectedText, tab.id);
          } else {
            console.log("No text selected on the page.");
            // Optionally, send a message to content script to show a "no text selected" notification
          }
        }
      } catch (e) {
        console.error("Error executing script to get selection:", e);
        // This can happen on restricted pages (e.g., chrome:// URLs, store)
        // Inform the user if possible, or log.
         if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, {
                action: "showPopup",
                error: "Cannot access selected text on this page."
            }).catch(err => console.warn("Failed to send error to tab:", err));
        }
      }
    }
  } else if (command === "stop_speaking") {
    window.speechSynthesis.cancel();
    console.log("Speech stopped by command.");
  }
});

// This function is injected into the page to get the selected text
function getSelectedTextFromPage() {
  return window.getSelection().toString().trim();
}

async function processSelection(selectedText, tabId) {
  if (!selectedText) return;

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(selectedText)}`);
    if (!response.ok) {
      console.error("Dictionary API error:", response.status, await response.text());
      chrome.tabs.sendMessage(tabId, { action: "showPopup", error: `Definition not found for "${selectedText}".` });
      return;
    }
    const data = await response.json();

    const firstEntry = data && data[0];
    const firstMeaning = firstEntry?.meanings[0];
    const firstDefinition = firstMeaning?.definitions[0];

    const synonyms = firstDefinition?.synonyms?.slice(0, 3) || [];
    const example = firstDefinition?.example || "";

    const hindiTranslation = await translateToHindi(selectedText);

    // Send data to content script to show popup
    chrome.tabs.sendMessage(tabId, {
      action: "showPopup",
      data: {
        word: selectedText,
        synonyms: synonyms.length > 0 ? synonyms : ["No synonyms found"],
        example: example || "No example available",
        hindi: hindiTranslation,
      }
    }).catch(err => console.warn("Failed to send message to tab:", tabId, err));

    const speechText = `${selectedText}. In Hindi: ${hindiTranslation}. ${synonyms.length > 0 ? `Synonyms: ${synonyms.join(", ")}.` : ''} ${example ? `Example: ${example}` : ''}`;
    const speech = new SpeechSynthesisUtterance(speechText);
    speech.lang = 'en-US';
    window.speechSynthesis.speak(speech);

  } catch (error) {
    console.error("Error in processSelection:", error);
    chrome.tabs.sendMessage(tabId, { action: "showPopup", error: "An error occurred while fetching data." })
      .catch(err => console.warn("Failed to send error message to tab:", tabId, err));
  }
}

async function translateToHindi(text) {
  try {
    const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'hi', dt: 't', q: text });
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
    if (!res.ok) {
      console.error("Translation API error:", res.status, await res.text());
      return "Translation failed (API error)";
    }
    const data = await res.json();
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0];
    }
    return "Translation format error";
  } catch (err) {
    console.error("Error translating to Hindi:", err);
    return "Translation failed (network/script error)";
  }
}
