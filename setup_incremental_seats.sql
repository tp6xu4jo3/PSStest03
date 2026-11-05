-- 1. 移除舊的 12 席檢查條件，改為支援到 24 席
ALTER TABLE public.seats DROP CONSTRAINT IF EXISTS seats_seat_no_check;
ALTER TABLE public.seats ADD CONSTRAINT seats_seat_no_check CHECK (seat_no >= 1 AND seat_no <= 24);

-- 2. 增量新增北側（13~24）與南側（13~20）席位（保留既有 1~12 號座位與預約）
INSERT INTO public.seats (room_code, seat_no, is_active)
SELECT v.room_code, v.seat_no, true
FROM (
  VALUES
    -- 北側閱覽室（13–24 席）
    ('north', 13), ('north', 14), ('north', 15), ('north', 16),
    ('north', 17), ('north', 18), ('north', 19), ('north', 20),
    ('north', 21), ('north', 22), ('north', 23), ('north', 24),
    -- 南側閱覽室（13–20 席）
    ('south', 13), ('south', 14), ('south', 15), ('south', 16),
    ('south', 17), ('south', 18), ('south', 19), ('south', 20)
) AS v(room_code, seat_no)
WHERE NOT EXISTS (
  SELECT 1 FROM public.seats s
  WHERE s.room_code = v.room_code AND s.seat_no = v.seat_no
);
