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

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  if (!currentEnabledState) {
    console.log('Extension is disabled, ignoring command');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error("No active tab found");
      return;
    }

    if (command === "trigger_popup") {
      console.log('Triggering popup for tab:', tab.id);
      
      let selectedText;
      
      // Try getting selected text from content script first
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getSelectedText" });
        selectedText = response?.selectedText;
      } catch (contentScriptError) {
        console.log('Content script not ready, trying executeScript');
        // Fall back to executeScript if content script isn't ready
        try {
          const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString().trim()
          });
          selectedText = result.result;
        } catch (executeError) {
          console.error('Failed to get selected text:', executeError);
          // Show error to user
          chrome.tabs.sendMessage(tab.id, {
            action: "showPopup",
            error: "Could not access selected text. Please try again."
          }).catch(console.error);
          return;
        }
      }

      if (!selectedText) {
        console.log("No text selected");
        chrome.tabs.sendMessage(tab.id, {
          action: "showPopup",
          error: "Please select some text first."
        }).catch(console.error);
        return;
      }

      try {
        await processSelection(selectedText, tab.id);
      } catch (processError) {
        console.error("Error processing selection:", processError);
        chrome.tabs.sendMessage(tab.id, {
          action: "showPopup",
          error: "Could not process the selected text. Please try a different selection."
        }).catch(console.error);
      }
    } else if (command === "stop_speaking") {
      chrome.tabs.sendMessage(tab.id, { action: "stopSpeaking" })
        .catch(error => console.error("Error stopping speech:", error));
    }
  } catch (error) {
    console.error("Error handling command:", command, error);
  }
});

async function fetchTranslationAndMeaning(text) {
    // This is a placeholder - implement your actual translation and meaning lookup logic here
    // You might want to call your translation API or dictionary service
    return {
        synonyms: ["Loading..."],
        example: "Loading example...",
        hindi: "अनुवाद लोड हो रहा है..." // "Translation is loading..." in Hindi
    };
}

// This function is injected into the page to get the selected text
function getSelectedTextFromPage() {
  return window.getSelection().toString().trim();
}

async function processSelection(selectedText, tabId) {
  if (!selectedText) {
    chrome.tabs.sendMessage(tabId, {
      action: "showPopup",
      error: "Please select some text first."
    });
    return;
  }

  const cleanedText = selectedText.trim();
  console.log("Processing selection:", cleanedText);

  try {
    // Start translation immediately
    const translationPromise = translateToHindi(cleanedText);

    // Check if we should try dictionary lookup
    const isDictionaryWord = cleanedText.split(/\s+/).length === 1 && /^[a-zA-Z]+$/.test(cleanedText);
    let dictData = null;

    if (isDictionaryWord) {
      try {
        console.log("Fetching dictionary data for:", cleanedText);
        const response = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanedText.toLowerCase())}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data?.[0]?.meanings?.[0]) {
            dictData = data[0];
          }
        } else if (response.status === 404) {
          console.log("Word not found in dictionary");
        } else {
          console.error("Dictionary API error:", response.status);
        }
      } catch (dictError) {
        console.error("Dictionary API error:", dictError);
      }
    }

    // Wait for translation
    const translation = await translationPromise;
    
    if (!translation || translation === "Translation unavailable") {
      throw new Error("Translation service unavailable");
    }

    // Prepare popup data
    const popupData = {
      word: cleanedText,
      hindi: translation,
      synonyms: ["No synonyms available"],
      example: "No example available"
    };

    if (dictData?.meanings?.[0]) {
      const meaning = dictData.meanings[0];
      if (meaning.synonyms?.length > 0) {
        popupData.synonyms = meaning.synonyms.slice(0, 3);
      }
      if (meaning.definitions?.[0]?.example) {
        popupData.example = meaning.definitions[0].example;
      }
    }

    // Send data to content script
    await chrome.tabs.sendMessage(tabId, {
      action: "showPopup",
      data: popupData
    });

    // Prepare speech text
    const speechText = `${cleanedText}. In Hindi: ${translation}.${
      popupData.synonyms.length > 0 && popupData.synonyms[0] !== "No synonyms available"
        ? ` Synonyms: ${popupData.synonyms.join(", ")}.`
        : ""
    }${
      popupData.example !== "No example available"
        ? ` Example: ${popupData.example}`
        : ""
    }`;

    const speech = new SpeechSynthesisUtterance(speechText);
    speech.lang = "en-US";
    window.speechSynthesis.speak(speech);

  } catch (error) {
    console.error("Error processing selection:", error);
    let errorMessage = "An unexpected error occurred.";

    if (error.message.includes("Translation service unavailable")) {
      errorMessage = "Translation service is currently unavailable. Please try again later.";
    } else if (error.name === "TypeError" || error.name === "NetworkError") {
      errorMessage = "Network error. Please check your internet connection.";
    }

    chrome.tabs.sendMessage(tabId, {
      action: "showPopup",
      error: errorMessage
    });
  }
}

// Update translateToHindi function for better error handling
async function translateToHindi(text) {
  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "en",
      tl: "hi",
      dt: "t",
      q: text
    });

    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?${params.toString()}`
    );

    if (!res.ok) {
      throw new Error(`Translation API error: ${res.status}`);
    }

    const data = await res.json();
    if (!data?.[0]?.[0]?.[0]) {
      throw new Error("Invalid translation response format");
    }

    return data[0][0][0];
  } catch (err) {
    console.error("Translation error:", err);
    return "Translation unavailable";
  }
}

async function handleTranslationOnly(text, tabId) {
  try {
    const hindiTranslation = await translateToHindi(text);
    
    // Send data to content script to show popup
    chrome.tabs.sendMessage(tabId, {
      action: "showPopup",
      data: {
        word: text,
        synonyms: ["Translation only"],
        example: "This is a phrase or word not found in dictionary",
        hindi: hindiTranslation,
      }
    }).catch(err => console.warn("Failed to send message to tab:", tabId, err));

    // Read the text and translation
    const speechText = `${text}. In Hindi: ${hindiTranslation}.`;
    const speech = new SpeechSynthesisUtterance(speechText);
    speech.lang = 'en-US';
    window.speechSynthesis.speak(speech);

  } catch (error) {
    console.error("Error in handleTranslationOnly:", error);
    chrome.tabs.sendMessage(tabId, { 
      action: "showPopup", 
      error: "Could not translate the text." 
    }).catch(err => console.warn("Failed to send error message to tab:", tabId, err));
  }
}
