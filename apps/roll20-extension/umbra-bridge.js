const REQUEST_EVENT = "umbra:roll20-request";
const PING_EVENT = "umbra:roll20-ping";
const RESPONSE_EVENT = "umbra:roll20-response";

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

window.addEventListener(REQUEST_EVENT, (event) => {
  const detail = event.detail || {};
  chrome.runtime.sendMessage(
    {
      type: "UMBRA_ROLL20_SEND",
      text: detail.text,
      request: detail.request
    },
    (response) => {
      if (chrome.runtime.lastError) {
        dispatchResponse(detail.requestId, {
          bridgeAvailable: true,
          hasRoll20Tab: false,
          mode: "error",
          message: chrome.runtime.lastError.message || "No se pudo enviar la tirada a Roll20."
        });
        return;
      }

      dispatchResponse(detail.requestId, response || {
        bridgeAvailable: true,
        hasRoll20Tab: false,
        mode: "error",
        message: "Roll20 no devolvió respuesta."
      });
    }
  );
});

window.addEventListener(PING_EVENT, (event) => {
  const detail = event.detail || {};
  chrome.runtime.sendMessage({ type: "UMBRA_ROLL20_PING" }, (response) => {
    if (chrome.runtime.lastError) {
      dispatchResponse(detail.requestId, {
        bridgeAvailable: true,
        hasRoll20Tab: false,
        mode: "error",
        message: chrome.runtime.lastError.message || "No se pudo comprobar Roll20."
      });
      return;
    }

    dispatchResponse(detail.requestId, response || {
      bridgeAvailable: true,
      hasRoll20Tab: false,
      mode: "error",
      message: "Roll20 no devolvió respuesta."
    });
  });
});
