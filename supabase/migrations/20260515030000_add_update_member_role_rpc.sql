-- RPC to update a member's role within the same agency.
-- Runs as security definer (bypasses RLS) but enforces same-agency check internally.
create or replace function public.update_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Caller must be in the same agency as the target user
  if not exists (
    select 1 from public.profiles
    where id = p_user_id
      and agency_id = (select agency_id from public.profiles where id = auth.uid())
  ) then
    raise exception 'Not authorized: member is not in your agency';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.update_member_role(uuid, text) to authenticated;
