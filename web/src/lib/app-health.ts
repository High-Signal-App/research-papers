declare global {
  interface Window {
    appHealth?: { track(name: string): void; flush?(): Promise<void> };
  }
}

export function trackAppHealth(name: string): void {
  if (typeof window === "undefined" || typeof window.appHealth?.track !== "function") return;
  window.appHealth.track(name);
  // Start a keepalive request before outbound link navigation unloads the page.
  void window.appHealth.flush?.();
}
