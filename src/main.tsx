import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { checkVersionBeforeBoot } from "./lib/versionCheck";

// Check version BEFORE mounting React.
// If version changed, this clears caches and reloads — React never mounts.
checkVersionBeforeBoot().then((shouldMount) => {
  if (shouldMount) {
    createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
});
