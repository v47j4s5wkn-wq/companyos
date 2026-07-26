-- Slice 1 — identity RPCs: tenant creation, invitation issue/revoke/accept.
-- These are security definer because each performs a step no policy can authorise
-- on its own (creating the first membership, reading an invitation pre-membership).
-- Every one re-checks the caller's rights explicitly before it writes.

-- Default role bundles, TURN1-SPEC §6. Permissions are `entity.action.scope`.
create or replace function public.default_role_bundles()
returns jsonb
language sql
immutable
as $$
  select '[
    {
      "name": "Owner",
      "is_owner": true,
      "landing_view": "vitals",
      "permissions": ["*.*.all"],
      "field_gates": {
        "money.costs.view": true,
        "money.margin.view": true,
        "people.pay.view": true,
        "mailbox.personal.access": true
      }
    },
    {
      "name": "Office",
      "is_owner": false,
      "landing_view": "pipeline",
      "permissions": [
        "contact.view.all", "contact.create.all", "contact.edit.all",
        "lead.view.all", "lead.create.all", "lead.edit.all",
        "proposal.view.all", "proposal.create.all", "proposal.edit.all",
        "workItem.view.all", "workItem.create.all", "workItem.edit.all",
        "invoice.view.all", "invoice.create.all", "invoice.edit.all",
        "payment.view.all", "payment.create.all",
        "expense.view.all", "expense.create.all",
        "calendar.manage.all", "checklist.manage.all", "stock.manage.all",
        "document.manage.all", "report.view.all"
      ],
      "field_gates": {
        "money.costs.view": true,
        "money.margin.view": true,
        "people.pay.view": false,
        "mailbox.personal.access": false
      }
    },
    {
      "name": "Field",
      "is_owner": false,
      "landing_view": "today",
      "permissions": [
        "workItem.view.assigned", "workItem.progress.assigned",
        "checklist.complete.assigned",
        "variation.propose.assigned",
        "calendar.view.own",
        "timesheet.create.own",
        "expense.create.own",
        "contact.view.assigned"
      ],
      "field_gates": {
        "money.costs.view": false,
        "money.margin.view": false,
        "people.pay.view": false,
        "mailbox.personal.access": false
      }
    },
    {
      "name": "Manager",
      "is_owner": false,
      "landing_view": "today",
      "permissions": [
        "workItem.view.team", "workItem.progress.assigned",
        "checklist.complete.assigned",
        "variation.propose.assigned",
        "calendar.view.own",
        "timesheet.create.own", "timesheet.approve.team",
        "expense.create.own",
        "contact.view.assigned",
        "rota.manage.team", "holiday.approve.team"
      ],
      "field_gates": {
        "money.costs.view": false,
        "money.margin.view": false,
        "people.pay.view": false,
        "mailbox.personal.access": false
      }
    }
  ]'::jsonb
$$;

