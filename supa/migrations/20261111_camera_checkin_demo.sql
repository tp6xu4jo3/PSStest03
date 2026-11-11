-- 只有模擬的攝影機到席訊號；不取得影像、不辨識身分。
-- 依序執行既有3份migrations後，再執行本檔。不能用來判斷違規或自動取消預約。
begin;

create table if not exists public.reservation_presence (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  status text not null check (status in ('present','away','returned')),
  last_observed_at timestamptz not null default now(),
  simulated_by uuid not null references auth.users(id)
);
alter table public.reservation_presence enable row level security;
revoke all on public.reservation_presence from public,anon,authenticated;

-- 模擬攝影機：向所有人僅提供座位與到席階段，不揭露預約人。
create or replace function public.get_seat_presence(
  p_room_code text,p_date date,p_start_time time
)
returns table(seat_id uuid,presence_state text)
language sql stable security definer set search_path=public as $$
  select r.seat_id, coalesce(p.status,'pending')::text
  from public.reservations r
  left join public.reservation_presence p on p.reservation_id=r.id
  where r.room_code=p_room_code and r.reservation_date=p_date
    and r.start_time=p_start_time and r.status='confirmed'
    and p_room_code in ('b1a','b1b','b1c')
    and p_date between (now() at time zone 'Asia/Taipei')::date
      and (now() at time zone 'Asia/Taipei')::date+7
    and p_start_time >= time '09:00' and p_start_time < time '21:00';
$$;

create or replace function public.get_my_reservation_presence()
returns table(reservation_id uuid,presence_state text)
language sql stable security definer set search_path=public as $$
  select r.id,coalesce(p.status,'pending')::text
  from public.reservations r
  left join public.reservation_presence p on p.reservation_id=r.id
  where r.user_id=auth.uid() and r.status='confirmed';
$$;

-- 模擬的「有人／無人」事件。只允許原型管理員操作。
-- 未登記卻偵測到人：改為既有館員異常通報；無人則不產生紀錄。
-- 已登記卻無人：若尚未報到，維持待報到；報到後才進入暫離。
-- 暫離再次偵測到人：顯示已回座；完全不做身分辨識。
create or replace function public.simulate_camera_presence(
  p_seat_id uuid,p_date date,p_start_time time,p_person_detected boolean
)
returns text language plpgsql security definer set search_path=public as $$
declare
  v_seat public.seats%rowtype;
  v_reservation public.reservations%rowtype;
  v_old text;
  v_new text;
  v_existing_alert uuid;
begin
  if auth.uid() is null or not public.is_librarian() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_date is null or p_start_time is null or p_person_detected is null then
    raise exception 'INVALID_OBSERVATION';
  end if;
  if p_date < (now() at time zone 'Asia/Taipei')::date
     or p_date > (now() at time zone 'Asia/Taipei')::date+7 then
    raise exception 'DATE_RANGE';
  end if;
  if p_start_time < time '09:00' or p_start_time >= time '21:00'
     or extract(minute from p_start_time)<>0
     or extract(second from p_start_time)<>0 then
    raise exception 'TIME_RANGE';
  end if;
  select * into v_seat from public.seats where id=p_seat_id for update;
  if not found or v_seat.room_code not in ('b1a','b1b','b1c') then
    raise exception 'SEAT_NOT_FOUND';
  end if;
  if not v_seat.is_active then raise exception 'SEAT_DISABLED'; end if;

  select * into v_reservation from public.reservations
   where seat_id=p_seat_id and reservation_date=p_date
     and start_time=p_start_time and status='confirmed'
   for update;

  if not found then
    if not p_person_detected then return 'empty'; end if;
    select id into v_existing_alert
    from public.camera_alerts where seat_id=p_seat_id and status='open';
    if not found then
      insert into public.camera_alerts
        (seat_id,room_code,object_type,observed_date,observed_slot,simulated_by)
      values(p_seat_id,v_seat.room_code,'person',p_date,p_start_time,auth.uid());
    end if;
    return 'anomaly';
  end if;

  select status into v_old from public.reservation_presence
    where reservation_id=v_reservation.id for update;

  if p_person_detected then
    v_new:=case when v_old='away' then 'returned'
                when v_old in ('present','returned') then v_old
                else 'present' end;
  else
    if v_old is null then return 'pending'; end if;
    v_new:=case when v_old in ('present','returned') then 'away' else v_old end;
  end if;

  insert into public.reservation_presence
    (reservation_id,status,simulated_by,last_observed_at)
  values(v_reservation.id,v_new,auth.uid(),now())
  on conflict(reservation_id) do update
  set status=excluded.status,
      simulated_by=excluded.simulated_by,
      last_observed_at=excluded.last_observed_at;
  return v_new;
end $$;

-- 保留既有異常資料，擴充「系統顯示空位，攝影機卻偵測到人」。
alter table public.camera_alerts drop constraint if exists camera_alerts_object_type_check;
alter table public.camera_alerts
  add constraint camera_alerts_object_type_check
  check (object_type in ('bag','books','person'));

-- 不向一般訪客揭露模擬管理員UUID及處理人身分。
revoke select on public.camera_alerts from anon,authenticated;
grant select (id,seat_id,room_code,object_type,status)
  on public.camera_alerts to anon;
grant select (id,seat_id,room_code,object_type,status,
              observed_date,observed_slot,detected_at,resolved_at)
  on public.camera_alerts to authenticated;

revoke all on function public.get_seat_presence(text,date,time) from public;
revoke all on function public.get_my_reservation_presence() from public;
revoke all on function public.simulate_camera_presence(uuid,date,time,boolean) from public;
grant execute on function public.get_seat_presence(text,date,time) to anon,authenticated;
grant execute on function public.get_my_reservation_presence() to authenticated;
grant execute on function public.simulate_camera_presence(uuid,date,time,boolean) to authenticated;

comment on table public.reservation_presence is
  'Simulated seat presence only; pending inferred from booking, present/away/returned from mock camera events. No photos, identity, or automatic cancellation.';

commit;
