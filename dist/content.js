"use strict";
(() => {
  // src/breadcrumb-ui.ts
  var HOST_ID = "confluence-breadcrumb-ext";
  var TITLE_WAIT_TIMEOUT_MS = 8e3;
  var TITLE_SELECTORS = [
    "#title-text",
    '[data-testid="title-text"]',
    "#editor-title-id",
    '[data-testid="editor-title-container"]'
  ];
  var STYLE = `
:host {
  display: block;
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
}
nav {
  font-size: 12px;
  line-height: 1.5;
  color: var(--ds-text-subtle, #626f86);
}
ol {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  margin: 0;
  padding: 0;
}
li + li::before {
  content: "\\203a";
  margin: 0 6px;
}
a {
  color: inherit;
  text-decoration: none;
}
a:hover {
  color: var(--ds-link, #0c66e4);
  text-decoration: underline;
}
`;
  function queryTitle() {
    for (const selector of TITLE_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) {
        return el;
      }
    }
    return null;
  }
  function waitForTitle(signal) {
    const immediate = queryTitle();
    if (immediate || signal.aborted) {
      return Promise.resolve(immediate);
    }
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const found = queryTitle();
        if (found) {
          cleanup();
          resolve(found);
        }
      });
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, TITLE_WAIT_TIMEOUT_MS);
      const onAbort = () => {
        cleanup();
        resolve(null);
      };
      const cleanup = () => {
        observer.disconnect();
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
      };
      signal.addEventListener("abort", onAbort);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  function buildContent(items) {
    const fragment = document.createDocumentFragment();
    const style = document.createElement("style");
    style.textContent = STYLE;
    fragment.append(style);
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Full page hierarchy");
    const ol = document.createElement("ol");
    items.forEach((item, index) => {
      const li = document.createElement("li");
      if (index === items.length - 1) {
        li.setAttribute("aria-current", "page");
      }
      if (item.href) {
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = item.title;
        li.append(a);
      } else {
        li.textContent = item.title;
      }
      ol.append(li);
    });
    nav.append(ol);
    fragment.append(nav);
    return fragment;
  }
  function liveDocLeftOffsetPx(title, wrapper) {
    const isLiveDoc = title.id === "editor-title-id" || title.getAttribute("data-testid") === "editor-title-container";
    if (!isLiveDoc) {
      return null;
    }
    const byline = document.querySelector('[data-testid="byline-single-line"]');
    if (!byline) {
      return null;
    }
    let leaf = byline;
    while (leaf.firstElementChild) {
      leaf = leaf.firstElementChild;
    }
    const offset = leaf.getBoundingClientRect().left - wrapper.getBoundingClientRect().left;
    return Math.abs(offset) < 120 ? offset : null;
  }
  async function renderBreadcrumb(items, signal) {
    const title = await waitForTitle(signal);
    if (signal.aborted) {
      return;
    }
    const wrapper = title?.parentElement;
    if (!title || !wrapper) {
      removeBreadcrumb();
      return;
    }
    const existing = document.getElementById(HOST_ID);
    let host;
    if (existing instanceof HTMLElement && existing.isConnected && existing.nextElementSibling === title) {
      host = existing;
    } else {
      existing?.remove();
      host = document.createElement("div");
      host.id = HOST_ID;
      host.attachShadow({ mode: "open" });
      if (getComputedStyle(wrapper).position === "static") {
        wrapper.style.position = "relative";
      }
      title.insertAdjacentElement("beforebegin", host);
    }
    const offset = liveDocLeftOffsetPx(title, wrapper);
    if (offset !== null) {
      host.style.left = `${offset}px`;
    } else {
      host.style.removeProperty("left");
    }
    host.shadowRoot?.replaceChildren(buildContent(items));
  }
  function removeBreadcrumb() {
    document.getElementById(HOST_ID)?.remove();
  }

  // src/confluence-api.ts
  var LIMIT = 250;
  var NON_PAGE_RESOURCES = {
    folder: "folders",
    whiteboard: "whiteboards",
    database: "databases",
    embed: "embeds"
  };
  async function fetchJson(path, signal) {
    const res = await fetch(path, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`GET ${path} responded ${res.status}`);
    }
    return await res.json();
  }
  function toWikiHref(webui) {
    return webui.startsWith("/wiki/") ? webui : `/wiki${webui}`;
  }
  async function fetchNonPageAncestor(ancestor, signal) {
    const resource = NON_PAGE_RESOURCES[ancestor.type];
    if (resource === void 0) {
      return null;
    }
    try {
      const entity = await fetchJson(`/wiki/api/v2/${resource}/${ancestor.id}`, signal);
      const webui = entity._links?.webui;
      return [ancestor.id, { title: entity.title, href: webui ? toWikiHref(webui) : null }];
    } catch {
      return null;
    }
  }
  async function fetchBreadcrumbData(pageId, signal) {
    const [page, ancestorsResult] = await Promise.all([
      fetchJson(`/wiki/api/v2/pages/${pageId}`, signal),
      fetchJson(`/wiki/api/v2/pages/${pageId}/ancestors?limit=${LIMIT}`, signal)
    ]);
    const ancestors = ancestorsResult.results;
    const pageAncestorIds = ancestors.filter((a) => a.type === "page").map((a) => a.id);
    const nonPageAncestors = ancestors.filter(
      (a) => a.type !== "page"
    );
    const [space, pageBulk, nonPageEntries] = await Promise.all([
      fetchJson(`/wiki/api/v2/spaces/${page.spaceId}`, signal),
      pageAncestorIds.length > 0 ? fetchJson(
        `/wiki/api/v2/pages?id=${pageAncestorIds.join(",")}&limit=${LIMIT}`,
        signal
      ) : Promise.resolve({ results: [] }),
      Promise.all(nonPageAncestors.map((a) => fetchNonPageAncestor(a, signal)))
    ]);
    const itemById = /* @__PURE__ */ new Map();
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
      ...ancestors.map((a) => itemById.get(a.id) ?? { title: "\u2026", href: null }),
      { title: page.title, href: null }
    ];
  }

  // src/page-url.ts
  var PAGE_PATH_RE = /\/wiki\/spaces\/[^/]+\/pages\/(\d+)(?:\/|$)/;
  function extractPageId(url) {
    const parsed = new URL(url);
    const match = PAGE_PATH_RE.exec(parsed.pathname);
    if (match) {
      return match[1];
    }
    if (parsed.pathname.endsWith("/pages/viewpage.action")) {
      const pageId = parsed.searchParams.get("pageId");
      if (pageId !== null && /^\d+$/.test(pageId)) {
        return pageId;
      }
    }
    return null;
  }

  // src/spa-navigation.ts
  function onUrlChange(callback) {
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

  // src/content.ts
  var currentPageId = null;
  var controller = null;
  async function update(pageId, signal) {
    try {
      const items = await fetchBreadcrumbData(pageId, signal);
      if (signal.aborted || pageId !== currentPageId) {
        return;
      }
      await renderBreadcrumb(items, signal);
    } catch (err) {
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
})();
