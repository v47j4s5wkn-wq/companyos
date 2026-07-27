-- Fix: acceptance logic had two owners (the accept-invitation Edge Function
-- duplicated membership creation, then the client's accept_invitation() call
-- failed on the already-accepted invite). The RPC is now the single owner of
-- acceptance; the Edge Function only verifies the invite and creates the
-- confirmed auth user. Two changes here:
--
-- 1. The token lookup no longer excludes accepted invitations up front —
--    instead, an invitation already accepted by THIS caller returns its
--    tenant_id as a no-op success (idempotent re-accept; also covers a user
--    refreshing the accept page after success). Accepted-by-anyone-else and
--    revoked/expired still refuse.
-- 2. Expiry is checked against accepted_at when set, so a valid acceptance
--    never turns into an error later merely because time passed.

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_email extensions.citext := nullif(auth.jwt() ->> 'email', '')::extensions.citext;
  v_inv public.invitations%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_inv
  from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and revoked_at is null;

  if v_inv.id is null then
    raise exception 'invitation is invalid or has expired' using errcode = '22023';
  end if;

  if v_email is null or v_email <> v_inv.email then
    raise exception 'this invitation was sent to a different email address' using errcode = '42501';
  end if;

  -- Already accepted: fine if it was this same person (idempotent), refused otherwise.
  if v_inv.accepted_at is not null then
    if exists (
      select 1 from public.memberships m
      where m.tenant_id = v_inv.tenant_id
        and m.user_id = v_user
        and m.status = 'active'
        and m.deleted_at is null
    ) then
      return v_inv.tenant_id;
    end if;
    raise exception 'invitation is invalid or has expired' using errcode = '22023';
  end if;

  if v_inv.expires_at <= now() then
    raise exception 'invitation is invalid or has expired' using errcode = '22023';
  end if;

  insert into public.users (id, email, name)
  values (v_user, v_email, v_inv.name)
  on conflict (id) do update
    set name = coalesce(public.users.name, excluded.name);

  insert into public.memberships (tenant_id, user_id, role_id)
  values (v_inv.tenant_id, v_user, v_inv.role_id)
  on conflict (tenant_id, user_id) do update
    set status = 'active', deleted_at = null, role_id = excluded.role_id;

  update public.invitations set accepted_at = now() where id = v_inv.id;

  insert into public.auth_events (tenant_id, user_id, kind, detail)
  values (v_inv.tenant_id, v_user, 'invitation.accepted', jsonb_build_object('invitation_id', v_inv.id));

  return v_inv.tenant_id;
end
$$;
