const INPUT_SELECTORS = [
  "#textchat-input textarea",
  "#textchat-input [contenteditable='true']",
  "textarea[placeholder*='chat' i]",
  "textarea",
  "[contenteditable='true'][role='textbox']"
];

const SEND_SELECTORS = [
  "#textchat-input button[type='submit']",
  "#textchat-input .btn",
  "button[aria-label*='send' i]"
];

function findFirst(selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node) {
      return node;
    }
  }
  return null;
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
  const sendButton = findFirst(SEND_SELECTORS);
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
  if (message?.type !== "ROLL20_INSERT_TEXT") {
    return false;
  }

  const inputNode = findFirst(INPUT_SELECTORS);
  if (!inputNode) {
    sendResponse({
      mode: "error",
      message: "No se encontró el chat de Roll20 en la página actual."
    });
    return false;
  }

  const inserted = setInputValue(inputNode, message.text || "");
  if (!inserted) {
    sendResponse({
      mode: "error",
      message: "No se pudo escribir en el chat de Roll20."
    });
    return false;
  }

  if (message.send) {
    const sent = sendCurrentInput(inputNode);
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
