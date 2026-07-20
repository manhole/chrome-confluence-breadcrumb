import type { BreadcrumbItem } from "./confluence-api";

const HOST_ID = "confluence-breadcrumb-ext";
const TITLE_WAIT_TIMEOUT_MS = 8000;

// Confirmed against real Confluence Cloud markup (2026-07): the title box is
// div#title-text[data-testid="title-text"] on regular pages and
// div#editor-title-id[data-testid="editor-title-container"] on live docs.
// The breadcrumb hangs below the title box, out of flow. The space above the
// title is unusable: on regular pages it is a collapsed 72px margin overlaid
// by the floating page toolbar, and on live docs it is reserved for the
// editor's hover toolbar (絵文字/ステータス/ヘッダー画像), which would cover
// the breadcrumb. In-flow placement is also out: it would shift Confluence's
// rigidly sized header layout.
const TITLE_SELECTORS = [
  "#title-text",
  '[data-testid="title-text"]',
  "#editor-title-id",
  '[data-testid="editor-title-container"]',
];

// The --ds-* custom properties are Atlassian Design System tokens inherited
// from the page, so colors follow the user's Confluence theme (incl. dark
// mode); the literals are fallbacks for when the tokens are absent.
const STYLE = `
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

function queryTitle(): Element | null {
  for (const selector of TITLE_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) {
      return el;
    }
  }
  return null;
}

// Right after an SPA navigation React may not have rendered the title yet;
// watch the DOM until it appears or the timeout expires.
function waitForTitle(signal: AbortSignal): Promise<Element | null> {
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

function buildContent(items: BreadcrumbItem[]): DocumentFragment {
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

// On live docs the title's left edge shifts per page — a page-type/expand
// icon can indent it well past the byline (作成者) row, which stays at the
// content's left edge. Align the breadcrumb to the byline, not the title:
// measure the byline avatar's left relative to the breadcrumb's containing
// block (the title wrapper) and return it as the host's left offset. It goes
// negative when the title is indented past the byline. Regular pages and a
// not-yet-rendered byline return null, leaving the breadcrumb at the title's
// left edge.
function liveDocLeftOffsetPx(title: Element, wrapper: Element): number | null {
  const isLiveDoc =
    title.id === "editor-title-id" ||
    title.getAttribute("data-testid") === "editor-title-container";
  if (!isLiveDoc) {
    return null;
  }
  const byline = document.querySelector('[data-testid="byline-single-line"]');
  if (!byline) {
    return null;
  }
  let leaf: Element = byline;
  while (leaf.firstElementChild) {
    leaf = leaf.firstElementChild;
  }
  const offset = leaf.getBoundingClientRect().left - wrapper.getBoundingClientRect().left;
  // Sanity-check against unexpected geometry (e.g. an unrendered placeholder).
  return Math.abs(offset) < 120 ? offset : null;
}

export async function renderBreadcrumb(items: BreadcrumbItem[], signal: AbortSignal): Promise<void> {
  const title = await waitForTitle(signal);
  if (signal.aborted) {
    return;
  }
  const wrapper = title?.parentElement;
  if (!title || !wrapper) {
    // No recognizable title (e.g. an unsupported page type) — show nothing.
    removeBreadcrumb();
    return;
  }

  const existing = document.getElementById(HOST_ID);
  let host: HTMLElement;
  if (existing instanceof HTMLElement && existing.isConnected && existing.nextElementSibling === title) {
    // Already in the right place — swap the content only, to avoid flicker.
    host = existing;
  } else {
    existing?.remove();
    host = document.createElement("div");
    host.id = HOST_ID;
    host.attachShadow({ mode: "open" });
    // The wrapper is the containing block for the absolutely positioned
    // host. It is position:relative in current Confluence markup; the
    // inline style is only a safety net in case that changes.
    if (getComputedStyle(wrapper).position === "static") {
      (wrapper as HTMLElement).style.position = "relative";
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

export function removeBreadcrumb(): void {
  document.getElementById(HOST_ID)?.remove();
}
