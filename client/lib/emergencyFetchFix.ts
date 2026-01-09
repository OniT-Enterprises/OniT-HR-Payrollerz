/**
 * Emergency fetch cleanup - completely removes all fetch overrides
 * This fixes "Failed to fetch" errors by ensuring native fetch is restored
 */

let originalFetch: typeof fetch | null = null;

export const emergencyRestoreFetch = () => {
  if (typeof window === "undefined") return;

  console.log("🚨 EMERGENCY: Completely restoring native fetch function");

  // Method 1: Restore from our stored original
  if ((window as any).__originalFetch) {
    console.log("📦 Restoring from __originalFetch");
    window.fetch = (window as any).__originalFetch;
    delete (window as any).__originalFetch;
  }

  // Method 2: Get fresh fetch from iframe (more aggressive)
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    if (iframe.contentWindow && iframe.contentWindow.fetch) {
      console.log("🔄 Restoring fetch from clean iframe");
      window.fetch = iframe.contentWindow.fetch.bind(window);
    }

    document.body.removeChild(iframe);
  } catch (error) {
    console.warn("Could not restore fetch from iframe:", error);
  }

  // Method 3: Force remove any custom properties
  const customProps = [
    "__originalFetch",
    "__originalXMLHttpRequest",
    "__originalFirebaseMethods",
  ];
  customProps.forEach((prop) => {
    if ((window as any)[prop]) {
      console.log(`🧹 Cleaning up ${prop}`);
      delete (window as any)[prop];
    }
  });

  // Method 4: Verify fetch is now clean
  const fetchString = window.fetch.toString();
  const isNative = fetchString.includes("[native code]");
  const isCustom =
    fetchString.includes("Firebase") ||
    fetchString.includes("blocked") ||
    fetchString.includes("isolation");

  console.log("✅ Fetch cleanup complete:");
  console.log("  - Is native:", isNative);
  console.log("  - Is custom:", isCustom);
  console.log("  - Length:", fetchString.length);

  if (isCustom) {
    console.error("⚠️ Fetch still appears to be overridden!");
  } else {
    console.log("✅ Fetch successfully restored to native implementation");
  }
};

export const forceDisableAllFirebaseBlocking = () => {
  if (typeof window === "undefined") return;

  console.log("🚫 FORCE: Disabling all Firebase blocking mechanisms");

  // Remove any Firebase isolation flags
  (window as any).firebaseIsolated = false;
  (window as any).firebaseBlocked = false;

  // Restore fetch
  emergencyRestoreFetch();

  // Restore XMLHttpRequest if needed
  if ((window as any).__originalXMLHttpRequest) {
    window.XMLHttpRequest = (window as any).__originalXMLHttpRequest;
    delete (window as any).__originalXMLHttpRequest;
  }

  // Clear any console.error overrides that might hide errors
  if ((window as any).__originalConsoleError) {
    console.error = (window as any).__originalConsoleError;
    delete (window as any).__originalConsoleError;
  }

  console.log("✅ All Firebase blocking mechanisms disabled");
};

// Auto-run on module load
if (typeof window !== "undefined") {
  // Run immediately
  forceDisableAllFirebaseBlocking();

  // Also run after a delay to catch late overrides
  setTimeout(() => {
    console.log("🔄 Running delayed fetch cleanup...");
    forceDisableAllFirebaseBlocking();
  }, 500);

  // Run when page is fully loaded
  document.addEventListener("DOMContentLoaded", () => {
    console.log("📄 Running DOMContentLoaded fetch cleanup...");
    forceDisableAllFirebaseBlocking();
  });
}

console.log("🚨 Emergency fetch fix module loaded");
