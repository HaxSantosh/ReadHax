// content.js - Handles DOM manipulation on the page

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showPopup") {
    if (request.error) {
      showErrorPopup(request.error);
    } else if (request.data) {
      displayReadHaxPopup(request.data.word, request.data.synonyms, request.data.example, request.data.hindi);
    }
    sendResponse({ status: "popup action taken" });
  }
  return true; // Keep message channel open for async response
});

function displayReadHaxPopup(word, synonyms, example, hindi) {
  const existingPopup = document.getElementById("readhax-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  const popupDiv = document.createElement("div");
  popupDiv.id = "readhax-popup";
  popupDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 280px; /* Slightly wider for better layout */
    background: #282c34; /* Darker, modern background */
    color: #abb2bf; /* Softer text color */
    padding: 20px;
    border-radius: 12px;
    z-index: 2147483647; /* Ensure it's on top */
    font-size: 14px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; /* Modern font stack */
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    animation: fadeInReadHax 0.3s ease-out;
    line-height: 1.7;
  `;

  // Add keyframes for animation if not already present
  if (!document.getElementById('readhax-fadein-style')) {
    const style = document.createElement('style');
    style.id = 'readhax-fadein-style';
    style.innerHTML = `
      @keyframes fadeInReadHax {
        from { opacity: 0; transform: translateY(15px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  popupDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <b style="font-size: 17px; color: #61afef;">ReadHax Info</b>
      <button id="closeReadHaxPopup" style="background:transparent; color:#abb2bf; border:none; font-size:22px; cursor:pointer; padding:0 5px; line-height: 1;">&times;</button>
    </div>
    <div style="margin-bottom: 10px;">
      <strong style="color: #e5c07b;">Word:</strong> <span style="color: #dcdfe4;">${word}</span>
    </div>
    <div style="margin-bottom: 10px;">
      <strong style="color: #e5c07b;">Hindi:</strong> <span style="color: #dcdfe4;">${hindi}</span>
    </div>
    <div style="margin-bottom: 10px;">
      <strong style="color: #e5c07b;">Synonyms:</strong> <span style="color: #dcdfe4;">${synonyms.join(", ")}</span>
    </div>
    <div>
      <strong style="color: #e5c07b;">Example:</strong> <em style="color: #dcdfe4; font-style: italic;">${example}</em>
    </div>
  `;

  document.body.appendChild(popupDiv);

  const closeButton = document.getElementById("closeReadHaxPopup");
  if (closeButton) {
    closeButton.onclick = () => popupDiv.remove();
  }
}

function showErrorPopup(errorMessage) {
    // Similar to displayReadHaxPopup, but styled for errors
    const existingPopup = document.getElementById("readhax-popup");
    if (existingPopup) existingPopup.remove();

    const div = document.createElement("div");
    div.id = "readhax-popup"; // Can reuse ID or use a specific error ID
    div.style.cssText = `position: fixed; bottom: 20px; right: 20px; width: 250px; background: #5c2323; color: white; padding: 15px; border-radius: 10px; z-index: 9999; font-size: 14px; font-family: sans-serif; box-shadow: 0 0 10px #000; animation: fadeInReadHax 0.3s ease-in-out;`;
    div.innerHTML = `
        <div style="text-align:right;">
            <button id="closeReadHaxError" style="background:transparent;color:white;border:none;font-size:16px;cursor:pointer;">×</button>
        </div>
        <b>Error</b><br><br>${errorMessage}`;
    document.body.appendChild(div);
    document.getElementById("closeReadHaxError").onclick = () => div.remove();
}

// The keydown listener for Ctrl+Shift+H and Alt+Shift+H is handled by chrome.commands in the service worker.
// If you had other page-specific keydown listeners, they would go here.