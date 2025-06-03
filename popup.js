document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggleSpeech');
  const statusText = document.getElementById('statusText');

  if (toggle) {
    // Initialize toggle state from storage
    chrome.storage.sync.get("enabled", (data) => {      const isEnabled = data.enabled !== undefined ? data.enabled : true;
      toggle.checked = isEnabled;
      if (statusText) statusText.textContent = isEnabled ? "I'm Enabled" : "I'm Disabled";
    });

    // Listen for changes to the toggle
    toggle.addEventListener("change", () => {
      const newEnabledState = toggle.checked;
      chrome.storage.sync.set({ enabled: newEnabledState }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error setting 'enabled' state:", chrome.runtime.lastError);
        } else {          if (statusText) statusText.textContent = newEnabledState ? "I'm Enabled" : "I'm Disabled";
        }
      });
    });
  }

  // Update UI if storage changes while popup is open
  chrome.storage.onChanged.addListener((changes, namespace) => {    if (namespace === 'sync' && changes.enabled && toggle && statusText) {
      toggle.checked = changes.enabled.newValue;
      statusText.textContent = changes.enabled.newValue ? "I'm Enabled" : "I'm Disabled";
    }
  });
});