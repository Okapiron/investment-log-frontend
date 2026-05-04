# TradeTrace 公開v1: 楽天CSV取込 強化 実施記録 (2026-05-04)

## 1. 実装PR相当
- Backend: `fe11e01`
  - `feat(release): add public-v1 guards for imports and price APIs`
- Frontend: `182076a`
  - `feat(release): focus public v1 on rakuten csv workflow`

## 2. 画面スクリーンショット
- 実運用スクリーンショットは本番/ステージングで取得する
  - 取得対象:
    1. `Settings` の 楽天CSV取込セクション（プレビュー前）
    2. プレビュー結果（作成/スキップ/エラー件数）
    3. commit完了メッセージ（作成/更新/スキップ/エラー件数）
    4. `/analysis` の「今の売買スタイル」「次の改善点」

## 3. 楽天CSV取込 操作手順
1. `設定` → `証券会社 CSV取込` を開く
2. `楽天証券` を選択
3. 楽天証券で `tradehistory(JP)` と `realized_pl(JP)` のCSVを保存
4. `tradehistory` を選択して `プレビュー`
5. 必要なら `realized_pl` も選択して `整合性チェック`
6. 件数・エラーを確認後 `この内容で取り込む`
7. 完了後 `/analysis` へ遷移し、振り返り診断を確認

## 4. 取込エラー一覧（ユーザー表示）
- `missing_headers`: CSVヘッダー不足（楽天CSV形式を再取得）
- `invalid_row`: 必須列（日時/銘柄/売買/数量/価格）解釈不可
- `invalid_numeric`: 数量または価格が0以下
- `unsupported_product`: 公開v1対象外行（国内株の現物/信用買い以外）
- `sell_without_buy`: 売りに対応する建玉不足（対象期間見直し/再取込）
- `commit_failed`: 取込中例外（再試行、継続時はサポート連絡）

## 5. E2E確認結果（今回）
- Backend テスト: `84 passed`
- Frontend build: `vite build` 成功
- 楽天CSV関連の回帰:
  - preview/commit/upsert関連テストを含めて成功
  - 同一CSV再取込時の重複防止（更新扱い）を維持

## 6. 公開v1向け設定メモ
- Render (backend):
  - `PUBLIC_V1_MODE=true`
  - `IMPORT_SBI_ENABLED=false`
  - `PRICE_API_ENABLED=false`
  - `ALLOW_UNOFFICIAL_PRICE_SOURCE=false`
  - `AUTH_ENABLED=true`
  - `PRIVATE_MODE_ENABLED=false`
- Vercel (frontend):
  - `VITE_PUBLIC_V1_MODE=true`
  - `VITE_SHOW_SBI_IMPORTS=false`
  - `VITE_ENABLE_PRICE_SANITY_CHECK=false`
  - `VITE_ENABLE_TRADE_CHART=false`

## 7. Moneytree/SBI 将来対応 技術メモ
- 取込パイプラインの責務分離は継続
  - `preview` (検証/差分可視化)
  - `commit` (作成/更新/監査記録)
  - `import session` (履歴・監査用)
- Broker追加時の互換ポイント
  - `source_signature` / `source_position_key` / `source_lot_sequence` を同一基準で付与
  - `TradeImportRecord` による upsert を共通化
  - 手動TradeとimportTradeの分離原則（手動はupsert対象外）を維持
- Moneytree連携時は「取得方法」だけ差し替え
  - 正規化後の `ImportTradeCandidate` へマッピングする層を追加し、preview/commit本体は流用する
