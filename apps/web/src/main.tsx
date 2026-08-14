import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./styles/modern.css";
import { initializeAppearancePreferences } from "./models/themePreference";
import { initializeCharacterSheetBackground } from "./models/characterSheetBackground";
import { ConfirmationDialogProvider } from "./components/ConfirmationDialogProvider";

initializeAppearancePreferences();
initializeCharacterSheetBackground();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfirmationDialogProvider>
      <App />
    </ConfirmationDialogProvider>
  </React.StrictMode>
);
