-- 커뮤니티 보안·정책 두 건 수정
--   #3 PIN이 base64(가역) + 클라가 pin_hash를 읽어 비교 → devtools에서 PIN 복원 가능
--      → bcrypt 해시 + 서버측 검증 RPC. 클라는 더 이상 PIN 비교를 하지 않는다.
--   #4 3회 방출 영구차단이 발동 안 함 — kick이 kick_count가 든 멤버십 행을 DELETE해 카운트 소멸
--      → 멤버십 삭제와 무관하게 살아남는 영구 flags 테이블 + kick RPC.

create extension if not exists pgcrypto with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- 0. requires_pin 컬럼 (해시를 못 읽어도 "PIN 필요 여부"를 알 수 있게)
--    기존 값 기준으로 백필: 해시가 btoa('0000')='MDAwMA=='가 아니면 PIN 있음.
-- ─────────────────────────────────────────────────────────────
alter table public.communities add column if not exists requires_pin boolean not null default true;
update public.communities set requires_pin = (pin_hash is distinct from 'MDAwMA==');

-- ─────────────────────────────────────────────────────────────
-- 1. 기존 pin_hash(base64) → bcrypt 로 이관 (이미 bcrypt면 건너뜀)
--    btoa(pin)을 디코드해 평문 PIN을 얻은 뒤 bcrypt.
-- ─────────────────────────────────────────────────────────────
update public.communities
set pin_hash = extensions.crypt(convert_from(decode(pin_hash, 'base64'), 'utf8'), extensions.gen_salt('bf'))
where pin_hash is not null
  and pin_hash !~ '^\$2[aby]\$';

-- 이후 INSERT/UPDATE 시 평문 PIN을 자동으로 bcrypt (클라는 평문을 보낸다 → 절대 평문 저장 안 됨)
create or replace function public.hash_community_pin()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.pin_hash is not null and new.pin_hash !~ '^\$2[aby]\$' then
    new.pin_hash := extensions.crypt(new.pin_hash, extensions.gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_community_pin on public.communities;
create trigger trg_hash_community_pin
  before insert or update of pin_hash on public.communities
  for each row execute function public.hash_community_pin();

-- ─────────────────────────────────────────────────────────────
-- 2. 영구 방출/차단 기록 — 멤버십 행이 삭제돼도 살아남는다
-- ─────────────────────────────────────────────────────────────
create table if not exists public.community_member_flags (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kick_count   int  not null default 0,
  is_banned    boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_member_flags enable row level security;
-- 본인 기록만 읽기(차단 여부 확인용). 쓰기는 SECURITY DEFINER RPC만.
drop policy if exists "own flags read" on public.community_member_flags;
create policy "own flags read" on public.community_member_flags
  for select using (user_id = auth.uid());

-- 기존 community_members에 남아있던 kick_count/is_banned 이관
insert into public.community_member_flags (community_id, user_id, kick_count, is_banned)
select community_id, user_id, kick_count, is_banned
from public.community_members
where kick_count > 0 or is_banned = true
on conflict (community_id, user_id) do update
  set kick_count = greatest(public.community_member_flags.kick_count, excluded.kick_count),
      is_banned  = public.community_member_flags.is_banned or excluded.is_banned;

-- ─────────────────────────────────────────────────────────────
-- 3. PIN 검증 RPC (bookshelf 게이트 등) — 해시를 클라로 보내지 않는다
-- ─────────────────────────────────────────────────────────────
create or replace function public.verify_community_pin(p_community_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text; begin
  select pin_hash into v_hash from public.communities where id = p_community_id;
  return v_hash is not null and v_hash = extensions.crypt(p_pin, v_hash);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. PIN 검증 + 가입 RPC — 차단(flags) 확인, PIN 검증, 멤버십 생성까지 서버측
--    반환: 'ok'|'wrong_pin'|'already_member'|'banned'|'not_found'|'auth'
-- ─────────────────────────────────────────────────────────────
create or replace function public.join_community_with_pin(p_community_id uuid, p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text; v_requires boolean; v_banned boolean;
begin
  if auth.uid() is null then return 'auth'; end if;
  select pin_hash, requires_pin into v_hash, v_requires
    from public.communities where id = p_community_id;
  if not found then return 'not_found'; end if;

  select is_banned into v_banned from public.community_member_flags
    where community_id = p_community_id and user_id = auth.uid();
  if coalesce(v_banned, false) then return 'banned'; end if;

  if exists (select 1 from public.community_members
             where community_id = p_community_id and user_id = auth.uid() and is_banned = false) then
    return 'already_member';
  end if;

  if coalesce(v_requires, true) then
    if v_hash is null or v_hash <> extensions.crypt(p_pin, v_hash) then
      return 'wrong_pin';
    end if;
  end if;

  insert into public.community_members (community_id, user_id, role)
  values (p_community_id, auth.uid(), 'member')
  on conflict (community_id, user_id) do update set is_banned = false, role = 'member';
  return 'ok';
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. 방출/차단 RPC — 소유자만. kick_count를 flags에 영구 기록, 3회면 자동 영구차단.
--    반환: 'kicked'|'banned'|'forbidden'|'not_found'|'cannot_kick_owner'
-- ─────────────────────────────────────────────────────────────
create or replace function public.kick_community_member(
  p_community_id uuid, p_user_id uuid, p_ban boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid; v_new_count int; v_banned boolean;
begin
  select created_by into v_owner from public.communities where id = p_community_id;
  if v_owner is null then return 'not_found'; end if;
  if v_owner <> auth.uid() then return 'forbidden'; end if;
  if p_user_id = v_owner then return 'cannot_kick_owner'; end if;

  insert into public.community_member_flags (community_id, user_id, kick_count, is_banned)
  values (p_community_id, p_user_id, 1, p_ban)
  on conflict (community_id, user_id) do update
    set kick_count = public.community_member_flags.kick_count + 1,
        is_banned  = public.community_member_flags.is_banned or p_ban,
        updated_at = now()
  returning kick_count, is_banned into v_new_count, v_banned;

  if v_new_count >= 3 and not v_banned then
    update public.community_member_flags set is_banned = true, updated_at = now()
      where community_id = p_community_id and user_id = p_user_id;
    v_banned := true;
  end if;

  delete from public.community_members
    where community_id = p_community_id and user_id = p_user_id;

  return case when v_banned then 'banned' else 'kicked' end;
end;
$$;

grant execute on function public.verify_community_pin(uuid, text)      to authenticated;
grant execute on function public.join_community_with_pin(uuid, text)   to authenticated;
grant execute on function public.kick_community_member(uuid, uuid, boolean) to authenticated;

-- 6. pin_hash 는 이제 클라가 읽을 필요가 없다 → 컬럼 SELECT 권한 회수(해시 유출 자체를 차단)
revoke select (pin_hash) on public.communities from anon, authenticated;
