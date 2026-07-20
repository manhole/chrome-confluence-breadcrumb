export interface BreadcrumbItem {
  title: string;
  // Absolute path within the site (e.g. /wiki/spaces/KEY/pages/123/Title).
  // null renders as plain text (current page, or an ancestor we failed to resolve).
  href: string | null;
}

type AncestorType = "page" | "whiteboard" | "database" | "embed" | "folder";
type NonPageType = Exclude<AncestorType, "page">;

interface Ancestor {
  id: string;
  type: AncestorType;
}

interface MultiEntityResult<T> {
  results: T[];
}

interface PageBulk {
  id: string;
  title: string;
  _links: { webui: string };
}

interface PageSingle {
  title: string;
  spaceId: string;
}

interface SpaceSingle {
  name: string;
  key: string;
  // The space's home page (its "overview"). It is the top ancestor of every
  // page in the space and links to the same place as the space-name entry, so
  // showing both is redundant — we drop this one from the breadcrumb.
  homepageId?: string;
}

interface ContentEntity {
  id: string;
  title: string;
  _links?: { webui?: string };
}

// GET /pages?id=... defaults to limit=25 independently of how many ids are
// passed, so the limit must always be explicit. 250 is the documented maximum
// and also caps the ancestors depth we handle.
const LIMIT = 250;

const NON_PAGE_RESOURCES: Record<NonPageType, string> = {
  folder: "folders",
  whiteboard: "whiteboards",
  database: "databases",
  embed: "embeds",
};

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET ${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

// _links.webui is relative to the wiki context path (e.g. /spaces/KEY/pages/123).
function toWikiHref(webui: string): string {
  return webui.startsWith("/wiki/") ? webui : `/wiki${webui}`;
}

async function fetchNonPageAncestor(
  ancestor: Ancestor & { type: NonPageType },
  signal: AbortSignal,
): Promise<[id: string, item: BreadcrumbItem] | null> {
  const resource = NON_PAGE_RESOURCES[ancestor.type] as string | undefined;
  if (resource === undefined) {
    return null;
  }
  try {
    const entity = await fetchJson<ContentEntity>(`/wiki/api/v2/${resource}/${ancestor.id}`, signal);
    const webui = entity._links?.webui;
    return [ancestor.id, { title: entity.title, href: webui ? toWikiHref(webui) : null }];
  } catch {
    // A single unresolvable ancestor must not break the whole breadcrumb;
    // it falls back to the "…" placeholder in fetchBreadcrumbData.
    return null;
  }
}

export async function fetchBreadcrumbData(
  pageId: string,
  signal: AbortSignal,
): Promise<BreadcrumbItem[]> {
  const [page, ancestorsResult] = await Promise.all([
    fetchJson<PageSingle>(`/wiki/api/v2/pages/${pageId}`, signal),
    fetchJson<MultiEntityResult<Ancestor>>(`/wiki/api/v2/pages/${pageId}/ancestors?limit=${LIMIT}`, signal),
  ]);
  // The ancestors endpoint returns ids/types only, in top-to-bottom order.
  const ancestors = ancestorsResult.results;

  const pageAncestorIds = ancestors.filter((a) => a.type === "page").map((a) => a.id);
  const nonPageAncestors = ancestors.filter(
    (a): a is Ancestor & { type: NonPageType } => a.type !== "page",
  );

  const [space, pageBulk, nonPageEntries] = await Promise.all([
    fetchJson<SpaceSingle>(`/wiki/api/v2/spaces/${page.spaceId}`, signal),
    pageAncestorIds.length > 0
      ? fetchJson<MultiEntityResult<PageBulk>>(
          `/wiki/api/v2/pages?id=${pageAncestorIds.join(",")}&limit=${LIMIT}`,
          signal,
        )
      : Promise.resolve<MultiEntityResult<PageBulk>>({ results: [] }),
    Promise.all(nonPageAncestors.map((a) => fetchNonPageAncestor(a, signal))),
  ]);

  // Bulk results are not guaranteed to come back in request order.
  const itemById = new Map<string, BreadcrumbItem>();
  for (const p of pageBulk.results) {
    itemById.set(p.id, { title: p.title, href: toWikiHref(p._links.webui) });
  }
  for (const entry of nonPageEntries) {
    if (entry) {
      itemById.set(entry[0], entry[1]);
    }
  }

  return [
    { title: space.name, href: `/wiki/spaces/${encodeURIComponent(space.key)}` },
    ...ancestors
      .filter((a) => a.id !== space.homepageId)
      .map((a) => itemById.get(a.id) ?? { title: "…", href: null }),
    { title: page.title, href: null },
  ];
}
