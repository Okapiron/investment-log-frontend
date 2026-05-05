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

## 8. Production再E2E結果と公開判定 (2026-05-05)

### 8.1 総合判定
- 判定: 限定公開Go
- 確認環境: Production
- 確認URL: `https://tradetrace.jp`
- API: `https://tradetrace-api.onrender.com/api/v1`
- 公開v1スコープ:
  - 楽天証券CSV
  - 国内株
  - CSV取込
  - 振り返り分析
- 残課題:
  - 形式不一致CSVエラーで内部正規化カラム名が表示されるため、P1 polishでユーザー向け文言へ改善する
  - 初期ユーザー投入後、CSV失敗ログと問い合わせ内容を見て追加改善する

### 8.2 公開v1基準点
- Backend main: `7b93cab018413732e9b98bbf7d473305767b2b4b`
  - `fix(release): ensure realized-only trade columns on startup`
- Frontend main: `6b9150dd8afeee5fb39437d394e00977655a51a6`
  - `fix(auth): restore invite code signup field`

### 8.3 Production再E2E証跡
- 結果JSON:
  - `docs/release_e2e_runs/2026-05-05_production_rakuten_csv_v1_result.json`
  - `docs/release_e2e_runs/2026-05-05_production_rakuten_csv_v1_resume_result.json`
- スクリーンショット:
  - `docs/release_e2e_runs/screenshots_2026-05-05-production/14_resume_preview_first_import.png`
  - `docs/release_e2e_runs/screenshots_2026-05-05-production/15_resume_analysis_after_first_commit.png`
  - `docs/release_e2e_runs/screenshots_2026-05-05-production/16_resume_preview_reupload.png`
  - `docs/release_e2e_runs/screenshots_2026-05-05-production/17_resume_analysis_after_reupload.png`
  - `docs/release_e2e_runs/screenshots_2026-05-05-production/18_resume_preview_invalid_format.png`
  - `docs/release_e2e_runs/screenshots_2026-05-05-production/20_resume_trade_detail_chart_hidden.png`

### 8.4 確認結果
- ログイン -> 楽天CSV preview -> commit -> analysis:
  - 判定: Pass
  - `preview`: 作成予定 1件 / スキップ 0件 / エラー 0件
  - `commit`: 作成 0件 / 更新 1件 / スキップ 0件 / エラー 0件
  - 補足: E2Eアカウントに前回途中取込データが残っていたため、初回風のcommitも更新扱いになった。重複作成されず分析へ遷移することを確認済み。
- 同一CSV再取込:
  - 判定: Pass
  - `preview`: 作成予定 1件 / スキップ 0件 / エラー 0件
  - `commit`: 作成 0件 / 更新 1件 / スキップ 0件 / エラー 0件
  - `既に取込済みです。commit時は最新CSVの内容で更新されます。` の表示を確認
- 形式不一致CSV:
  - 判定: Pass
  - `CSVヘッダーが不足しています...` として安全に拒否されることを確認
  - P1 polishとして内部カラム名をユーザー向け文言に置き換える
- SBI/自動連携/価格チャート:
  - 判定: Pass
  - 証券会社選択肢は `楽天証券` のみ
  - SBI正式導線は非表示
  - 自動連携導線は非表示
  - 価格チャートは非表示で、`公開v1では価格チャート表示を無効化しています。` の案内を表示
  - Yahoo系非公式価格ソースの表示なし
- KPIイベント:
  - 判定: Pass
  - `dataLayer` と `CustomEvent` の両方で以下を確認
    - `csv_upload_start`
    - `csv_preview_success`
    - `csv_commit_success`
    - `csv_reupload_update`
    - `analysis_after_import_view`
    - `csv_preview_failure`
- Analysis API:
  - 判定: Pass
  - `/api/v1/analysis/summary` は `200`

### 8.5 初期ユーザー向け招待コード発行手順
- 前提:
  - Production backend は `INVITE_CODE_REQUIRED=true`
  - 招待コードは1コード1人、初期運用では7日失効を標準にする
  - SNS等の公開場所には貼らず、対象ユーザーへ個別送付する
- 新規発行:
  ```bash
  cd /Users/hiroki/Projects/TradeTrace/backend
  .venv/bin/python tools/create_invite_code.py --days 7 --length 10
  ```
- JSONで発行内容を取得:
  ```bash
  cd /Users/hiroki/Projects/TradeTrace/backend
  .venv/bin/python tools/create_invite_code.py --days 7 --length 10 --json
  ```
- 固定コードで発行する場合:
  ```bash
  cd /Users/hiroki/Projects/TradeTrace/backend
  .venv/bin/python tools/create_invite_code.py --code AB12CD34EF --days 7
  ```
- 有効コード確認:
  ```bash
  cd /Users/hiroki/Projects/TradeTrace/backend
  .venv/bin/python tools/manage_invite_codes.py list --status active --json
  ```
- 無効化:
  ```bash
  cd /Users/hiroki/Projects/TradeTrace/backend
  .venv/bin/python tools/manage_invite_codes.py revoke --code AB12CD34EF
  ```
- 参照:
  - Backend: `docs/public_release_ops.md`
  - P1 polish追跡: `docs/issues/2026-05-05_p1_rakuten_csv_error_polish.md`
