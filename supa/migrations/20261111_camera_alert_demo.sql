-- 主題包廂的「攝影機物品偵測」互動原型：只有模擬訊號，沒有真實攝影機。
-- 前提：已執行 20261111_ntut_b1_demo.sql 與 20261111_private_rooms_expansion.sql。
-- 保留既有預約和手動回報；每個座位最多一件待處理的模擬異常。
begin;

create table if not exists public.camera_alerts (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats(id) on delete restrict,
  room_code text not null check (room_code in ('b1a','b1b','b1c')),
  object_type text not null check (object_type in ('bag','books')),
  observed_date date not null,
  observed_slot time without time zone not null,
  status text not null default 'open' check (status in ('open','resolved')),
  detected_at timestamptz not null default now(),
  simulated_by uuid not null references auth.users(id),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  constraint camera_alert_resolution_consistency check (
    (status = 'open' and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and resolved_at is not null and resolved_by is not null)
  )
);

create unique index if not exists camera_alerts_one_open_per_seat_idx
on public.camera_alerts (seat_id) where status = 'open';
create index if not exists camera_alerts_room_open_idx
on public.camera_alerts (room_code, detected_at desc) where status = 'open';

alter table public.camera_alerts enable row level security;
revoke all on public.camera_alerts from public, anon, authenticated;
grant select on public.camera_alerts to anon, authenticated;

drop policy if exists "open camera alerts visible for seat status" on public.camera_alerts;
create policy "open camera alerts visible for seat status"
on public.camera_alerts for select to anon, authenticated
using (status = 'open' or public.is_librarian());

-- 只有管理測試帳號能注入模擬的「畫面辨識結果」。
-- 資料庫在同一筆操作中比對預約紀錄；已預約的時段不會產生「空位卻有物品」警報。
create or replace function public.simulate_camera_observation(
  p_seat_id uuid,
  p_date date,
  p_start_time time,
  p_object_type text default 'bag'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_seat public.seats%rowtype;
  v_alert uuid;
begin
  if auth.uid() is null or not public.is_librarian() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_date is null or p_start_time is null
     or p_object_type not in ('bag','books') then
    raise exception 'INVALID_OBSERVATION';
  end if;
  select * into v_seat from public.seats where id = p_seat_id for update;
  if not found or v_seat.room_code not in ('b1a','b1b','b1c') then
    raise exception 'SEAT_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.reservations r
    where r.seat_id = p_seat_id and r.reservation_date = p_date
      and r.start_time = p_start_time and r.status = 'confirmed'
  ) then
    raise exception 'SEAT_ALREADY_REGISTERED';
  end if;
  select id into v_alert from public.camera_alerts
    where seat_id = p_seat_id and status = 'open';
  if found then return v_alert; end if;

  insert into public.camera_alerts
    (seat_id, room_code, object_type, observed_date, observed_slot, simulated_by)
  values
    (v_seat.id, v_seat.room_code, p_object_type, p_date, p_start_time, auth.uid())
  returning id into v_alert;
  return v_alert;
end $$;

create or replace function public.resolve_camera_alert(p_alert_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_librarian() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  update public.camera_alerts
    set status = 'resolved', resolved_by = auth.uid(), resolved_at = now()
    where id = p_alert_id and status = 'open';
  if not found then raise exception 'ALERT_NOT_OPEN'; end if;
end $$;

-- 異常座位暫停登記，避免前端舊資料造成重複搶位；
-- 使用與影像模擬相同的座位行鎖，降低兩者同時操作的競爭情況。
create or replace function public.book_seat(p_seat_id uuid,p_date date,p_start_time time)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_seat public.seats%rowtype;
  v_profile public.profiles%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_profile from public.profiles where id=auth.uid();
  if not found then raise exception 'PROFILE_REQUIRED'; end if;
  if p_date < (now() at time zone 'Asia/Taipei')::date
     or p_date > (now() at time zone 'Asia/Taipei')::date + 7 then
    raise exception 'DATE_RANGE';
  end if;
  if p_start_time < time '09:00' or p_start_time >= time '21:00'
     or extract(minute from p_start_time)<>0 or extract(second from p_start_time)<>0 then
    raise exception 'TIME_RANGE';
  end if;
  select * into v_seat from public.seats where id=p_seat_id for update;
  if not found or not v_seat.is_active then raise exception 'SEAT_DISABLED'; end if;
  if exists (
    select 1 from public.camera_alerts where seat_id = v_seat.id and status = 'open'
  ) then raise exception 'SEAT_ANOMALY_OPEN'; end if;
  if exists (
    select 1 from public.blocked_slots
    where room_code=v_seat.room_code and reservation_date=p_date and start_time=p_start_time
  ) then raise exception 'SLOT_BLOCKED'; end if;
  insert into public.reservations
    (seat_id,room_code,student_id,user_id,reservation_date,start_time)
  values (v_seat.id,v_seat.room_code,v_profile.student_id,auth.uid(),p_date,p_start_time)
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'SLOT_TAKEN';
end $$;

revoke all on function public.simulate_camera_observation(uuid,date,time,text) from public;
revoke all on function public.resolve_camera_alert(uuid) from public;
grant execute on function public.simulate_camera_observation(uuid,date,time,text) to authenticated;
grant execute on function public.resolve_camera_alert(uuid) to authenticated;

comment on table public.camera_alerts is
  'Privacy-preserving teaching prototype. Stores simulated object-detection metadata only, no camera frames, images or personal tracking.';

commit;
