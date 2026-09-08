import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initNative, isNative } from "./lib/native-bridge";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);

// Initialize native features (Capacitor) — only runs on iOS/Android
if (isNative()) {
  initNative().catch((e) => console.warn("Native init failed:", e));
} else {
  // PWA service worker — only for web, feature-detected, fails gracefully in iframe preview
  if ("serviceWorker" in navigator && window.self === window.top) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}
