-- Slice 1 — identity core: tenants, users, roles, memberships, invitations.
-- Conventions (TURN1-SPEC §3): tenant_id on every tenant-owned table, uuid v7 ids,
-- created_at/updated_at, deleted_at soft delete, rev int for optimistic concurrency.

-- Supabase pre-creates the `extensions` schema; pin extensions there explicitly
-- so security-definer functions below can call them without depending on search_path.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- uuid v7: time-ordered ids so index locality holds as tenants grow.
create or replace function public.uuid_generate_v7()
returns uuid
language plpgsql
parallel safe
as $$
declare
  unix_ts_ms bytea;
  uuid_bytes bytea;
begin
  unix_ts_ms := substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
  uuid_bytes := unix_ts_ms || extensions.gen_random_bytes(10);
  -- version 7
  uuid_bytes := set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
  -- variant 10xx
  uuid_bytes := set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
  return encode(uuid_bytes, 'hex')::uuid;
end
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.rev := old.rev + 1;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default public.uuid_generate_v7(),
  name text not null check (length(trim(name)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$'),
  vocabulary jsonb not null default '{}'::jsonb,
  capabilities jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  rev int not null default 1
);

create trigger tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- users — profile mirror of auth.users (global, not tenant-scoped)
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rev int not null default 1
);

create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- roles — permission bundles, per tenant
-- ---------------------------------------------------------------------------

create table public.roles (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  permissions jsonb not null default '[]'::jsonb,
  field_gates jsonb not null default '{}'::jsonb,
  landing_view text not null default 'today',
  is_owner boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  rev int not null default 1,
  unique (tenant_id, name)
);

create index roles_tenant_idx on public.roles (tenant_id) where deleted_at is null;
-- exactly one owner role per tenant; the brief forbids editing it away
create unique index roles_one_owner_per_tenant on public.roles (tenant_id) where is_owner and deleted_at is null;

create trigger roles_touch before update on public.roles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- memberships — one human, many companies
-- ---------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'deactivated')),
  landing_view text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  rev int not null default 1,
  unique (tenant_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id) where deleted_at is null;
create index memberships_tenant_idx on public.memberships (tenant_id) where deleted_at is null;

create trigger memberships_touch before update on public.memberships
  for each row execute function public.touch_updated_at();

-- role must belong to the same tenant as the membership
create or replace function public.assert_role_tenant_match()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.roles r
    where r.id = new.role_id and r.tenant_id = new.tenant_id
  ) then
    raise exception 'role % does not belong to tenant %', new.role_id, new.tenant_id;
  end if;
  return new;
end
$$;

create trigger memberships_role_tenant_match
  before insert or update of role_id, tenant_id on public.memberships
  for each row execute function public.assert_role_tenant_match();

-- ---------------------------------------------------------------------------
-- invitations — a staff account is always born from one of these
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email extensions.citext not null,
  name text,
  role_id uuid not null references public.roles(id) on delete restrict,
  token_hash text not null unique,
  invited_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rev int not null default 1
);

create index invitations_tenant_idx on public.invitations (tenant_id);
-- one live invite per email per tenant
create unique index invitations_one_pending_per_email
  on public.invitations (tenant_id, email)
  where accepted_at is null and revoked_at is null;

create trigger invitations_touch before update on public.invitations
  for each row execute function public.touch_updated_at();

create trigger invitations_role_tenant_match
  before insert or update of role_id, tenant_id on public.invitations
  for each row execute function public.assert_role_tenant_match();

-- ---------------------------------------------------------------------------
-- auth event audit — every auth event is audited (brief §2B)
-- ---------------------------------------------------------------------------

create table public.auth_events (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index auth_events_tenant_idx on public.auth_events (tenant_id, created_at desc);
