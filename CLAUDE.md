# chrome-confluence-breadcrumb

A Chrome extension that displays the page hierarchy (breadcrumb) at the top of Confluence pages.

## Target environment

- Confluence Cloud only (`*.atlassian.net`). Server / Data Center are out of scope.
- Chrome (Manifest V3).

## Technical decisions

- Implemented in TypeScript; distribution artifacts are produced by a build step.
- Bundler: esbuild, driven by `build.mjs`. Type checking is done separately with `tsc --noEmit`.
- The version number lives only in `public/manifest.json`. `package.json` deliberately
  has no `version` field (allowed for private packages) — do not add one.
- Licensed under MIT (see LICENSE).

## Distribution

- Not published to the Chrome Web Store. Users clone the repository and load the
  `dist/` directory as an unpacked extension via `chrome://extensions`.
- Therefore `dist/` is committed to git. Whenever `src/` or `public/` changes,
  run `npm run build` and include the updated `dist/` in the same commit.

## Project structure

- `src/` — TypeScript sources (entry point: `src/content.ts`).
- `public/` — static files copied verbatim into `dist/` (e.g. `manifest.json`).
- `dist/` — build output, committed to git (see Distribution).

## Commands

- `npm run build` — build the extension into `dist/`.
- `npm run watch` — rebuild on source changes (note: changes to `public/` require a re-run).
- `npm run typecheck` — type-check with `tsc --noEmit`.

## Documentation style

- Documentation is written in English. Each document has a Japanese counterpart
  with the `.ja` suffix (e.g. `CLAUDE.ja.md`); keep both in sync when editing.
- Commit messages follow the Conventional Commits format (`feat:`, `fix:`, `chore:`, etc.).
