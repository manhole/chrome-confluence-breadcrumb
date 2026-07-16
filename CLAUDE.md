# chrome-confluence-breadcrumb

A Chrome extension that displays the page hierarchy (breadcrumb) at the top of Confluence pages.

## Target environment

- Confluence Cloud only (`*.atlassian.net`). Server / Data Center are out of scope.
- Chrome (Manifest V3).

## Technical decisions

- Implemented in TypeScript; distribution artifacts are produced by a build step.
- Licensed under MIT (see LICENSE).

## Documentation style

- Documentation is written in English. Each document has a Japanese counterpart
  with the `.ja` suffix (e.g. `CLAUDE.ja.md`); keep both in sync when editing.
- Commit messages follow the Conventional Commits format (`feat:`, `fix:`, `chore:`, etc.).
