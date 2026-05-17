import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RightDashboard } from "./RightDashboard";
import { onExtensionMessage } from "../../../utils/vscodeBridge";

console.log("[RightDashboard] ENTRY LOADED - START");

const rootEl = document.getElementById("root");
console.log("[RightDashboard] root element:", rootEl);

if (!rootEl) {
  console.error("[RightDashboard] Root element NOT found!");
  document.body.innerHTML = "<h1>❌ root div not found</h1>";
  throw new Error("Root element not found");
}

/**
 * App wrapper to manage RightDashboard props
 * Listens for updates from the extension and passes them to RightDashboard
 */
function AppWrapper() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [themeKind, setThemeKind] = useState<number>(1); // 1 = Light, 2 = Dark, 3 = High Contrast

  useEffect(() => {
    // Listen for feature changes from extension
    const unsubscribeFeature = onExtensionMessage("switchFeature", (payload: any) => {
      if (payload?.feature) {
        console.log("[RightDashboard] Feature changed to:", payload.feature);
        setActiveFeature(payload.feature);
      }
    });

    // Listen for theme changes from extension
    const unsubscribeTheme = onExtensionMessage("theme", (payload: any) => {
      if (typeof payload?.kind === "number") {
        console.log("[RightDashboard] Theme changed to:", payload.kind);
        setThemeKind(payload.kind);
      }
    });

    return () => {
      unsubscribeFeature?.();
      unsubscribeTheme?.();
    };
  }, []);

  return (
    <RightDashboard
      activeFeature={activeFeature}
      themeKind={themeKind}
      onClose={() => setActiveFeature(null)}
    />
  );
}

console.log("[RightDashboard] Creating React root...");
const root = createRoot(rootEl);

console.log("[RightDashboard] Rendering RightDashboard AppWrapper...");
root.render(<AppWrapper />);

console.log("[RightDashboard] ENTRY LOADED - COMPLETE");
