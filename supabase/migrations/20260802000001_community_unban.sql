-- 방장이 방출/차단된 멤버를 확인하고 '재가입 허용'(방출·차단 기록 초기화)할 수 있게.
-- community_member_flags는 본인만 SELECT 가능(own flags read)이라, 방장이 목록을 보려면 RPC가 필요.

-- 방장이 자기 커뮤니티의 방출/차단 멤버 목록을 본다.
create or replace function public.list_banned_members(p_community_id uuid)
returns table(user_id uuid, nickname text, avatar_url text, kick_count int, is_banned boolean)
language sql
security definer
set search_path = public
as $$
  select f.user_id, p.nickname, p.avatar_url, f.kick_count, f.is_banned
  from public.community_member_flags f
  join public.profiles p on p.id = f.user_id
  where f.community_id = p_community_id
    and (f.is_banned or f.kick_count > 0)
    and exists (
      select 1 from public.communities c
      where c.id = p_community_id and c.created_by = auth.uid()
    )
  order by f.updated_at desc;
$$;

-- 방장이 특정 멤버의 방출·차단 기록을 초기화(재가입 허용). flags 행 삭제 = kick_count 0 + is_banned false.
create or replace function public.unban_community_member(p_community_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select created_by into v_owner from public.communities where id = p_community_id;
  if v_owner is null then return 'not_found'; end if;
  if v_owner <> auth.uid() then return 'forbidden'; end if;
  delete from public.community_member_flags where community_id = p_community_id and user_id = p_user_id;
  return 'ok';
end;
$$;

grant execute on function public.list_banned_members(uuid)          to authenticated;
grant execute on function public.unban_community_member(uuid, uuid) to authenticated;
