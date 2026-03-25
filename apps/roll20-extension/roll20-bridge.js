const INPUT_SELECTORS = [
  "#textchat-input textarea",
  "#textchat-input [contenteditable='true']",
  "#textchat textarea",
  "#textchat-input input[type='text']"
];

const SEND_SELECTORS = [
  "#textchat-input button[type='submit']",
  "#textchat-input .btn",
  "#textchat button[type='submit']",
  "button[aria-label*='send' i]"
];

function log(...args) {
  console.log("[UMBRA20][roll20]", ...args);
}

log("content script loaded", window.location.href);

function isVisible(node) {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function pickBestInput() {
  const candidates = INPUT_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const visible = candidates.filter(isVisible);
  log("input candidates", candidates.length, "visible", visible.length);
  if (visible.length === 0) {
    return null;
  }

  visible.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return (rightRect.bottom + rightRect.right) - (leftRect.bottom + leftRect.right);
  });

  return visible[0];
}

function pickBestSendButton(inputNode) {
  const candidates = SEND_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter(isVisible);
  log("send button candidates", candidates.length);
  if (candidates.length === 0) {
    return null;
  }

  const inputRect = inputNode instanceof HTMLElement ? inputNode.getBoundingClientRect() : null;
  if (!inputRect) {
    return candidates[0];
  }

  candidates.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    const leftDistance = Math.abs(leftRect.top - inputRect.top) + Math.abs(leftRect.left - inputRect.right);
    const rightDistance = Math.abs(rightRect.top - inputRect.top) + Math.abs(rightRect.left - inputRect.right);
    return leftDistance - rightDistance;
  });

  return candidates[0];
}

function setInputValue(node, text) {
  if (!node) {
    return false;
  }

  if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
    node.focus();
    node.value = text;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (node instanceof HTMLElement && node.isContentEditable) {
    node.focus();
    node.textContent = text;
    node.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    return true;
  }

  return false;
}

function sendCurrentInput(inputNode) {
  const sendButton = pickBestSendButton(inputNode);
  if (sendButton instanceof HTMLElement) {
    sendButton.click();
    return true;
  }

  if (inputNode instanceof HTMLElement) {
    inputNode.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true
      })
    );
    inputNode.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true
      })
    );
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  log("message received", message?.type);

  if (message?.type !== "ROLL20_INSERT_TEXT") {
    return false;
  }

  const inputNode = pickBestInput();
  if (!inputNode) {
    log("no visible chat input found");
    sendResponse({
      mode: "error",
      message: "No se encontró un campo de chat visible en Roll20."
    });
    return false;
  }

  log("using input", inputNode);
  const inserted = setInputValue(inputNode, message.text || "");
  if (!inserted) {
    log("failed to write into chat input");
    sendResponse({
      mode: "error",
      message: "No se pudo escribir en el chat de Roll20."
    });
    return false;
  }

  if (message.send) {
    const sent = sendCurrentInput(inputNode);
    log("send result", sent);
    sendResponse({
      mode: sent ? "sent" : "inserted",
      message: sent ? "Tirada enviada a Roll20." : "Texto insertado en el chat de Roll20."
    });
    return false;
  }

  sendResponse({
    mode: "inserted",
    message: "Texto insertado en el chat de Roll20."
  });
  return false;
});
