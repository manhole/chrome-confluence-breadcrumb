// Matches view URLs (/wiki/spaces/KEY/pages/123/Title, slug optional) and the
// new editor's edit URLs (/wiki/spaces/KEY/pages/edit-v2/123). The page id is
// the same in both, and in the editor the title box is #editor-title-id — the
// same element the breadcrumb already hangs from on live docs — so it renders
// while editing too. Switching between view and edit is an SPA navigation
// (no full document load); content.ts re-renders using the shared id when
// the URL changes but the id doesn't, since Confluence rebuilds the title
// element in the process and wipes any breadcrumb hanging off it.
const PAGE_PATH_RE = /\/wiki\/spaces\/[^/]+\/pages\/(?:edit-v2\/)?(\d+)(?:\/|$)/;

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
