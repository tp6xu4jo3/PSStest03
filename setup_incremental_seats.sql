-- ============================================================================
-- 夜讀・閱覽室座位增量擴充 SQL 腳本 (setup_incremental_seats.sql)
-- 
-- 執行方式：
-- 1. 前往 Supabase 專案後台 (Dashboard) -> SQL Editor
-- 2. 點擊「New Query」，貼上本檔案內容並點擊「Run」
--
-- 特點：
-- 1. 保留北側與南側現有 1~12 號座位原有 ID 與既有預約，絕不破壞既有資料。
-- 2. 北側閱覽室擴充至 24 席（新增第 13 至 24 席）。
-- 3. 南側閱覽室擴充至 20 席（新增第 13 至 20 席）。
-- 4. 具備冪等性 (WHERE NOT EXISTS)，重複執行安全不報錯。
-- 5. 附帶 Supabase Realtime 即時推播發佈設定語法。
-- ============================================================================

-- 1. 增量新增座位（僅在座位尚未存在時新增，保留 1-12 號與現存預約）
INSERT INTO public.seats (room_code, seat_no, is_active)
SELECT v.room_code, v.seat_no, true
FROM (
  VALUES
    -- 北側閱覽室（擴充至 24 席：新增 13–24 席）
    ('north', 13), ('north', 14), ('north', 15), ('north', 16),
    ('north', 17), ('north', 18), ('north', 19), ('north', 20),
    ('north', 21), ('north', 22), ('north', 23), ('north', 24),
    -- 南側閱覽室（擴充至 20 席：新增 13–20 席）
    ('south', 13), ('south', 14), ('south', 15), ('south', 16),
    ('south', 17), ('south', 18), ('south', 19), ('south', 20)
) AS v(room_code, seat_no)
WHERE NOT EXISTS (
  SELECT 1 FROM public.seats s
  WHERE s.room_code = v.room_code AND s.seat_no = v.seat_no
);

-- 2. 設定 Supabase Realtime 發佈（讓兩個帳號在座位異動時收到即時推播）
-- 若資料表尚未加入 supabase_realtime publication，可執行以下語法：
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
  EXCEPTION WHEN duplicate_object THEN
    -- 已存在則略過
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_slots;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 3. 驗證擴充成果：查詢兩館目前席數總覽
SELECT 
  room_code,
  COUNT(*) as total_seats,
  MIN(seat_no) as min_seat_no,
  MAX(seat_no) as max_seat_no
FROM public.seats
GROUP BY room_code
ORDER BY room_code;
