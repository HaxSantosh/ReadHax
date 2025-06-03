// content.js - Handles DOM manipulation on the page

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action, request);
  
  try {
    if (request.action === "showPopup") {
      if (request.error) {
        showErrorPopup(request.error);
      } else if (request.data) {
        displayReadHaxPopup(request.data.word, request.data.synonyms, request.data.example, request.data.hindi);
      }
      sendResponse({ status: "popup action taken" });
    } else if (request.action === "stopSpeaking") {
      stopSpeaking();
      sendResponse({ status: "speech stopped" });
    } else if (request.action === "getSelectedText") {
      const selectedText = window.getSelection().toString().trim();
      console.log('Selected text:', selectedText);
      sendResponse({ selectedText });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    showErrorPopup('An unexpected error occurred. Please try again.');
    sendResponse({ status: "error", error: error.message });
  }
  return true; // Keep message channel open for async response
});

function showErrorPopup(error) {
  console.log('Showing error popup:', error);
  displayReadHaxPopup(
    'Error / त्रुटि',
    ['Please try again'],
    error,
    'कृपया पुनः प्रयास करें'  // "Please try again" in Hindi
  );
}

function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function displayReadHaxPopup(word, synonyms, example, hindi) {
  try {
    console.log('Displaying popup with:', { word, synonyms, example, hindi });
    
    const existingPopup = document.getElementById("readhax-popup");
    if (existingPopup) {
      existingPopup.remove();
    }

    const popupDiv = document.createElement("div");
    popupDiv.id = "readhax-popup";
    
    // Enhanced styling for better visibility
    popupDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      background: #282c34;
      color: #abb2bf;
      padding: 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      border: 1px solid #3e4451;
    `;

    // Word and Translation
    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = `
      font-size: 16px;
      margin-bottom: 12px;
      color: #61afef;
      font-weight: bold;
    `;
    headerDiv.textContent = word;
    popupDiv.appendChild(headerDiv);

    const hindiDiv = document.createElement("div");
    hindiDiv.style.cssText = `
      font-size: 16px;
      margin-bottom: 12px;
      color: #98c379;
    `;
    hindiDiv.textContent = hindi || 'Translation not available';
    popupDiv.appendChild(hindiDiv);

    // Synonyms
    if (synonyms && synonyms.length > 0) {
      const synonymsDiv = document.createElement("div");
      synonymsDiv.style.cssText = `
        font-size: 14px;
        margin-bottom: 8px;
        color: #e5c07b;
      `;
      synonymsDiv.textContent = `Synonyms: ${synonyms.join(", ")}`;
      popupDiv.appendChild(synonymsDiv);
    }

    // Example
    if (example) {
      const exampleDiv = document.createElement("div");
      exampleDiv.style.cssText = `
        font-size: 14px;
        color: #c678dd;
        font-style: italic;
      `;
      exampleDiv.textContent = `Example: ${example}`;
      popupDiv.appendChild(exampleDiv);
    }

    // Close button
    const closeButton = document.createElement("button");
    closeButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      color: #abb2bf;
      cursor: pointer;
      font-size: 20px;
      padding: 4px;
      line-height: 1;
    `;
    closeButton.textContent = "×";
    closeButton.onclick = () => {
      popupDiv.style.opacity = "0";
      setTimeout(() => popupDiv.remove(), 300);
    };
    popupDiv.appendChild(closeButton);

    document.body.appendChild(popupDiv);

    // Trigger reflow and fade in
    setTimeout(() => {
      popupDiv.style.opacity = "1";
    }, 10);

    // Auto-hide after 8 seconds
    setTimeout(() => {
      if (popupDiv && popupDiv.parentNode) {
        popupDiv.style.opacity = "0";
        setTimeout(() => popupDiv.parentNode && popupDiv.remove(), 300);
      }
    }, 8000);

  } catch (error) {
    console.error('Error creating popup:', error);
    alert('Error displaying popup. Please check console for details.');
  }
}