-- Slugs are tenant-visible in URLs; collisions resolve by numeric suffix.
create or replace function public.slugify_tenant_name(p_name text)
returns text
language plpgsql
stable
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  base := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  base := left(base, 50);
  if base = '' then
    base := 'company';
  end if;
  candidate := base;
  while exists (select 1 from public.tenants t where t.slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end
$$;

-- ---------------------------------------------------------------------------
-- create_tenant — the "Get started" path. Caller becomes Owner.
-- Genesis (Slice 4) will replace the bare vocabulary/capabilities defaults.
-- ---------------------------------------------------------------------------
create or replace function public.create_tenant(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_owner_role uuid;
  bundle jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'company name required' using errcode = '22023';
  end if;

  insert into public.tenants (name, slug)
  values (trim(p_name), public.slugify_tenant_name(p_name))
  returning id into v_tenant;

  for bundle in select * from jsonb_array_elements(public.default_role_bundles()) loop
    insert into public.roles (tenant_id, name, permissions, field_gates, landing_view, is_owner, is_system)
    values (
      v_tenant,
      bundle ->> 'name',
      bundle -> 'permissions',
      bundle -> 'field_gates',
      bundle ->> 'landing_view',
      (bundle ->> 'is_owner')::boolean,
      true
    )
    returning id into v_owner_role;

    if (bundle ->> 'is_owner')::boolean then
      insert into public.memberships (tenant_id, user_id, role_id)
      values (v_tenant, v_user, v_owner_role);
    end if;
  end loop;

  insert into public.auth_events (tenant_id, user_id, kind, detail)
  values (v_tenant, v_user, 'tenant.created', jsonb_build_object('name', trim(p_name)));

  return v_tenant;
end
$$;

-- ---------------------------------------------------------------------------
-- create_invitation — returns the raw token exactly once; only the hash is stored.
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_tenant_id uuid,
  p_email extensions.citext,
  p_role_id uuid,
  p_name text default null,
  p_ttl interval default interval '7 days'
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_permission(p_tenant_id, 'members.manage') then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'valid email required' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.memberships m
    join public.users u on u.id = m.user_id
    where m.tenant_id = p_tenant_id and u.email = p_email and m.deleted_at is null
  ) then
    raise exception 'already a member of this company' using errcode = '23505';
  end if;

  -- 128-bit token, base64url, never stored in the clear
  v_token := replace(replace(encode(extensions.gen_random_bytes(16), 'base64'), '+', '-'), '/', '_');
  v_token := rtrim(v_token, '=');

  insert into public.invitations (tenant_id, email, name, role_id, token_hash, invited_by, expires_at)
  values (
    p_tenant_id, p_email, nullif(trim(coalesce(p_name, '')), ''), p_role_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user, now() + p_ttl
  )
  returning id into v_id;

  insert into public.auth_events (tenant_id, user_id, kind, detail)
  values (p_tenant_id, v_user, 'invitation.created', jsonb_build_object('email', p_email, 'invitation_id', v_id));

  return query select v_id, v_token;
end
$$;

-- ---------------------------------------------------------------------------
-- revoke_invitation
-- ---------------------------------------------------------------------------
create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.invitations where id = p_invitation_id;

  if v_tenant is null or not public.has_permission(v_tenant, 'members.manage') then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  update public.invitations
  set revoked_at = now()
  where id = p_invitation_id and accepted_at is null and revoked_at is null;

  insert into public.auth_events (tenant_id, user_id, kind, detail)
  values (v_tenant, v_user, 'invitation.revoked', jsonb_build_object('invitation_id', p_invitation_id));
end
$$;

-- ---------------------------------------------------------------------------
-- accept_invitation — the only way a staff membership is ever born.
-- Caller must already be authenticated AND their verified email must match the
-- invitation, so a leaked token alone grants nothing.
-- ---------------------------------------------------------------------------
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
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();

  if v_inv.id is null then
    raise exception 'invitation is invalid or has expired' using errcode = '22023';
  end if;

  if v_email is null or v_email <> v_inv.email then
    raise exception 'this invitation was sent to a different email address' using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- deactivate_membership — offboarding is one action (brief §2B).
-- History is retained; the human's records stay under company ownership.
-- ---------------------------------------------------------------------------
create or replace function public.deactivate_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_is_owner boolean;
begin
  select m.tenant_id, r.is_owner into v_tenant, v_is_owner
  from public.memberships m
  join public.roles r on r.id = m.role_id
  where m.id = p_membership_id;

  if v_tenant is null or not public.has_permission(v_tenant, 'members.manage') then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  if v_is_owner then
    raise exception 'the owner membership cannot be deactivated' using errcode = '42501';
  end if;

  update public.memberships set status = 'deactivated' where id = p_membership_id;

  insert into public.auth_events (tenant_id, user_id, kind, detail)
  values (v_tenant, v_user, 'membership.deactivated', jsonb_build_object('membership_id', p_membership_id));
end
$$;

-- ---------------------------------------------------------------------------
-- Mirror auth.users into public.users on signup so profiles exist immediately.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Callable surface: authenticated only.
revoke execute on function public.create_tenant(text) from public, anon;
revoke execute on function public.create_invitation(uuid, extensions.citext, uuid, text, interval) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
revoke execute on function public.deactivate_membership(uuid) from public, anon;
revoke execute on function public.default_role_bundles() from public, anon;

grant execute on function public.create_tenant(text) to authenticated;
grant execute on function public.create_invitation(uuid, extensions.citext, uuid, text, interval) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.deactivate_membership(uuid) to authenticated;
