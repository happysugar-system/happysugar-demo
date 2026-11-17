# 勝馬分析AI — OCR Edge Function（準備版）

このフォルダは **未デプロイ** の独立した実装です。既存のGOLD FIRST / Happysugar本番環境には触れません。

- `index.ts` を競馬専用Supabaseプロジェクトの Edge Function `keiba-ocr` としてデプロイ
- `OPENAI_API_KEY` と `KEIBA_OCR_ACCESS_TOKEN` を Supabase Secrets に登録
- Edge Function は認証必須（公開アクセス禁止）。トークンを公開GitHub Pagesに埋め込まない
- 送信するのは利用者が明示的に選んだ新聞の切り抜き画像。OpenAI APIへ転送される
- AIは印刷文字・手書き印を区別してJSONを返すだけで、採点はしない
- サーバー側の利用上限・認証済みユーザー管理・レート制限・月額予算制御は **未実装**。本番利用前に必須
- 初期検証は安全な認証経路から行い、正解2頭と照合する
