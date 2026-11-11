-- 夜讀閱覽室座位預約系統
-- 在 Supabase Dashboard → SQL Editor → New query，整份貼上後按 Run。
-- 注意：此腳本會建立專用資料表與函式；若同名物件已存在，請先備份並檢查再重跑。

create extension if not exists pgcrypto;

do $$ begin
  create type public.member_role as enum ('student','librarian');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.reservation_status as enum ('confirmed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id varchar(9) not null unique check (student_id ~ '^[0-9]{9}$' and substring(student_id,1,3)::int between 0 and 115),
  role public.member_role not null default 'student',
  created_at timestamptz not null default now()
);

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  room_code text not null check (room_code in ('north','south')),
  seat_no int not null check (seat_no between 1 and 12),
  is_active boolean not null default true,
  unique(room_code,seat_no)
);

insert into public.seats(room_code,seat_no)
select r.room_code,n from (values ('north'),('south')) r(room_code) cross join generate_series(1,12) n
on conflict(room_code,seat_no) do nothing;

create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  room_code text not null check (room_code in ('north','south')),
  reservation_date date not null,
  start_time time not null,
  reason text not null default '館員封鎖',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(room_code,reservation_date,start_time),
  check (start_time >= time '09:00' and start_time < time '21:00' and extract(minute from start_time)=0)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats(id),
  room_code text not null check (room_code in ('north','south')),
  student_id varchar(9) not null references public.profiles(student_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_date date not null,
  start_time time not null,
  status public.reservation_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  check (start_time >= time '09:00' and start_time < time '21:00' and extract(minute from start_time)=0)
);

-- 同一座位同一時段只能有一筆有效預約；取消後可重新預約。
create unique index if not exists reservations_one_active_seat_slot
on public.reservations(seat_id,reservation_date,start_time) where status='confirmed';
create index if not exists reservations_user_date_idx on public.reservations(user_id,reservation_date);
create index if not exists reservations_room_slot_idx on public.reservations(room_code,reservation_date,start_time);

-- 註冊時由 Auth trigger 在同一個資料庫交易建立 profile。
create or replace function public.handle_new_student()
returns trigger language plpgsql security definer set search_path=public
as $$
declare sid text;
begin
  sid := new.raw_user_meta_data->>'student_id';
  if sid is null or sid !~ '^[0-9]{9}$' or substring(sid,1,3)::int not between 0 and 115 then
    raise exception 'INVALID_STUDENT_ID';
  end if;
  insert into public.profiles(id,student_id,role) values(new.id,sid,'student');
  return new;
end $$;

drop trigger if exists on_auth_user_created_student on auth.users;
create trigger on_auth_user_created_student after insert on auth.users
for each row execute procedure public.handle_new_student();

create or replace function public.is_librarian()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='librarian') $$;

alter table public.profiles enable row level security;
alter table public.seats enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "profile self read" on public.profiles;
create policy "profile self read" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_librarian());
drop policy if exists "seats readable" on public.seats;
create policy "seats readable" on public.seats for select to anon,authenticated using (true);
drop policy if exists "librarian seat update" on public.seats;
create policy "librarian seat update" on public.seats for update to authenticated
using(public.is_librarian()) with check(public.is_librarian());
drop policy if exists "blocked slots readable" on public.blocked_slots;
create policy "blocked slots readable" on public.blocked_slots for select to anon,authenticated using (true);
drop policy if exists "librarian block manage" on public.blocked_slots;
create policy "librarian block manage" on public.blocked_slots for all to authenticated
using(public.is_librarian()) with check(public.is_librarian());
drop policy if exists "own reservations or librarian read" on public.reservations;
create policy "own reservations or librarian read" on public.reservations for select to authenticated
using(user_id=auth.uid() or public.is_librarian());

