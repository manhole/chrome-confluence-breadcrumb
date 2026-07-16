import { renderBreadcrumb, removeBreadcrumb } from "./breadcrumb-ui";
import { fetchBreadcrumbData } from "./confluence-api";
import { extractPageId } from "./page-url";
import { onUrlChange } from "./spa-navigation";

let currentPageId: string | null = null;
let controller: AbortController | null = null;

async function update(pageId: string, signal: AbortSignal): Promise<void> {
  try {
    const items = await fetchBreadcrumbData(pageId, signal);
    if (signal.aborted || pageId !== currentPageId) {
      return;
    }
    await renderBreadcrumb(items, signal);
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

  controller?.abort();
  controller = new AbortController();

  if (pageId === null) {
    removeBreadcrumb();
    return;
  }
  void update(pageId, controller.signal);
});
