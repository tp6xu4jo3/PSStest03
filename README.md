# B1包廂自習室｜互動式座位服務設計概念

> **非北科大圖書館官方服務。** 本專案的A／B／C是「額外新建的三間主題包廂自習室」設計情境。沒有實際建置或校方核准資料，平面圖、設備、座位登記、人物走動和回報紀錄都屬教學原型。人物動畫尤其**不能用來判斷現場是否真的有人**，已登記只代表原型資料庫的狀態。

## 三間房間

- **A · Cozy Room：12席**。暖木色、植栽、舒適閱讀感。以參考圖片的三排四席為起點。
- **B · Sleepy Room：16席**。柔霧藍紫、沿牆座位與中央書桌，提供柔和安靜的氛圍。
- **C · Discipline Room：20席**。整齊五列四排、明確動線，適合偏好規律配置的使用者。

總共48席，均為新建包廂的**概念配置**，不應與北科大現有自習室席數混為一談。

### 使用流程

選擇主題包廂 → 日期與時段 → 點選地圖中的桌椅 → 查看座號、設備與登記狀態 → 可登記時提交預約。已登記、停用的座位仍可查看與回報異常，**不會因為能點選而變得可預約**。座位異常回報只會在點選座位後出現。

房間採輕量2.5D斜角視覺，不需Three.js或其他3D服務。畫面小人僅用於表現場景氣氛；已預約顯示坐姿角色，走道角色按預定路線移動，並遵守使用者減少動態效果的系統設定。

## 目錄

```text
/
├─ index.html              網站畫面及互動面板
├─ styles.css              2.5D場景與全站動畫設計
├─ room-data.js            房間主題、座位座標、設備與人物路徑
├─ app.js                  預約、回報、資料更新、管理員操作
├─ app-utils.js            CSV安全處理與時間格式
├─ config.js               Supabase公開URL及公開Publishable Key
├─ README.md               唯一Markdown說明
├─ supa/
│  ├─ setup.sql            **只供新資料庫初始化**
│  ├─ migrations/
│  │  ├─ 20261111_ntut_b1_demo.sql            基礎A/B/C座位與回報
│  │  └─ 20261111_private_rooms_expansion.sql 擴充B16、C20席
│  └─ functions/account/index.ts              現有註冊Function
└─ tests/app-utils.test.js
```

## Supabase需要手動更新

**先備份資料庫，現有專案不要重跑`supa/setup.sql`。**

請在Supabase → SQL Editor依序執行以下SQL。已經成功執行過第一份就略過它：

1. [`supa/migrations/20261111_ntut_b1_demo.sql`](supa/migrations/20261111_ntut_b1_demo.sql)：建立A／B／C示範區基礎座位及`seat_reports`。
2. [`supa/migrations/20261111_private_rooms_expansion.sql`](supa/migrations/20261111_private_rooms_expansion.sql)：增量擴充座位上限並新增B13–B16、C13–C20。保留既有資料和預約。

檢查結果：
```sql
select room_code,count(*) as seats
from public.seats
where room_code in ('b1a','b1b','b1c')
group by room_code order by room_code;
-- 應得到 b1a=12、b1b=16、b1c=20
```

原有註冊功能名稱為Supabase Edge Functions → **account**，程式位置[`supa/functions/account/index.ts`](supa/functions/account/index.ts)。如果先前尚未將最新版部署至Supabase，請更新並重新部署。沒有Cloudflare Turnstile等額外服務設定。

需要管理員時，先註冊測試帳號，再由Supabase SQL Editor調整其`profiles.role`為`librarian`。管理端現在以**「停用座位」和「啟用座位」兩個獨立按鈕**操作，並顯示目前狀態，不會用一個按鈕盲目切換。

## 技術與測試

- GitHub Pages靜態前端：原生HTML/CSS/JavaScript。
- Supabase：Auth、Postgres、RLS、RPC、Edge Function。
- `room-data.js`純前端座位與設備配置；資料庫`seats`持有真正供原型使用的seat ID、啟用狀態，`reservations`記錄登記。無即時實體占用感測器。
- `app-utils.js`提供CSV處理、防試算表公式注入；保留`tests/app-utils.test.js`。可用Node.js執行`node --test tests/*.test.js`。
- 不能把Supabase Service Role Key放進前端；`config.js`只能存公開連線資訊。
- 靜態場景切換採CSS動畫；在`prefers-reduced-motion`條件下關閉動態。

## 限制

概念座位數、設備與空間配置尚未經校方或現場驗證；沒有官方SSO、門禁、實體占用狀態與校方通報串接，不能用來實際預約北科大座位。沒有實測前不可宣稱改善學習或使用效果。
