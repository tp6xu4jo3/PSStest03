# 北科大 B1 自習室座位服務｜教學研究原型

此分支將原本「夜讀」座位預約範例改為北科大 B1 自習室的**教學研究原型**，用於演示選位及占位異常回報。

> **非北科大圖書館官方服務。** 沒有與館方座位管理、校務帳號或門禁系統串接。網站產生的空位、登記結果與回報**僅為本專案 Supabase 測試資料**，不能用於現場取得座位或向館方通報。

## 可確認的情境與研究資料

- 校方空間資訊列出 B1 自習室 A、B、C 三區，共 **275席**；但未公開本專案所需的逐席座號與實際位置，因此原型只在每區建立 12 個假座位，共36席。
  - https://irsdc.ntut.edu.tw/p/426-1145-10.php?Lang=zh-tw
- 北科大圖書館《使用及圖書借閱規則》禁止物品預占座位；網站所列規則歷次修訂包含2013年的版本，實作前仍應向館方確認現行規範。
  - https://library.ntut.edu.tw/p/412-1024-2675.php
- 館方曾公開座位登記教學影片，展示正式使用方式。
  - https://www.youtube.com/watch?v=zVJRqAjdLpM
- 北科大Dcard使用者回饋提及登記後發現座位被占用、登記機台不便及通報流程疑問（屬個別公開回饋，不代表統計頻率）。
  - https://www.dcard.tw/f/ntut/p/260189509

## 改版功能

1. B1 A／B／C區切換與示範座位圖（非真實平面圖）。
2. 模擬時段及座位登記、個人紀錄、取消、管理端座位停用與封鎖。
3. 異常回報：遭占用、設備異常、資料不一致、其他。
4. 原型管理端讀取、結案回報；使用者僅能提交與讀取自身回報（資料庫RLS）。
5. 註冊採虛構9位數測試編號，不驗證學校身分；新帳號必須通過Cloudflare Turnstile。

## Supabase手動更新順序

**先備份資料庫。不要直接重跑原本的 `setup.sql`，它是首次初始化腳本。**

1. 確認舊版已建立 `public.seats`、`public.reservations`、`public.blocked_slots`、`public.profiles` 和 `public.is_librarian()`。
2. 在 Supabase → SQL Editor，執行 `supabase/migrations/20261111_ntut_b1_demo.sql`。它保留舊資料，擴充room_code與建立36個演示席位、`seat_reports`及RLS。**不會自動同步真實校方資料**。
3. 在 Cloudflare Turnstile 建立Widget，允許你部署的GitHub Pages網域（若要測試localhost，另加測試網域）。取得 **Site Key** 與 **Secret Key**。
4. 在 `config.js` 的 `TURNSTILE_SITE_KEY` 填入公開的Site Key。**不要**把Secret Key放進repo、網頁、config.js。
5. 至 Supabase Edge Functions → Secrets 新增 `TURNSTILE_SECRET_KEY`。建議同時設定 `TURNSTILE_ALLOWED_HOSTNAMES`，值為GitHub Pages實際hostname，例如 `tp6xu4jo3.github.io`（不含協定、路徑）。
6. 以Supabase CLI在**正確的Supabase專案**執行：

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy register-student
   ```

   部署的程式來源：`supabase/functions/register-student/index.ts`。需確認Edge Functions預設的 `SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` 在執行環境可用。
7. 若原本尚無測試帳號，完成前面步驟後，透過網頁的「建立帳號」註冊**虛構**測試編號。既有測試帳號可以直接登入。
8. 如需要原型管理員，使用測試編號（非真實學號）登入後在SQL Editor執行：

   ```sql
   update public.profiles
   set role = 'librarian'
   where student_id = '001123456';
   ```

   請將例子改成你自己的測試編號；不要給不可信的使用者管理權。
9. 等SQL和Edge Function都準備好後再合併網站分支並部署。不要先合併上線，否則分區資料為空或回報失敗。

### 升級後的SQL檢查

```sql
select room_code, count(*) as demo_seats
from public.seats where room_code in ('b1a','b1b','b1c')
group by room_code order by room_code;
-- 預期每區 12 席

select count(*) from public.seat_reports;
-- 新表起始通常是 0
```

## 網站功能測試

- 未執行升級SQL前，網站不能假裝能看到真實座位，應提示資料尚未建立。
- 三區各顯示12個示範座位、房間切換時更新座位清單。
- 同一模擬日期／時段／座位同時只有一筆有效登記。
- 測試帳號可回報異常；相同座位、問題類型且尚未結案不得重複回報。
- 一般使用者不能修改回報狀態或看到別人的資料；原型管理員可以檢視並結案。
- 未設定Turnstile時新註冊應被拒絕，避免公開端點被濫用。
- 行動裝置小螢幕的座位卡片及回報表單可正常顯示。

## 本版明確未完成

- 北科大真實275席的區域分布、座號與配置（須校方資料）。
- 官方座位管理API、進出門禁、報到、暫離及真實座位狀態同步。
- 正式館方通報流程、館方核准的SOP、校務SSO。
- 實地訪查與使用者測試。因此目前不能聲稱已驗證改善成效。

原有 `README.md` 說明的是舊版「夜讀」程式的技術背景。本檔才是此改版分支的部署與實作說明。
