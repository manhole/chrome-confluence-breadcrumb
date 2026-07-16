# chrome-confluence-breadcrumb

Confluence のページ上部にページ階層 (パンくずリスト) を表示する Chrome 拡張。

## 対象環境

- Confluence Cloud のみ (`*.atlassian.net`)。Server / Data Center は対象外。
- Chrome (Manifest V3)。

## 技術方針

- TypeScript で実装し、ビルドで配布物を生成する。
- バンドラは esbuild で、`build.mjs` から実行する。型チェックは `tsc --noEmit` で別途行う。
- バージョン番号は `public/manifest.json` のみで管理する。`package.json` には意図的に
  `version` フィールドを置いていない (private パッケージでは省略可)。追加しないこと。
- ライセンスは MIT (LICENSE 参照)。

## 配布

- Chrome Web Store では公開しない。利用者はリポジトリを clone し、`chrome://extensions`
  から `dist/` を「パッケージ化されていない拡張機能」として読み込む。
- そのため `dist/` は git 管理に含める。`src/` や `public/` を変更したら
  `npm run build` を実行し、更新された `dist/` を同じコミットに含めること。

## プロジェクト構成

- `src/` — TypeScript ソース (エントリポイント: `src/content.ts`)。
- `public/` — `dist/` にそのままコピーされる静的ファイル (例: `manifest.json`)。
- `dist/` — ビルド成果物 (git 管理に含める。「配布」参照)。

## コマンド

- `npm run build` — 拡張を `dist/` にビルドする。
- `npm run watch` — ソース変更時に再ビルドする (注意: `public/` の変更は再実行が必要)。
- `npm run typecheck` — `tsc --noEmit` で型チェックする。

## 文書スタイル

- ドキュメントは英語で書く。各ドキュメントには `.ja` サフィックス付きの日本語版
  (例: `CLAUDE.ja.md`) を併設し、編集時は両方を同期させる。
- コミットメッセージは Conventional Commits 形式 (`feat:`, `fix:`, `chore:` など)。
