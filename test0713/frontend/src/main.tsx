import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadFontSize, loadTheme, saveFontSize, saveTheme } from "./prefs";
import "./styles.css";

saveTheme(loadTheme());
saveFontSize(loadFontSize());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
