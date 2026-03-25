const REQUEST_EVENT = "umbra:roll20-request";
const PING_EVENT = "umbra:roll20-ping";
const RESPONSE_EVENT = "umbra:roll20-response";

function log(...args) {
  console.log("[UMBRA20][umbra]", ...args);
}

log("content script loaded", window.location.href);

function dispatchResponse(requestId, status) {
  window.dispatchEvent(
    new CustomEvent(RESPONSE_EVENT, {
      detail: {
        requestId,
        status
      }
    })
  );
}

function runtimeErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function sendRuntimeMessage(payload, requestId, fallbackMessage) {
  try {
    log("sending runtime message", payload?.type);
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        log("runtime lastError", chrome.runtime.lastError.message);
        dispatchResponse(requestId, {
          bridgeAvailable: true,
          hasRoll20Tab: false,
          mode: "error",
          message: chrome.runtime.lastError.message || fallbackMessage
        });
        return;
      }

      log("runtime response", response);
      dispatchResponse(requestId, response || {
        bridgeAvailable: true,
        hasRoll20Tab: false,
        mode: "error",
        message: "Roll20 no devolvió respuesta."
      });
    });
  } catch (error) {
    log("runtime send threw", error);
    dispatchResponse(requestId, {
      bridgeAvailable: false,
      hasRoll20Tab: false,
      mode: "error",
      message: runtimeErrorMessage(error, fallbackMessage)
    });
  }
}

window.addEventListener(REQUEST_EVENT, (event) => {
  const detail = event.detail || {};
  log("request event", detail);
  sendRuntimeMessage(
    {
      type: "UMBRA_ROLL20_SEND",
      text: detail.text,
      request: detail.request
    },
    detail.requestId,
    "No se pudo enviar la tirada a Roll20."
  );
});

window.addEventListener(PING_EVENT, (event) => {
  const detail = event.detail || {};
  log("ping event", detail);
  sendRuntimeMessage({ type: "UMBRA_ROLL20_PING" }, detail.requestId, "No se pudo comprobar Roll20.");
});
