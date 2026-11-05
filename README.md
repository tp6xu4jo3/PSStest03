# 夜讀・圖書館閱覽室座位預約

原生 HTML / CSS / JavaScript，部署到 GitHub Pages；Supabase 提供 Auth、Postgres、RLS 與 RPC。

## 專案檔案
- `index.html`：網站頁面
- `styles.css`：夜間圖書館視覺
- `app.js`：Supabase 前端流程
- `config.js`：只填 Supabase URL 與 Publishable key
- `setup.sql`：資料表、RLS、預約 RPC、註冊限流
- `supabase/functions/register-student/index.ts`：學生註冊 Edge Function

## 重要設計
- 學號映射為 `${學號}@students.library.invalid`，只供 Supabase Auth 使用，不要求真實 Email。
- 註冊由 Edge Function 使用 service role 建立 Auth user；Auth trigger 在同一資料庫交易建立 `profiles`。trigger 或 profile 寫入失敗時 Auth 建立交易會失敗；Edge Function 另做檢查並刪除殘留 Auth user。
- 前端只使用 Publishable key；service role 僅設於 Edge Function secrets。
- 座位預約由 `book_seat` RPC 執行，DB unique partial index 保證同座位、同日期、同時段只能一筆有效預約。
- 日期和時段規則在 DB 驗證：台北日期今天至第 7 天、每日 09:00–20:00 開始（每段一小時，最後一段 20:00–21:00）。
- 學生只能讀取自己的預約；館員可讀取全部並管理座位、封鎖時段。
- 註冊需 Cloudflare Turnstile token；Edge Function 再以 IP 雜湊做每小時最多 5 次限制。

## A. 建立 Supabase 專案
1. 建立 Supabase project，記下 Project URL、Publishable key。
2. Authentication → Providers → Email：保持 Email provider 啟用。此專案以合成的 `.invalid` Email 作為登入識別，不寄送驗證信。
3. Authentication → Settings：若有「Confirm email」設定，無需依賴它；Edge Function 建立帳號時明確設 `email_confirm: true`。
4. SQL Editor → New query，貼上整份 `setup.sql` → Run。
5. Table Editor 確認 `seats` 有 24 筆（north/south 各 12）、`profiles` / `reservations` / `blocked_slots` 已建立。
6. Database → Functions 確認 `book_seat`、`cancel_reservation`、`is_librarian`、`allow_registration_attempt` 存在。
7. Authentication → Users 初始可為空；完成註冊後會看到 Auth user。

## B. 設定 Turnstile
1. 到 Cloudflare Dashboard → Turnstile 建立 Widget，選 GitHub Pages 網域（測試時可加入 localhost）。
2. 取得 Site Key 與 Secret Key。
3. 將 Site Key 加入 `index.html` 註冊表單，並加入 Turnstile 官方 widget script，讓表單產生 `cf-turnstile-response` token。
4. `app.js` 的 register 呼叫 body 加上 `turnstile_token: document.querySelector('[name="cf-turnstile-response"]').value`。
5. Edge Function secret 設定 `TURNSTILE_SECRET_KEY`。不要把 Secret Key 放前端。
6. 正式上線前，務必完成此步驟；註冊端點未設定時會回覆 503，不會開放無驗證註冊。

## C. 部署 Edge Function
安裝 Supabase CLI 並登入：
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET
supabase functions deploy register-student
```
Supabase 專案的 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_ANON_KEY` 由 Edge Functions 執行環境提供；若專案環境未自動提供，使用 `supabase secrets set` 設定相應值。service role key 絕不可提交 Git。

前端註冊呼叫方式：
```js
const { data, error } = await supabase.functions.invoke("register-student", {
  body: {
    student_id: "001123456",
    password: "至少八位密碼",
    turnstile_token: document.querySelector('[name="cf-turnstile-response"]').value
  }
});
```
目前範例 `app.js` 的註冊流程已呼叫 Function；依上節將 Turnstile token 加入 body 後即可正式使用。

## D. 設定 config.js
```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_..."
};
```
使用 Publishable key（舊專案 anon key 亦可），不要使用 secret/service_role key。

## E. 建立館員
1. 先由網站註冊一個學生帳號。
2. SQL Editor 執行（換成自己的測試學號）：
```sql
update public.profiles set role='librarian' where student_id='001123456';
```
3. 登出再登入，導覽列會出現「館員管理」。

## F. GitHub Pages
1. 將整個資料夾內容推送至 GitHub repository 根目錄（`index.html` 必須在根目錄）。
2. Repository → Settings → Pages → Deploy from a branch → `main` / `/ (root)` → Save。
3. 等待 Pages 顯示網址後開啟。確認 `config.js` 與 `app.js` 同網域可載入。

## G. 測試清單
- 訪客可看到座位圖；未登入點選座位會被要求登入。
- 用合法學號註冊；同學號再次註冊應顯示已註冊。
- 使用相同學號與密碼登入；錯誤密碼不可登入。
- 登入後切換日期、時段、閱覽室，確認空位即時更新。
- 兩個瀏覽器同時預約同一座位同一時段：只能一方成功，另一方收到搶位失敗提示。
- 我的預約只顯示自己的有效預約；取消後座位恢復空位。
- 館員帳號能停用座位、封鎖時段並查看預約；一般學生不能。
- 直接在前端呼叫 `book_seat` 時，超出日期或時段規則應由 DB 拒絕。

## 注意事項 / 上線前檢查
- 這是教案 MVP。學號是識別碼，不是可靠身分驗證；正式校務系統應串接校方 SSO。
- SQL 中館員角色由具備 Dashboard SQL 權限的人手動提升。絕不可讓使用者自行修改 profiles.role。
- 若要更嚴格的註冊防濫用，Turnstile 網域白名單、每 IP 限流與 Supabase Auth rate limits 都應啟用；若部署在非 Cloudflare 代理環境，`cf-connecting-ip` 可能是空值，應改用可信代理提供的 client IP header。
- RLS 是安全邊界；不要在前端放 service role key。