-- 註冊 Edge Function 使用 service role 建立 Auth 使用者；trigger 自動建立 profile。
-- 學生端不得直接 insert/update reservations，只能呼叫下列 RPC。
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
revoke insert,update,delete on public.reservations from anon,authenticated;
grant select on public.reservations to authenticated;
grant select on public.seats,public.blocked_slots to anon,authenticated;
grant update(is_active) on public.seats to authenticated;
grant insert,update,delete on public.blocked_slots to authenticated;

create or replace function public.book_seat(p_seat_id uuid,p_date date,p_start_time time)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_seat public.seats%rowtype; v_profile public.profiles%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_profile from public.profiles where id=auth.uid();
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if p_date < (now() at time zone 'Asia/Taipei')::date or p_date > (now() at time zone 'Asia/Taipei')::date + 7 then raise exception 'DATE_RANGE'; end if;
  if p_start_time < time '09:00' or p_start_time >= time '21:00' or extract(minute from p_start_time)<>0 or extract(second from p_start_time)<>0 then raise exception 'TIME_RANGE'; end if;
  select * into v_seat from public.seats where id=p_seat_id for update;
  if not found or not v_seat.is_active then raise exception 'SEAT_DISABLED'; end if;
  if exists(select 1 from public.blocked_slots where room_code=v_seat.room_code and reservation_date=p_date and start_time=p_start_time) then raise exception 'SLOT_BLOCKED'; end if;
  insert into public.reservations(seat_id,room_code,student_id,user_id,reservation_date,start_time)
  values(v_seat.id,v_seat.room_code,v_profile.student_id,auth.uid(),p_date,p_start_time)
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'SLOT_TAKEN'; end $$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.reservations set status='cancelled'
  where id=p_reservation_id and user_id=auth.uid() and status='confirmed';
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
end $$;

revoke all on function public.book_seat(uuid,date,time) from public;
grant execute on function public.book_seat(uuid,date,time) to authenticated;
revoke all on function public.cancel_reservation(uuid) from public;
grant execute on function public.cancel_reservation(uuid) to authenticated;
grant execute on function public.is_librarian() to authenticated;

-- 建立館員：先用一般學生帳號註冊，再以該帳號登入後在 SQL Editor 執行：
-- update public.profiles set role='librarian' where student_id='你的9位測試學號';
-- 請勿把 service_role key 放進前端。


-- 註冊防濫用：Edge Function 以 IP SHA-256 雜湊值計數，不保存原始 IP。
create table if not exists public.registration_attempts (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts int not null default 0
);
alter table public.registration_attempts enable row level security;
revoke all on public.registration_attempts from anon,authenticated;

create or replace function public.allow_registration_attempt(p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public
as $$
declare current_count int;
begin
  insert into public.registration_attempts(ip_hash,window_started_at,attempts)
  values(p_ip_hash,now(),1)
  on conflict(ip_hash) do update set
    attempts=case when public.registration_attempts.window_started_at < now()-interval '1 hour' then 1 else public.registration_attempts.attempts+1 end,
    window_started_at=case when public.registration_attempts.window_started_at < now()-interval '1 hour' then now() else public.registration_attempts.window_started_at end
  returning attempts into current_count;
  return current_count <= 5;
end $$;
revoke all on function public.allow_registration_attempt(text) from public,anon,authenticated;
grant execute on function public.allow_registration_attempt(text) to service_role;

-- 座位圖公開查詢：只回傳指定閱覽室、日期、時段的已占用座位 ID，
-- 不暴露預約者學號、使用者 ID 或預約紀錄 ID。
create or replace function public.get_booked_seat_ids(
  p_room_code text,
  p_date date,
  p_start_time time
)
returns table(seat_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select r.seat_id
  from public.reservations as r
  where r.room_code = p_room_code
    and r.reservation_date = p_date
    and r.start_time = p_start_time
    and r.status = 'confirmed';
$$;

revoke all on function public.get_booked_seat_ids(text,date,time) from public;
grant execute on function public.get_booked_seat_ids(text,date,time) to anon, authenticated;
