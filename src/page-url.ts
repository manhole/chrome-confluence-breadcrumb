// Matches view URLs (/wiki/spaces/KEY/pages/123/Title, slug optional).
// Edit URLs (/wiki/spaces/KEY/pages/edit-v2/123) deliberately don't match:
// no breadcrumb is shown while editing.
const PAGE_PATH_RE = /\/wiki\/spaces\/[^/]+\/pages\/(\d+)(?:\/|$)/;

export function extractPageId(url: string): string | null {
  const parsed = new URL(url);

  const match = PAGE_PATH_RE.exec(parsed.pathname);
  if (match) {
    return match[1];
  }

  // Legacy URL: /wiki/pages/viewpage.action?pageId=123
  if (parsed.pathname.endsWith("/pages/viewpage.action")) {
    const pageId = parsed.searchParams.get("pageId");
    if (pageId !== null && /^\d+$/.test(pageId)) {
      return pageId;
    }
  }

  return null;
}
