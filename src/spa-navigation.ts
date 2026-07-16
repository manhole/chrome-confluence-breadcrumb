// Confluence Cloud is a React SPA; page navigations usually happen via the
// History API without a full reload. The Navigation API's currententrychange
// event covers pushState/replaceState/traversal/hash changes in one place.
// Chrome-only extension, so the Chrome 102+ requirement is fine.
export function onUrlChange(callback: (url: string) => void): void {
  let lastUrl = location.href;

  window.navigation?.addEventListener("currententrychange", () => {
    if (location.href === lastUrl) {
      return;
    }
    lastUrl = location.href;
    callback(lastUrl);
  });

  callback(lastUrl);
}
