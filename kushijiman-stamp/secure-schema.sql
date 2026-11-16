-- 串じまん／炙り家しんいち : Secure stamp backend foundation (NOT DEPLOYED)
-- Apply only to an explicitly chosen dedicated Supabase project, after review.
-- Required: Supabase Auth user accounts for customers/staff.
-- NEVER place service_role keys in GitHub Pages.

begin;
create table if not exists public.kj_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0 check(points between 0 and 10),
  completed_cards integer not null default 0 check(completed_cards >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.kj_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_code text not null check(store_code in ('kushijiman','shinichi')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.kj_stamp_events (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.kj_members(user_id),
  staff_id uuid not null references auth.users(id),
  store_code text not null check(store_code in ('kushijiman','shinichi')),
  action text not null check(action in ('stamp_add')),
  points_change integer not null check(points_change = 1),
  request_id uuid not null unique,
  created_at timestamptz not null default now()
);
create index if not exists kj_stamp_events_member_idx on public.kj_stamp_events(member_id,created_at desc);

alter table public.kj_members enable row level security;
alter table public.kj_staff enable row level security;
alter table public.kj_stamp_events enable row level security;

-- Members may read only their own cards + events; never edit points directly.
revoke all on public.kj_members, public.kj_staff, public.kj_stamp_events from anon, authenticated;
grant select on public.kj_members to authenticated;
grant select on public.kj_stamp_events to authenticated;
drop policy if exists kj_member_read_own on public.kj_members;
create policy kj_member_read_own on public.kj_members for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists kj_event_read_own on public.kj_stamp_events;
create policy kj_event_read_own on public.kj_stamp_events for select to authenticated using ((select auth.uid()) = member_id);

-- Database administrator provisions members and staff.
-- No browser-side insert/update/delete grants. A login does not grant staff access.
-- Explicit narrowly scoped RPC for a single staff-authorized action.
create or replace function public.kj_add_stamp(p_member_id uuid, p_store_code text, p_request_id uuid)
returns table(new_points integer, completed_cards integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_staff_store text;
  v_active boolean;
  v_points integer;
  v_cards integer;
  v_prior_member uuid;
  v_prior_actor uuid;
  v_prior_store text;
begin
  v_actor := (select auth.uid());
  if v_actor is null then raise exception 'login required' using errcode = '42501'; end if;
  if p_request_id is null or p_member_id is null then raise exception 'missing request identifiers'; end if;
  if p_store_code not in ('kushijiman','shinichi') then raise exception 'invalid store'; end if;

  select store_code, active into v_staff_store, v_active
  from public.kj_staff where user_id = v_actor;
  if not found or v_active is distinct from true or v_staff_store is distinct from p_store_code then
    raise exception 'staff permission denied' using errcode = '42501';
  end if;

  -- Serialize updates per member to prevent parallel requests overwriting points.
  select m.points, m.completed_cards into v_points, v_cards
  from public.kj_members m where m.user_id = p_member_id for update;
  if not found then raise exception 'member not found'; end if;

  -- Idempotency for retries: a request UUID can only be applied once.
  select e.member_id, e.staff_id, e.store_code
    into v_prior_member, v_prior_actor, v_prior_store
    from public.kj_stamp_events e where e.request_id = p_request_id;
  if found then
    if v_prior_member is distinct from p_member_id or v_prior_actor is distinct from v_actor
       or v_prior_store is distinct from p_store_code then
      raise exception 'request identifier reused for another operation';
    end if;
    return query select v_points, v_cards;
    return;
  end if;

  if v_points >= 10 then raise exception 'card already full; redeem first'; end if;
  update public.kj_members m set points = m.points + 1 where m.user_id = p_member_id
  returning m.points, m.completed_cards into v_points,v_cards;
  insert into public.kj_stamp_events(member_id,staff_id,store_code,action,points_change,request_id)
  values (p_member_id,v_actor,p_store_code,'stamp_add',1,p_request_id);
  return query select v_points,v_cards;
end $$;
revoke all on function public.kj_add_stamp(uuid,text,uuid) from public, anon;
grant execute on function public.kj_add_stamp(uuid,text,uuid) to authenticated;
commit;

-- Before production:
-- 1. Implement authenticated member registration & verified shop staff provisioning.
-- 2. Add server-authorized 5/10pt redemption & completed-card accounting.
-- 3. Add rate limits, suspicious behavior alerts, admin correction workflow, short-lived QR tokens.
-- 4. Confirm RLS/advisors, negative permission tests, and cross-store test cases.
