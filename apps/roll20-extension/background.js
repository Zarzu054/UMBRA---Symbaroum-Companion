const ROLL20_EDITOR_PATTERNS = [
  /^https:\/\/app\.roll20\.net\/editor\//i,
  /^https:\/\/roll20\.net\/editor\//i
];

function isRoll20EditorUrl(url) {
  return typeof url === "string" && ROLL20_EDITOR_PATTERNS.some((pattern) => pattern.test(url));
}

async function getRoll20Tabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => tab.id && isRoll20EditorUrl(tab.url));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "UMBRA_ROLL20_PING") {
    getRoll20Tabs()
      .then((tabs) => {
        sendResponse({
          ok: true,
          bridgeAvailable: true,
          hasRoll20Tab: tabs.length > 0,
          mode: tabs.length > 0 ? "inserted" : "unavailable",
          message: tabs.length > 0 ? "Pestaña de Roll20 detectada." : "No hay ninguna pestaña de Roll20 abierta."
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          bridgeAvailable: true,
          hasRoll20Tab: false,
          mode: "error",
          message: error instanceof Error ? error.message : "No se pudo comprobar Roll20."
        });
      });
    return true;
  }

  if (message?.type === "UMBRA_ROLL20_SEND") {
    getRoll20Tabs()
      .then(async (tabs) => {
        if (tabs.length === 0) {
          sendResponse({
            ok: false,
            bridgeAvailable: true,
            hasRoll20Tab: false,
            mode: "unavailable",
            message: "No hay ninguna pestaña de Roll20 abierta."
          });
          return;
        }

        const [tab] = tabs;
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: "ROLL20_INSERT_TEXT",
          text: message.text,
          send: true
        });

        sendResponse({
          ok: true,
          bridgeAvailable: true,
          hasRoll20Tab: true,
          mode: response?.mode || "inserted",
          message: response?.message || "Texto enviado a Roll20."
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          bridgeAvailable: true,
          hasRoll20Tab: false,
          mode: "error",
          message: error instanceof Error ? error.message : "No se pudo enviar la tirada a Roll20."
        });
      });

    return true;
  }

  return false;
});
