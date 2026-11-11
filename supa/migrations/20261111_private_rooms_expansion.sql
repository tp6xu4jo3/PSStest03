-- 額外新建的A/B/C主題包廂「設計概念」座位擴充，不是校方真實工程資料。
-- 在原版 20261111_ntut_b1_demo.sql 成功執行後，才執行本檔。
-- A:12席；B:16席；C:20席，共48個原型座位。
-- 非破壞性增量：不刪除既有預約、座位、回報。
begin;

-- 原 setup.sql 可能限制 seat_no <=12；移除舊座號上限，允許新包廂更多座位。
-- 保留既有與其他區的座位，避免縮減上限誤傷舊資料。
do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname from pg_constraint
    where conrelid='public.seats'::regclass
      and contype='c'
      and position('seat_no' in pg_get_constraintdef(oid)) > 0
  loop
    execute format('alter table public.seats drop constraint %I',constraint_row.conname);
  end loop;
end $$;
alter table public.seats
  add constraint seats_concept_number_range check (seat_no between 1 and 100);

insert into public.seats(room_code,seat_no,is_active)
select r.code,n,true
from (values ('b1a',12),('b1b',16),('b1c',20)) as r(code,total)
cross join lateral generate_series(1,r.total) as n
on conflict (room_code,seat_no) do nothing;

commit;
