-- Slice 1 — RLS on every identity table.
-- Isolation rule: a row is reachable only if the caller holds an active membership
-- in that row's tenant. Enforced at the data layer, per brief §2 — never by hiding UI.

-- Membership lookup is security definer so policies on memberships do not recurse
-- into themselves. search_path pinned: this function runs with elevated rights.
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.deleted_at is null
$$;

create or replace function public.is_tenant_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = target
      and m.status = 'active'
      and m.deleted_at is null
  )
$$;

-- Permission check: does the caller hold `perm` in `target` tenant, via their role?
-- Owner roles hold everything (their completeness is not editable — brief §3.2).
create or replace function public.has_permission(target uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.tenant_id = target
      and m.status = 'active'
      and m.deleted_at is null
      and r.deleted_at is null
      and (r.is_owner or r.permissions ? perm)
  )
$$;

revoke execute on function public.current_tenant_ids() from public, anon;
revoke execute on function public.is_tenant_member(uuid) from public, anon;
revoke execute on function public.has_permission(uuid, text) from public, anon;
grant execute on function public.current_tenant_ids() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.auth_events enable row level security;

alter table public.tenants force row level security;
alter table public.users force row level security;
alter table public.roles force row level security;
alter table public.memberships force row level security;
alter table public.invitations force row level security;
alter table public.auth_events force row level security;

-- tenants ------------------------------------------------------------------
create policy tenants_select_own on public.tenants
  for select to authenticated
  using (deleted_at is null and public.is_tenant_member(id));

create policy tenants_update_settings on public.tenants
  for update to authenticated
  using (deleted_at is null and public.has_permission(id, 'tenant.settings'))
  with check (public.has_permission(id, 'tenant.settings'));

-- Tenant creation goes through create_tenant() (security definer, below):
-- a bare insert has no membership yet, so no policy can authorise it.

-- users --------------------------------------------------------------------
-- You can see yourself, and anyone you share an active tenant with.
create policy users_select_self_or_colleague on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on theirs.tenant_id = mine.tenant_id
      where mine.user_id = auth.uid()
        and mine.status = 'active' and mine.deleted_at is null
        and theirs.user_id = public.users.id
        and theirs.status = 'active' and theirs.deleted_at is null
    )
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- roles --------------------------------------------------------------------
create policy roles_select_own_tenant on public.roles
  for select to authenticated
  using (deleted_at is null and public.is_tenant_member(tenant_id));

create policy roles_insert_manage on public.roles
  for insert to authenticated
  with check (public.has_permission(tenant_id, 'roles.manage') and not is_owner);

create policy roles_update_manage on public.roles
  for update to authenticated
  using (deleted_at is null and public.has_permission(tenant_id, 'roles.manage') and not is_system)
  with check (public.has_permission(tenant_id, 'roles.manage') and not is_system);

-- memberships --------------------------------------------------------------
create policy memberships_select_own_tenant on public.memberships
  for select to authenticated
  using (
    deleted_at is null
    and (user_id = auth.uid() or public.is_tenant_member(tenant_id))
  );

create policy memberships_update_manage on public.memberships
  for update to authenticated
  using (deleted_at is null and public.has_permission(tenant_id, 'members.manage'))
  with check (public.has_permission(tenant_id, 'members.manage'));

-- invitations --------------------------------------------------------------
-- Invitees are anonymous until they accept; acceptance runs through
-- accept_invitation() (security definer). Nothing here is readable by anon.
create policy invitations_select_manage on public.invitations
  for select to authenticated
  using (public.has_permission(tenant_id, 'members.manage'));

create policy invitations_insert_manage on public.invitations
  for insert to authenticated
  with check (public.has_permission(tenant_id, 'members.manage'));

create policy invitations_update_manage on public.invitations
  for update to authenticated
  using (public.has_permission(tenant_id, 'members.manage'))
  with check (public.has_permission(tenant_id, 'members.manage'));

-- auth_events --------------------------------------------------------------
create policy auth_events_select_audit on public.auth_events
  for select to authenticated
  using (
    tenant_id is not null
    and public.has_permission(tenant_id, 'audit.view')
  );
-- Writes are server-side only (service role bypasses RLS); no insert policy exists.
