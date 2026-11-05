-- 新增「2 樓閱覽區」與 10 席，不刪除或重建任何資料表或既有資料。
-- 在 Supabase SQL Editor 執行一次；重複執行亦不會重複新增座位。

begin;

-- 允許新館室代碼出現在座位、封鎖與預約紀錄中。
alter table public.seats
  drop constraint if exists seats_room_code_check;
alter table public.seats
  add constraint seats_room_code_check
  check (room_code in ('north', 'south', 'floor2'));

alter table public.blocked_slots
  drop constraint if exists blocked_slots_room_code_check;
alter table public.blocked_slots
  add constraint blocked_slots_room_code_check
  check (room_code in ('north', 'south', 'floor2'));

alter table public.reservations
  drop constraint if exists reservations_room_code_check;
alter table public.reservations
  add constraint reservations_room_code_check
  check (room_code in ('north', 'south', 'floor2'));

-- 只新增缺少的 2 樓座位；既有座位的啟用狀態與預約資料不變。
insert into public.seats (room_code, seat_no, is_active)
select 'floor2', seat_no, true
from generate_series(1, 10) as seats(seat_no)
on conflict (room_code, seat_no) do nothing;

-- 解除封鎖仍須通過既有館員 RLS；一般登入者與訪客無法刪除封鎖。
drop policy if exists "librarian block manage" on public.blocked_slots;
create policy "librarian block manage" on public.blocked_slots
  for all to authenticated
  using (public.is_librarian())
  with check (public.is_librarian());

commit;
