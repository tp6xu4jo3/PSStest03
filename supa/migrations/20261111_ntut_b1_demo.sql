-- 北科大 B1 自習室「教學原型」增量資料庫升級
-- 請先備份 Supabase 資料庫，於 SQL Editor 單獨執行本檔一次。
-- 前提：原 repo 的 setup.sql 已執行，public.is_librarian() 已存在。
-- 不會清除或改名原本 north/south/floor2 舊資料與預約。
-- b1a / b1b / b1c 各 12 個「示範座位」並非北科大官方座位編號、總量或即時空位。

begin;

-- 原專案以 CHECK 限制只能使用舊館室代號。保留舊代號並新增原型區域。
do $$
declare t text; c record;
begin
  foreach t in array array['seats', 'blocked_slots', 'reservations'] loop
    for c in
      select conname
      from pg_constraint
      where conrelid = format('public.%I', t)::regclass
        and contype = 'c'
        and position('room_code' in pg_get_constraintdef(oid)) > 0
    loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;
    execute format(
      'alter table public.%I add constraint %I check (room_code in (''north'', ''south'', ''floor2'', ''b1a'', ''b1b'', ''b1c''))',
      t, t || '_ntut_room_code_check'
    );
  end loop;
end $$;

-- 不更動原先座位。每區僅建立 12 個演示座位，不能用於真實登記。
insert into public.seats (room_code, seat_no)
select r.code, s.n
from (values ('b1a'), ('b1b'), ('b1c')) as r(code)
cross join generate_series(1, 12) as s(n)
on conflict (room_code, seat_no) do nothing;

create table if not exists public.seat_reports (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats(id) on delete restrict,
  room_code text not null check (room_code in ('b1a', 'b1b', 'b1c')),
  reported_by uuid not null references auth.users(id) on delete cascade,
  issue_type text not null check (issue_type in ('occupied', 'equipment', 'mismatch', 'other')),
  details text not null default '' check (char_length(details) <= 300),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists seat_reports_newest_idx on public.seat_reports (room_code, created_at desc);
create unique index if not exists seat_reports_one_open_per_type_idx
  on public.seat_reports (reported_by, seat_id, issue_type) where status = 'open';

alter table public.seat_reports enable row level security;
revoke all on public.seat_reports from public, anon, authenticated;
grant select, insert, update on public.seat_reports to authenticated;

drop policy if exists "read own reports or librarian" on public.seat_reports;
create policy "read own reports or librarian"
  on public.seat_reports for select to authenticated
  using (reported_by = auth.uid() or public.is_librarian());

drop policy if exists "submit own valid demo report" on public.seat_reports;
create policy "submit own valid demo report"
  on public.seat_reports for insert to authenticated
  with check (
    reported_by = auth.uid()
    and status = 'open'
    and resolved_at is null
    and exists (
      select 1 from public.seats s
      where s.id = seat_reports.seat_id and s.room_code = seat_reports.room_code
    )
  );

drop policy if exists "librarian updates reports" on public.seat_reports;
create policy "librarian updates reports"
  on public.seat_reports for update to authenticated
  using (public.is_librarian())
  with check (public.is_librarian());

comment on table public.seat_reports is
  'NTUT B1 seat usability teaching prototype: user-submitted demo reports; not an official library report channel.';

commit;
