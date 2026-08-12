import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./styles/modern.css";
import { initializeAppearancePreferences } from "./models/themePreference";
import { initializeCharacterSheetBackground } from "./models/characterSheetBackground";

initializeAppearancePreferences();
initializeCharacterSheetBackground();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
