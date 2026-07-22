import { renderBreadcrumb, removeBreadcrumb } from "./breadcrumb-ui";
import { fetchBreadcrumbData, type BreadcrumbItem } from "./confluence-api";
import { extractPageId } from "./page-url";
import { onUrlChange } from "./spa-navigation";

let currentPageId: string | null = null;
let currentItems: BreadcrumbItem[] | null = null;
let controller: AbortController | null = null;
let hostObserver: MutationObserver | null = null;

// Re-render the breadcrumb when external code (e.g. React rebuilding the
// title area during a view↔edit transition) removes the host from the DOM.
function watchForHostRemoval(): void {
  hostObserver?.disconnect();
  hostObserver = new MutationObserver(() => {
    if (currentPageId === null || currentItems === null || controller === null || controller.signal.aborted) {
      return;
    }
    if (!document.getElementById("confluence-breadcrumb-ext")) {
      hostObserver!.disconnect();
      void renderBreadcrumb(currentItems, controller.signal).then(() => {
        if (document.getElementById("confluence-breadcrumb-ext")) {
          watchForHostRemoval();
        }
      });
    }
  });
  hostObserver.observe(document.body, { childList: true, subtree: true });
}

async function update(pageId: string, signal: AbortSignal): Promise<void> {
  try {
    const items = await fetchBreadcrumbData(pageId, signal);
    if (signal.aborted || pageId !== currentPageId) {
      return;
    }
    currentItems = items;
    await renderBreadcrumb(items, signal);
    if (!signal.aborted) {
      watchForHostRemoval();
    }
  } catch (err) {
    // Includes 404s for missing/forbidden pages — stay silent in the UI.
    if (!signal.aborted) {
      console.debug("[confluence-breadcrumb] failed to build breadcrumb:", err);
    }
  }
}

onUrlChange((url) => {
  const pageId = extractPageId(url);
  if (pageId === currentPageId) {
    return;
  }
  currentPageId = pageId;
  currentItems = null;

  hostObserver?.disconnect();
  controller?.abort();
  controller = new AbortController();

  if (pageId === null) {
    removeBreadcrumb();
    return;
  }
  void update(pageId, controller.signal);
});
