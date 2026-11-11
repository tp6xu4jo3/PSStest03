# 北科大B1自習室｜座位服務設計原型

> **教學研究原型，不是北科大圖書館的官方網站。** 不連接官方座位、門禁、校務登入或正式回報管道；畫面顯示的座號、空位、預約時間與回報紀錄都是本專案的**示範資料**，不可據此實際占位。

以北科大圖書館B1自習室A／B／C三區為設計情境，提供模擬選位、座位登記、個人紀錄、取消、占位異常回報及原型管理員管理功能。每區僅配置**12個虛構座位**（共36席），不是校方正式座位配置。

## 檔案位置

```text
/
├─ index.html                    網頁結構
├─ styles.css                    介面樣式
├─ app.js                        座位、登入、回報及管理流程
├─ app-utils.js                  CSV安全逸出、匯出欄位與時間格式
├─ config.js                     Supabase公開連線設定
├─ README.md                     本說明（唯一Markdown檔）
├─ .gitignore
├─ supa/
│  ├─ setup.sql                  首次建立空白資料庫使用
│  ├─ migrations/
│  │  └─ 20261111_ntut_b1_demo.sql   **既有資料庫**升級用
│  └─ functions/
│     └─ account/
│        └─ index.ts             註冊Edge Function
└─ tests/
   └─ app-utils.test.js          CSV與時間格式單元測試
```

## Supabase：需要手動修改的位置

**先備份資料庫。現有專案請勿重跑`supa/setup.sql`。**

1. **現有資料庫：** Supabase → SQL Editor，執行 [`supa/migrations/20261111_ntut_b1_demo.sql`](supa/migrations/20261111_ntut_b1_demo.sql)。它擴充原有資料表並建立B1示範座位與`seat_reports`，不會刪除舊資料。
2. **全新資料庫：**先執行 [`supa/setup.sql`](supa/setup.sql)，再執行前述增量SQL。舊版初始化內容保留作為新資料庫的結構前置。
3. **註冊Function：**Supabase → Edge Functions → `account`，用 [`supa/functions/account/index.ts`](supa/functions/account/index.ts) 更新既有的 `account` Function。`account` 是部署名稱，檔案仍叫 `index.ts`。
4. **無需其他第三方設定：**註冊只使用原有的Supabase Auth、Edge Function與Postgres限流函式`allow_registration_attempt`（位於`supa/setup.sql`）；新的Edge Function會對同一虛構測試編號每小時限制5次註冊嘗試，僅保存識別碼雜湊。更新Edge Function後即不需要額外驗證服務或其金鑰。
5. **安全提醒：**不得把Supabase Service Role Key放進前端。此註冊方式沒有真人驗證，使用者可更換編號，限流不能完全阻止大量自動註冊；僅供教學原型，公開正式服務需另行評估安全性。原型帳號不能當作北科大校務登入。

### 以Supabase CLI部署Function

Supabase CLI預設讀取**`supabase/functions/`**，而本repo依需求將後台檔案集中於**`supa/`**。使用CLI時，需在本機建立臨時預設路徑，複製Function後部署（請勿把臨時`supabase/`資料夾提交到repo）：

```bash
mkdir -p supabase/functions
cp -R supa/functions/account supabase/functions/
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy account
```

可改用Supabase Dashboard的Edge Function編輯器手動更新程式，不必建立臨時目錄。必須確認執行環境可讀取`SUPABASE_URL`與`SUPABASE_SERVICE_ROLE_KEY`。

### 執行後檢查

```sql
select room_code, count(*) as demo_seats
from public.seats
where room_code in ('b1a','b1b','b1c')
group by room_code order by room_code;
-- 預期：每區12個示範席位
```

如需原型管理員，先用測試帳號註冊，再於Supabase SQL Editor將該帳號`profiles.role`設為`librarian`；不要授予不可信使用者。原型資料不是校方正式座位資訊。

## 檢查與測試

- 先完成SQL與Edge Function部署，才能正常使用新分區、註冊與回報功能；不需要其他第三方設定。
- 同座位同時段避免重複登記，操作後可取消。
- 一般使用者可回報座位遭占用、設備異常等狀況；僅原型管理員可檢視全部並結案。
- `tests/app-utils.test.js`用來驗證CSV特殊字元、公式注入防護、時間格式與匯出欄位不含學號等識別資料。若已安裝Node.js，可執行`node --test tests/app-utils.test.js`。
- `app-utils.js`被`app.js`實際引用，故保留；如果刪除，CSV匯出與部分時間顯示會失效。

## 參考資料與限制

- [北科大校方空間資料](https://irsdc.ntut.edu.tw/p/426-1145-10.php?Lang=zh-tw)：B1自習室有A／B／C三區，合計275席（不代表本原型的36個模擬座位）。
- [北科大圖書館使用及借閱規則](https://library.ntut.edu.tw/p/412-1024-2675.php)：發布的規則版本可能不是現行細則，正式系統需再由館方確認。
- 2023年北科大Dcard使用經驗談及其他學校座位管理流程僅作設計研究參考，個別貼文不能代表問題發生率。

尚未完成官方SSO、真實座位配置與座號、正式登記／報到／暫離規則、官方系統API串接、實地使用測試；因此不得宣稱改善成效已獲驗證。
