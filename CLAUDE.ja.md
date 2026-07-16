# chrome-confluence-breadcrumb

Confluence のページ上部にページ階層 (パンくずリスト) を表示する Chrome 拡張。

## 対象環境

- Confluence Cloud のみ (`*.atlassian.net`)。Server / Data Center は対象外。
- Chrome (Manifest V3)。

## 技術方針

- TypeScript で実装し、ビルドで配布物を生成する。
- ライセンスは MIT (LICENSE 参照)。

## 文書スタイル

- ドキュメントは英語で書く。各ドキュメントには `.ja` サフィックス付きの日本語版
  (例: `CLAUDE.ja.md`) を併設し、編集時は両方を同期させる。
- コミットメッセージは Conventional Commits 形式 (`feat:`, `fix:`, `chore:` など)。
