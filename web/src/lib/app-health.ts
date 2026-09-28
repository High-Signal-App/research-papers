declare global {
  interface Window {
    appHealth?: { track(name: string): void };
  }
}

export function trackAppHealth(name: string): void {
  if (typeof window === "undefined" || typeof window.appHealth?.track !== "function") return;
  window.appHealth.track(name);
}
