-- ── Backfill agency_id for records created before the agency system ──────────
-- Run once: sets agency_id on existing rows whose owner is now linked to an agency.

UPDATE public.clients c    SET agency_id = p.agency_id FROM public.profiles p
  WHERE c.owner_id = p.id AND c.agency_id IS NULL AND p.agency_id IS NOT NULL;

UPDATE public.projects pr  SET agency_id = p.agency_id FROM public.profiles p
  WHERE pr.owner_id = p.id AND pr.agency_id IS NULL AND p.agency_id IS NOT NULL;

UPDATE public.tasks t      SET agency_id = p.agency_id FROM public.profiles p
  WHERE t.owner_id = p.id AND t.agency_id IS NULL AND p.agency_id IS NOT NULL;

UPDATE public.kpis k       SET agency_id = p.agency_id FROM public.profiles p
  WHERE k.owner_id = p.id AND k.agency_id IS NULL AND p.agency_id IS NOT NULL;

UPDATE public.departments d SET agency_id = p.agency_id FROM public.profiles p
  WHERE d.owner_id = p.id AND d.agency_id IS NULL AND p.agency_id IS NOT NULL;

UPDATE public.pitches pi   SET agency_id = p.agency_id FROM public.profiles p
  WHERE pi.owner_id = p.id AND pi.agency_id IS NULL AND p.agency_id IS NOT NULL;

-- ── RPC: claim pre-existing data records for the calling user's agency ────────
create or replace function public.claim_agency_data()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_agency_id uuid;
begin
  select agency_id into v_agency_id from profiles where id = auth.uid();
  if v_agency_id is null then return; end if;

  update clients     set agency_id = v_agency_id where owner_id = auth.uid() and agency_id is null;
  update projects    set agency_id = v_agency_id where owner_id = auth.uid() and agency_id is null;
  update tasks       set agency_id = v_agency_id where owner_id = auth.uid() and agency_id is null;
  update kpis        set agency_id = v_agency_id where owner_id = auth.uid() and agency_id is null;
  update departments set agency_id = v_agency_id where owner_id = auth.uid() and agency_id is null;
  update pitches     set agency_id = v_agency_id where owner_id = auth.uid() and agency_id is null;
end;
$$;

-- ── Update create_agency to auto-claim pre-existing data ─────────────────────
create or replace function public.create_agency(p_name text, p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_agency_id uuid;
  v_uid uuid := auth.uid();
begin
  if exists (select 1 from agencies where code = upper(p_code)) then
    raise exception 'Agency code already in use. Please try a different code.';
  end if;

  insert into agencies (name, code, owner_id)
  values (p_name, upper(p_code), v_uid)
  returning id into v_agency_id;

  update profiles    set agency_id = v_agency_id where id = v_uid;

  update clients     set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update projects    set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update tasks       set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update kpis        set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update departments set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update pitches     set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;

  return v_agency_id;
end;
$$;

-- ── Update join_agency to auto-claim pre-existing data ───────────────────────
create or replace function public.join_agency(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_agency_id uuid;
  v_uid uuid := auth.uid();
begin
  select id into v_agency_id from agencies where code = upper(p_code);

  if v_agency_id is null then
    raise exception 'Agency code not found. Please check the code and try again.';
  end if;

  update profiles    set agency_id = v_agency_id where id = v_uid;

  update clients     set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update projects    set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update tasks       set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update kpis        set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update departments set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;
  update pitches     set agency_id = v_agency_id where owner_id = v_uid and agency_id is null;

  return v_agency_id;
end;
$$;