// Function to handle "Show more" links on Google search pages
function handleShowMoreLinks() {
  if (window.location.hostname.includes('google.')) {
    // Find all "Show more" links
    const showMoreLinks = Array.from(document.querySelectorAll('a')).filter(link => 
      link.textContent.toLowerCase().trim() === 'show more'
    );
    
    showMoreLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Find the closest container that might be hiding content
        const container = link.closest('div[class*="g"]') || link.parentElement;
        if (container) {
          // Remove any height restrictions or overflow hiding
          container.style.maxHeight = 'none';
          container.style.overflow = 'visible';
          
          // Find any collapsed content containers
          const collapsedContent = container.querySelectorAll('[class*="clamp"],[class*="collapse"],[class*="hidden"]');
          collapsedContent.forEach(elem => {
            elem.style.maxHeight = 'none';
            elem.style.overflow = 'visible';
            elem.style.display = 'block';
          });
          
          // Hide the "Show more" link
          link.style.display = 'none';
        }
      });
    });
  }
}

// Run when page loads
document.addEventListener('DOMContentLoaded', handleShowMoreLinks);

// Also run when URL changes (for dynamic Google results)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    handleShowMoreLinks();
  }
}).observe(document, { subtree: true, childList: true });

// Handle text selection events
document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('keyup', (e) => {
  // Check if text is selected after key release
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') {
    handleTextSelection(e);
  }
});

function handleTextSelection(event) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText) {
    // Show a small indicator near the selection
    showSelectionIndicator(event, selectedText);
  }
}

function showSelectionIndicator(event, selectedText) {
  // Remove any existing indicators
  const existingIndicator = document.getElementById('readhax-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }

  // Only show indicator if extension is enabled
  chrome.storage.sync.get("enabled", (data) => {
    if (data.enabled !== false) {
      const indicator = document.createElement('div');
      indicator.id = 'readhax-indicator';
      
      // Position near the cursor/selection
      const rect = getSelectionRect();
      indicator.style.cssText = `
        position: fixed;
        z-index: 10000;
        background: #282c34;
        color: #abb2bf;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        pointer-events: none;
        transition: opacity 0.2s;
        opacity: 0.9;
      `;
      
      // Show keyboard shortcuts
      indicator.textContent = '⌨️ Ctrl+Shift+H to read • Alt+Shift+H to stop';
      
      // Position the indicator above the selection
      if (rect) {
        indicator.style.left = `${rect.left}px`;
        indicator.style.top = `${rect.top - 40}px`; // Above selection
      } else {
        // Fallback to cursor position
        indicator.style.left = `${event.clientX}px`;
        indicator.style.top = `${event.clientY - 40}px`;
      }
      
      document.body.appendChild(indicator);
      
      // Remove indicator after 2 seconds
      setTimeout(() => {
        if (indicator && indicator.parentNode) {
          indicator.style.opacity = '0';
          setTimeout(() => indicator.remove(), 200);
        }
      }, 2000);
    }
  });
}

function getSelectionRect() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return null;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return rect;
}

// Add styles for the indicator
const style = document.createElement('style');
style.textContent = `
  #readhax-indicator {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    user-select: none;
  }
`;
document.head.appendChild(style);

let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;

// Handle text selection
document.addEventListener('mouseup', (e) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        readSelectedText(selectedText);
    }
});

function readSelectedText(text) {
    if (!text) return;
    
    stopSpeaking(); // Stop any ongoing speech
    
    chrome.storage.sync.get("enabled", (data) => {
        if (data.enabled !== false) {
            currentUtterance = new SpeechSynthesisUtterance(text);
            currentUtterance.rate = 1.0;
            currentUtterance.pitch = 1.0;
            currentUtterance.volume = 1.0;
            speechSynthesis.speak(currentUtterance);
        }
    });
}

function stopSpeaking() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    if (currentUtterance) {
        currentUtterance = null;
    }
}

// The keydown listener for Ctrl+Shift+H and Alt+Shift+H is handled by chrome.commands in the service worker.
// If you had other page-specific keydown listeners, they would go here.