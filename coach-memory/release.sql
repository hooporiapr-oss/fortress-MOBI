-- ============================================================================
-- COACH MEMORY — RELEASE SQL (run once, as a whole, in Supabase → SQL Editor)
-- Built from the reviewed drafts; every statement below was applied and tested on a
-- disposable PostgreSQL. It creates:
--   public.athlete_identity*        verified athlete identities and memberships (no names)
--   coach_memory_private.*          grants, append-only events, enrollment approvals/receipts
--   coach_memory_executor/backend   NOLOGIN roles the trusted server acts through
--   public.cm_admin_*               License Admin operations (enroll, label, grant/revoke coach)
-- Nothing is granted to anon or authenticated except the cm_admin_* functions, which
-- require public.is_admin(). No existing table is altered. Re-running fails at
-- "role already exists" on purpose: it is not meant to run twice.
-- ============================================================================

-- ---- athlete-identity-draft.sql ----
-- DEVELOPMENT CANDIDATE ONLY. Do not apply to hosted database without review.
-- No legacy tables altered and no historical data copied by this schema.
begin;
create table public.athlete_identity (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now()
);
create table public.athlete_identity_access (
 athlete_id uuid not null references public.athlete_identity(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 access_role text not null check(access_role in ('athlete','guardian')),
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key(athlete_id,user_id)
);
create table public.athlete_identity_membership (
 id uuid primary key default gen_random_uuid(),
 athlete_id uuid not null references public.athlete_identity(id) on delete restrict,
 program_key text not null check(length(trim(program_key))>0),
 team_key text,
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 check(ends_at is null or ends_at>=starts_at)
);
create table public.athlete_identity_record_link (
 source_table text not null check(source_table in ('hooporia_mobi_runs','vr_mobile_standings','vr_reaction_speed_standings')),
 source_id bigint not null,
 athlete_id uuid not null references public.athlete_identity(id) on delete restrict,
 verified_at timestamptz not null default now(),
 verified_by uuid not null references auth.users(id) on delete restrict,
 primary key(source_table,source_id)
);
-- No public writes; trusted enrollment/linking must be implemented and separately audited.
alter table public.athlete_identity enable row level security;
alter table public.athlete_identity_access enable row level security;
alter table public.athlete_identity_membership enable row level security;
alter table public.athlete_identity_record_link enable row level security;
revoke all on public.athlete_identity,public.athlete_identity_access,public.athlete_identity_membership,public.athlete_identity_record_link from public,anon,authenticated;
grant select on public.athlete_identity,public.athlete_identity_access to authenticated;
create policy athlete_access_self on public.athlete_identity_access for select to authenticated using (user_id=(select auth.uid()) and revoked_at is null);
create policy athlete_identity_self on public.athlete_identity for select to authenticated using (exists(select 1 from public.athlete_identity_access a where a.athlete_id=athlete_identity.id and a.user_id=(select auth.uid()) and a.revoked_at is null));
-- Membership and source links deliberately inaccessible to browser roles.
-- No coach bypass, name lookup, public linking endpoint or parent self-claim.
commit;

-- ---- coach-memory-draft.sql ----
-- DEVELOPMENT DRAFT ONLY. Depends on athlete-identity-draft.sql.
-- Not a production migration. No browser access until verified enrollment and authorization are implemented.
begin;
create schema if not exists coach_memory_private;
revoke all on schema coach_memory_private from public,anon,authenticated;
create table coach_memory_private.coach_grant (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 membership_id uuid not null references public.athlete_identity_membership(id) on delete restrict,
 granted_by uuid not null references auth.users(id) on delete restrict,
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 check(revoked_at is null or revoked_at>=granted_at),
 unique(id,membership_id,user_id)
);
create unique index coach_memory_active_grant on coach_memory_private.coach_grant(user_id,membership_id) where revoked_at is null;
create table coach_memory_private.event (
 id uuid primary key default gen_random_uuid(),
 membership_id uuid not null references public.athlete_identity_membership(id) on delete restrict,
 author_id uuid not null references auth.users(id) on delete restrict,
 grant_id uuid not null,
 kind text not null check(kind in ('bpm_confirmation','training_plan','goal','cycle_evaluation','coaching_decision','correction')),
 schema_version smallint not null default 1 check(schema_version=1),
 recorded_at timestamptz not null default now(),
 effective_on date not null,
 request_id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=32768),
 supersedes_id uuid,
 unique(id,membership_id),
 unique(author_id,request_id),
 foreign key(grant_id,membership_id,author_id) references coach_memory_private.coach_grant(id,membership_id,user_id) on delete restrict,
 foreign key(supersedes_id,membership_id) references coach_memory_private.event(id,membership_id) on delete restrict,
 check((kind='correction')=(supersedes_id is not null))
);
create index coach_memory_event_membership_time on coach_memory_private.event(membership_id,recorded_at desc,id);
alter table coach_memory_private.coach_grant enable row level security;
alter table coach_memory_private.event enable row level security;
revoke all on all tables in schema coach_memory_private from public,anon,authenticated;
-- Default-deny: no browser policies or RPC endpoints. No direct client grants.
-- Future trusted backend must verify authenticated user, active membership/grant, scope,
-- payload schema, source ownership, idempotency, and revocation on EVERY request.
-- Append-only via trusted backend; no update/delete API. Corrections are new events.
-- No service-role credential in browser. Do not store coach codes, device keys, names or health notes.
commit;

-- ---- access-control-draft.sql ----
-- DEVELOPMENT ONLY. Apply solely to an isolated test database after identity and memory drafts.
begin;
create table coach_memory_private.admin_grant (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 program_key text not null check(length(trim(program_key))>0),
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 check(revoked_at is null or revoked_at>=granted_at)
);
create unique index admin_grant_active on coach_memory_private.admin_grant(user_id,program_key) where revoked_at is null;
alter table coach_memory_private.admin_grant enable row level security;
revoke all on coach_memory_private.admin_grant from public,anon,authenticated;
-- Internal invoker helpers: deliberately not executable by browser roles.
-- The future trusted backend must supply the actor from a verified, non-anonymous session,
-- never from the request body, and check permissions in the same transaction as the action.
create function coach_memory_private.can_manage_program(actor uuid, target_program text)
returns boolean language sql stable security invoker set search_path='' as $$
 select actor is not null and exists (
 select 1 from coach_memory_private.admin_grant g where g.user_id=actor
 and g.program_key=target_program and g.revoked_at is null and g.granted_at<=now());
$$;
create function coach_memory_private.can_access_memory(actor uuid, target_membership uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select actor is not null and exists (
 select 1 from coach_memory_private.coach_grant g
 join public.athlete_identity_membership m on m.id=g.membership_id
 where g.user_id=actor and m.id=target_membership and g.revoked_at is null
 and g.granted_at<=now() and m.starts_at<=now() and (m.ends_at is null or m.ends_at>now()));
$$;
create function coach_memory_private.can_access_athlete(actor uuid, target_athlete uuid, requested_role text)
returns boolean language sql stable security invoker set search_path='' as $$
 select actor is not null and requested_role in ('athlete','guardian') and exists (
 select 1 from public.athlete_identity_access a where a.user_id=actor
 and a.athlete_id=target_athlete and a.access_role=requested_role
 and a.granted_at<=now() and a.revoked_at is null);
$$;
revoke all on function coach_memory_private.can_manage_program(uuid,text),coach_memory_private.can_access_memory(uuid,uuid),coach_memory_private.can_access_athlete(uuid,uuid,text) from public,anon,authenticated;
-- No grants to client roles; no endpoints; no automatic admin access to memory.
-- Bootstrap administrator only through trusted operator procedure, never self-registration.
commit;

-- ---- enrollment-transaction-draft.sql ----
-- DEVELOPMENT ONLY: private transaction prototype, not a deployed endpoint.
-- Apply after identity, memory and access-control drafts in isolated testing.
begin;
create table coach_memory_private.enrollment_approval (
 id uuid primary key default gen_random_uuid(),
 program_key text not null check(length(trim(program_key)) between 1 and 200),
 approved_by uuid not null references auth.users(id) on delete restrict,
 athlete_user_id uuid references auth.users(id) on delete restrict,
 guardian_user_id uuid references auth.users(id) on delete restrict,
 approved_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check(expires_at>approved_at),
 check(athlete_user_id is null or guardian_user_id is null or athlete_user_id<>guardian_user_id)
);
create table coach_memory_private.enrollment_receipt (
 approval_id uuid primary key references coach_memory_private.enrollment_approval(id) on delete restrict,
 athlete_id uuid not null unique references public.athlete_identity(id) on delete restrict,
 membership_id uuid not null unique references public.athlete_identity_membership(id) on delete restrict,
 enrolled_by uuid not null references auth.users(id) on delete restrict,
 enrolled_at timestamptz not null default now()
);
alter table coach_memory_private.enrollment_approval enable row level security;
alter table coach_memory_private.enrollment_receipt enable row level security;
revoke all on coach_memory_private.enrollment_approval,coach_memory_private.enrollment_receipt from public,anon,authenticated;
-- Approval creation is intentionally not exposed. A trusted operator must verify
-- identity, duplicate enrollment risk, authority and account ownership independently.
-- No browser may call this function. Actor must originate from verified session.
create function coach_memory_private.consume_enrollment(actor uuid, approval uuid)
returns table(athlete_id uuid,membership_id uuid)
language plpgsql security invoker set search_path='' as $$
declare
 a coach_memory_private.enrollment_approval%rowtype;
 g uuid;
 new_athlete uuid;
 new_membership uuid;
begin
 if actor is null or approval is null then raise exception 'Enrollment denied' using errcode='42501'; end if;
 select * into a from coach_memory_private.enrollment_approval x where x.id=approval for update;
 if not found or a.revoked_at is not null or a.approved_at>now() or a.expires_at<=now() then
   raise exception 'Enrollment denied' using errcode='42501';
 end if;
 select x.id into g from coach_memory_private.admin_grant x
 where x.user_id=actor and x.program_key=a.program_key and x.revoked_at is null and x.granted_at<=now() for update;
 if not found then raise exception 'Enrollment denied' using errcode='42501'; end if;
 if not coach_memory_private.can_manage_program(a.approved_by,a.program_key) then
   raise exception 'Enrollment denied' using errcode='42501';
 end if;
 -- One receipt per approval. Retries do not create duplicate identities.
 select x.athlete_id,x.membership_id into new_athlete,new_membership
 from coach_memory_private.enrollment_receipt x where x.approval_id=approval;
 if found then return query select new_athlete,new_membership; return; end if;
 insert into public.athlete_identity default values returning id into new_athlete;
 insert into public.athlete_identity_membership(athlete_id,program_key)
 values(new_athlete,a.program_key) returning id into new_membership;
 if a.athlete_user_id is not null then
 insert into public.athlete_identity_access(athlete_id,user_id,access_role) values(new_athlete,a.athlete_user_id,'athlete');
 end if;
 if a.guardian_user_id is not null then
 insert into public.athlete_identity_access(athlete_id,user_id,access_role) values(new_athlete,a.guardian_user_id,'guardian');
 end if;
 insert into coach_memory_private.enrollment_receipt(approval_id,athlete_id,membership_id,enrolled_by)
 values(approval,new_athlete,new_membership,actor);
 return query select new_athlete,new_membership;
end;
$$;
revoke all on function coach_memory_private.consume_enrollment(uuid,uuid) from public,anon,authenticated;
-- No grants to browser or runtime roles in this draft. No linking of legacy rows.
commit;

-- ---- coach-memory-engine-draft.sql ----
-- DEVELOPMENT ONLY. Private Coach Memory transaction prototype.
-- Apply after identity, memory and access-control drafts on an isolated database.
begin;
-- Strict allowlist: no unrestricted notes, credentials, names or arbitrary nested objects.
create function coach_memory_private.valid_memory_payload(event_kind text, p jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; n numeric; v jsonb; d text;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32768 then return false; end if;
 case event_kind
 when 'bpm_confirmation' then
  if not (p ?& array['bpm','source']) or (p-array['bpm','source'])<>'{}'::jsonb then return false; end if;
  return coalesce(jsonb_typeof(p->'bpm')='number' and (p->>'bpm') ~ '^[0-9]{1,4}$' and (p->>'bpm')::numeric between 1 and 1000 and p->>'source'='reaction_speed',false);
 when 'training_plan' then
  if not (p ?& array['stage','bpm','days','stations']) or (p-array['stage','bpm','days','stations'])<>'{}'::jsonb then return false; end if;
  if coalesce(p->>'stage','') not in ('5-6','7-8','9-10','11-12','13-14','15-17','other') then return false; end if;
  if jsonb_typeof(p->'days')<>'number' or coalesce(p->>'days','') not in ('2','3','4','5') then return false; end if;
  if p->'bpm'<>'null'::jsonb and (jsonb_typeof(p->'bpm')<>'number' or coalesce(p->>'bpm','') !~ '^[0-9]{1,4}$' or (p->>'bpm')::numeric not between 1 and 1000) then return false; end if;
  if jsonb_typeof(p->'stations')<>'array' then return false; end if;
  if jsonb_array_length(p->'stations') not between 1 and 8 then return false; end if;
  for v in select value from jsonb_array_elements(p->'stations') loop
   if v not in ('"recall"'::jsonb,'"recognition"'::jsonb,'"replay"'::jsonb,'"fortress"'::jsonb,'"zn"'::jsonb,'"zr"'::jsonb,'"enc"'::jsonb,'"ritnome"'::jsonb) then return false; end if;
   if p->'bpm'='null'::jsonb and v in ('"zn"'::jsonb,'"zr"'::jsonb,'"enc"'::jsonb,'"ritnome"'::jsonb) then return false; end if;
   if v='"ritnome"'::jsonb and (p->>'stage' in ('5-6','7-8') or coalesce((p->>'bpm')::numeric,0) not between 40 and 200) then return false; end if;
  end loop;
  return true;
 when 'goal' then
  if not (p ?& array['metric','baseline','target']) or (p-array['metric','baseline','target'])<>'{}'::jsonb then return false; end if;
  if coalesce(p->>'metric','') not in ('active_days','reaction_bpm','recall','recognition','replay','fortress') then return false; end if;
  for k in select unnest(array['baseline','target']) loop
   if jsonb_typeof(p->k)<>'number' or coalesce(p->>k,'') !~ '^[0-9]{1,5}$' then return false; end if;
  end loop;
  return (p->>'target')::numeric>(p->>'baseline')::numeric;
 when 'cycle_evaluation' then
  if not (p ?& array['start','days','prior_attempts','cycle_attempts','complete']) or (p-array['start','days','prior_attempts','cycle_attempts','complete'])<>'{}'::jsonb then return false; end if;
  if jsonb_typeof(p->'start')<>'string' or coalesce(p->>'start','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  d:=p->>'start'; if to_char(d::date,'YYYY-MM-DD')<>d then return false; end if;
  if jsonb_typeof(p->'days')<>'number' or coalesce(p->>'days','') not in ('7','14','30') or jsonb_typeof(p->'complete')<>'boolean' then return false; end if;
  for k in select unnest(array['prior_attempts','cycle_attempts']) loop
   if jsonb_typeof(p->k)<>'number' or coalesce(p->>k,'') !~ '^[0-9]{1,7}$' then return false; end if;
  end loop;
  return true;
 when 'coaching_decision' then
  return coalesce(p ? 'reason' and (p-'reason')='{}'::jsonb and p->>'reason' in ('maintain','reinforce','measure_bpm','review_progress','collect_data'),false);
 when 'correction' then
  return coalesce(p ? 'reason' and (p-'reason')='{}'::jsonb and p->>'reason' in ('entry_error','invalid_measurement','incorrect_selection'),false);
 else return false;
 end case;
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then return false;
end;
$$;

-- Both revocation and membership changes must lock membership then coach grant.
-- Verified actor must be derived by future trusted backend, never request body.
create function coach_memory_private.lock_memory_access(actor uuid,target_membership uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare g uuid;
begin
 if actor is null or target_membership is null then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from public.athlete_identity_membership m where m.id=target_membership and m.starts_at<=clock_timestamp() and (m.ends_at is null or m.ends_at>clock_timestamp()) for update;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
 select x.id into g from coach_memory_private.coach_grant x where x.membership_id=target_membership and x.user_id=actor and x.revoked_at is null and x.granted_at<=clock_timestamp() for update;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
 return g;
end;
$$;

create function coach_memory_private.append_memory(actor uuid,target_membership uuid,event_kind text,event_date date,request_key uuid,p jsonb,correction_target uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare g uuid; existing coach_memory_private.event%rowtype; result_id uuid;
begin
 g:=coach_memory_private.lock_memory_access(actor,target_membership);
 if request_key is null or event_date is null or event_date>(clock_timestamp() at time zone 'America/Puerto_Rico')::date or not coach_memory_private.valid_memory_payload(event_kind,p) then raise exception 'Invalid event' using errcode='22023'; end if;
 if (event_kind='correction') is distinct from (correction_target is not null) then raise exception 'Invalid correction' using errcode='22023'; end if;
 if correction_target is not null and not exists(select 1 from coach_memory_private.event e where e.id=correction_target and e.membership_id=target_membership and e.kind<>'correction') then raise exception 'Invalid correction' using errcode='22023'; end if;
 if event_kind='cycle_evaluation' and (p->>'start')::date+(p->>'days')::int-1 >= (clock_timestamp() at time zone 'America/Puerto_Rico')::date then raise exception 'Cycle not complete' using errcode='22023'; end if;
 insert into coach_memory_private.event(membership_id,author_id,grant_id,kind,effective_on,request_id,payload,supersedes_id)
 values(target_membership,actor,g,event_kind,event_date,request_key,p,correction_target)
 on conflict(author_id,request_id) do nothing returning id into result_id;
 if result_id is not null then return result_id; end if;
 select * into existing from coach_memory_private.event e where e.author_id=actor and e.request_id=request_key;
 if not found or existing.membership_id is distinct from target_membership or existing.kind is distinct from event_kind or existing.effective_on is distinct from event_date or existing.payload is distinct from p or existing.supersedes_id is distinct from correction_target then raise exception 'Request conflict' using errcode='22023'; end if;
 return existing.id;
end;
$$;

create function coach_memory_private.read_memory(actor uuid,target_membership uuid,page_size integer default 25,before_time timestamptz default null,before_id uuid default null)
returns table(id uuid,kind text,effective_on date,recorded_at timestamptz,payload jsonb,supersedes_id uuid)
language plpgsql security invoker set search_path='' as $$
begin
 perform coach_memory_private.lock_memory_access(actor,target_membership);
 if page_size is null or page_size not between 1 and 100 or (before_time is null)<>(before_id is null) then raise exception 'Invalid page' using errcode='22023'; end if;
 return query select e.id,e.kind,e.effective_on,e.recorded_at,e.payload,e.supersedes_id from coach_memory_private.event e where e.membership_id=target_membership
 and (before_time is null or (e.recorded_at,e.id)<(before_time,before_id))
 order by e.recorded_at desc,e.id desc limit page_size;
end;
$$;
revoke all on function coach_memory_private.valid_memory_payload(text,jsonb),coach_memory_private.lock_memory_access(uuid,uuid),coach_memory_private.append_memory(uuid,uuid,text,date,uuid,jsonb,uuid),coach_memory_private.read_memory(uuid,uuid,integer,timestamptz,uuid) from public,anon,authenticated;
-- No endpoint or execution grants. No update/delete operation.
commit;

-- ---- session-authorization-draft.sql ----
-- DEVELOPMENT ONLY. Requires actual Supabase auth.users/auth.sessions schema review.
-- No browser grants. Run only in isolated test environment.
begin;
create function coach_memory_private.active_session(actor uuid,session_key uuid,token_exp bigint)
returns boolean language sql volatile security invoker set search_path='' as $$
 select actor is not null and session_key is not null and token_exp>extract(epoch from clock_timestamp()) and exists(
 select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=session_key and s.user_id=actor and u.is_anonymous is false
 and (s.not_after is null or s.not_after>clock_timestamp())
 );
$$;
revoke all on function coach_memory_private.active_session(uuid,uuid,bigint) from public,anon,authenticated;
commit;

-- ---- backend-role-draft.sql ----
-- DEVELOPMENT ONLY. Dedicated NOLOGIN role; never assign to browser roles.
-- Private trusted server entry points. The definer is deliberately a separate
-- NOLOGIN capability role, not postgres or a broadly privileged service role.
-- Requires all previous drafts. Do not apply to production.
begin;
create role coach_memory_executor nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
create role coach_memory_backend nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant usage on schema coach_memory_private to coach_memory_executor,coach_memory_backend;
grant usage on schema auth,public to coach_memory_executor;
grant select(id,is_anonymous) on auth.users to coach_memory_executor;
grant select(id,user_id,not_after) on auth.sessions to coach_memory_executor;
grant select,update on public.athlete_identity_membership to coach_memory_executor;
grant select,update on coach_memory_private.coach_grant to coach_memory_executor;
grant select,insert on coach_memory_private.event to coach_memory_executor;
-- SELECT FOR UPDATE requires an applicable UPDATE policy as well as SELECT.
-- Permit visibility for row locking only; WITH CHECK false prohibits actual updates.
create policy cm_exec_membership_lock on public.athlete_identity_membership for update to coach_memory_executor using(true) with check(false);
create policy cm_exec_grant_lock on coach_memory_private.coach_grant for update to coach_memory_executor using(true) with check(false);
create policy cm_exec_membership_read on public.athlete_identity_membership for select to coach_memory_executor using(true);
create policy cm_exec_grant_read on coach_memory_private.coach_grant for select to coach_memory_executor using(true);
create policy cm_exec_event_read on coach_memory_private.event for select to coach_memory_executor using(true);
create policy cm_exec_event_insert on coach_memory_private.event for insert to coach_memory_executor with check(true);
grant execute on function coach_memory_private.active_session(uuid,uuid,bigint),coach_memory_private.lock_memory_access(uuid,uuid),coach_memory_private.valid_memory_payload(text,jsonb),coach_memory_private.append_memory(uuid,uuid,text,date,uuid,jsonb,uuid),coach_memory_private.read_memory(uuid,uuid,integer,timestamptz,uuid) to coach_memory_executor;
-- The trusted backend must validate the exact bearer token with Supabase Auth.
-- Caller-supplied actor/session arguments are NOT a browser authentication API.
-- These wrappers are private, executable only by the future server login role
-- via membership in coach_memory_backend. No login credentials created here.
create function coach_memory_private.server_save_plan(actor uuid,session_key uuid,token_exp bigint,target_membership uuid,event_date date,request_key uuid,p jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not coach_memory_private.active_session(actor,session_key,token_exp) then raise exception 'Session denied' using errcode='28000'; end if;
 -- Until verified source binding is implemented, pilot accepts memory-only plans.
 if p->'bpm' is distinct from 'null'::jsonb then raise exception 'Verified BPM binding required' using errcode='22023'; end if;
 return coach_memory_private.append_memory(actor,target_membership,'training_plan',event_date,request_key,p);
end $$;
create function coach_memory_private.server_read_memory(actor uuid,session_key uuid,token_exp bigint,target_membership uuid,page_size integer,before_time timestamptz,before_id uuid)
returns table(id uuid,kind text,effective_on date,recorded_at timestamptz,payload jsonb,supersedes_id uuid)
language plpgsql security definer set search_path='' as $$
begin
 if not coach_memory_private.active_session(actor,session_key,token_exp) then raise exception 'Session denied' using errcode='28000'; end if;
 return query select * from coach_memory_private.read_memory(actor,target_membership,page_size,before_time,before_id);
end $$;
revoke all on function coach_memory_private.server_save_plan(uuid,uuid,bigint,uuid,date,uuid,jsonb),coach_memory_private.server_read_memory(uuid,uuid,bigint,uuid,integer,timestamptz,uuid) from public,anon,authenticated;
grant coach_memory_executor to postgres;
grant create on schema coach_memory_private to coach_memory_executor;
alter function coach_memory_private.server_save_plan(uuid,uuid,bigint,uuid,date,uuid,jsonb) owner to coach_memory_executor;
alter function coach_memory_private.server_read_memory(uuid,uuid,bigint,uuid,integer,timestamptz,uuid) owner to coach_memory_executor;
set local role coach_memory_executor;
grant execute on function coach_memory_private.server_save_plan(uuid,uuid,bigint,uuid,date,uuid,jsonb),coach_memory_private.server_read_memory(uuid,uuid,bigint,uuid,integer,timestamptz,uuid) to coach_memory_backend;
reset role;
revoke create on schema coach_memory_private from coach_memory_executor;
revoke coach_memory_executor from postgres;
commit;

-- ---- goal-backend-role-draft.sql ----
-- DEVELOPMENT ONLY: apply after existing Coach Memory role drafts in disposable local CI.
begin;
create function coach_memory_private.server_save_goal(actor uuid,session_key uuid,token_exp bigint,target_membership uuid,event_date date,request_key uuid,p jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not coach_memory_private.active_session(actor,session_key,token_exp) then raise exception 'Session denied' using errcode='28000'; end if;
 if not coach_memory_private.valid_memory_payload('goal',p) then raise exception 'Invalid goal' using errcode='22023'; end if;
 if p->>'metric'='active_days' and (p->>'target')::numeric>7 then raise exception 'Invalid weekly target' using errcode='22023'; end if;
 return coach_memory_private.append_memory(actor,target_membership,'goal',event_date,request_key,p);
end $$;
revoke all on function coach_memory_private.server_save_goal(uuid,uuid,bigint,uuid,date,uuid,jsonb) from public,anon,authenticated;
grant coach_memory_executor to postgres;
grant create on schema coach_memory_private to coach_memory_executor;
alter function coach_memory_private.server_save_goal(uuid,uuid,bigint,uuid,date,uuid,jsonb) owner to coach_memory_executor;
set local role coach_memory_executor;
grant execute on function coach_memory_private.server_save_goal(uuid,uuid,bigint,uuid,date,uuid,jsonb) to coach_memory_backend;
reset role;
revoke create on schema coach_memory_private from coach_memory_executor;
revoke coach_memory_executor from postgres;
commit;

-- ---- admin-ops-draft.sql ----
-- Coach Memory — program administrator operations (trusted operator = License Admin).
-- Apply after the identity, memory, access-control, enrollment, engine, session and role drafts.
-- Callable only by an authenticated License Admin user (public.is_admin()) who holds an active
-- administrator grant for the program. Nothing here is reachable by coaches, athletes or anon.
-- Memberships get a coach-facing roster label; it is not an identity and is never matched by name.
begin;
-- License Admin provides public.is_admin() in production. A disposable database without it gets a stub that admits nobody.
do $$ begin if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_admin') then
 execute 'create function public.is_admin() returns boolean language sql stable as $f$ select false $f$'; end if; end $$;
alter table public.athlete_identity_membership add column if not exists label text check(label is null or length(btrim(label)) between 1 and 80);

-- The acting administrator: a verified, non-anonymous License Admin session.
create or replace function coach_memory_private.admin_actor()
returns uuid language plpgsql stable security invoker set search_path='' as $$
declare u uuid := (select auth.uid());
begin
 if u is null or not coalesce(public.is_admin(), false) then raise exception 'Access denied' using errcode='42501'; end if;
 if exists(select 1 from auth.users x where x.id=u and x.is_anonymous is true) then raise exception 'Access denied' using errcode='42501'; end if;
 return u;
end $$;
revoke all on function coach_memory_private.admin_actor() from public,anon,authenticated;

-- One-time per program: the administrator grants themselves management of that program.
create or replace function public.cm_admin_bootstrap(p_program text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid := coach_memory_private.admin_actor(); k text := btrim(coalesce(p_program,''));
begin
 if length(k) not between 1 and 200 then raise exception 'Invalid program' using errcode='22023'; end if;
 insert into coach_memory_private.admin_grant(user_id,program_key) values(u,k)
 on conflict do nothing;
 return true;
end $$;

-- Programs this administrator manages, with counts.
create or replace function public.cm_admin_programs()
returns table(program_key text, active_memberships bigint)
language plpgsql security definer set search_path='' as $$
declare u uuid := coach_memory_private.admin_actor();
begin
 return query select g.program_key,
  (select count(*) from public.athlete_identity_membership m where m.program_key=g.program_key and m.starts_at<=clock_timestamp() and (m.ends_at is null or m.ends_at>clock_timestamp()))
 from coach_memory_private.admin_grant g where g.user_id=u and g.revoked_at is null and g.granted_at<=clock_timestamp()
 order by g.program_key;
end $$;

-- Enroll one verified athlete: the administrator is the approver and the enroller (same verified session).
create or replace function public.cm_admin_enroll(p_program text, p_label text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid := coach_memory_private.admin_actor(); k text := btrim(coalesce(p_program,'')); l text := btrim(coalesce(p_label,''));
 a uuid; r record;
begin
 if length(k) not between 1 and 200 then raise exception 'Invalid program' using errcode='22023'; end if;
 if length(l) not between 1 and 80 then raise exception 'Invalid label' using errcode='22023'; end if;
 if not coach_memory_private.can_manage_program(u,k) then raise exception 'Access denied' using errcode='42501'; end if;
 insert into coach_memory_private.enrollment_approval(program_key,approved_by,expires_at) values(k,u,clock_timestamp()+interval '1 hour') returning id into a;
 select * into r from coach_memory_private.consume_enrollment(u,a);
 update public.athlete_identity_membership set label=l where id=r.membership_id;
 return r.membership_id;
end $$;

-- Memberships of a program with their coaches (emails shown to the administrator only).
create or replace function public.cm_admin_memberships(p_program text)
returns table(membership_id uuid, label text, starts_at timestamptz, ends_at timestamptz, coaches jsonb)
language plpgsql security definer set search_path='' as $$
declare u uuid := coach_memory_private.admin_actor(); k text := btrim(coalesce(p_program,''));
begin
 if not coach_memory_private.can_manage_program(u,k) then raise exception 'Access denied' using errcode='42501'; end if;
 return query select m.id,m.label,m.starts_at,m.ends_at,
  coalesce((select jsonb_agg(jsonb_build_object('email',x.email,'granted_at',g.granted_at) order by x.email)
            from coach_memory_private.coach_grant g join auth.users x on x.id=g.user_id
            where g.membership_id=m.id and g.revoked_at is null),'[]'::jsonb)
 from public.athlete_identity_membership m where m.program_key=k
 order by (m.ends_at is not null), lower(m.label), m.starts_at;
end $$;

create or replace function public.cm_admin_set_label(p_membership uuid, p_label text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid := coach_memory_private.admin_actor(); l text := btrim(coalesce(p_label,'')); k text;
begin
 if length(l) not between 1 and 80 then raise exception 'Invalid label' using errcode='22023'; end if;
 select program_key into k from public.athlete_identity_membership where id=p_membership for update;
 if not found or not coach_memory_private.can_manage_program(u,k) then raise exception 'Access denied' using errcode='42501'; end if;
 update public.athlete_identity_membership set label=l where id=p_membership;
 return true;
end $$;

-- End a membership (history is preserved; coaches lose access from now on).
create or replace function public.cm_admin_end_membership(p_membership uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid := coach_memory_private.admin_actor(); k text;
begin
 select program_key into k from public.athlete_identity_membership where id=p_membership for update;
 if not found or not coach_memory_private.can_manage_program(u,k) then raise exception 'Access denied' using errcode='42501'; end if;
 update public.athlete_identity_membership set ends_at=clock_timestamp() where id=p_membership and ends_at is null;
 return true;
end $$;

-- Does a coach account exist for this email? (yes/no only; no identifiers are returned)
create or replace function public.cm_admin_coach_exists(p_email text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform coach_memory_private.admin_actor();
 return exists(select 1 from auth.users x where lower(x.email)=lower(btrim(coalesce(p_email,''))) and x.is_anonymous is not true);
end $$;

-- Grant a named coach access to one membership. Idempotent while the grant is active.
create or replace function public.cm_admin_grant_coach(p_membership uuid, p_email text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid := coach_memory_private.admin_actor(); k text; c uuid;
begin
 select x.id into c from auth.users x where lower(x.email)=lower(btrim(coalesce(p_email,''))) and x.is_anonymous is not true;
 if c is null then raise exception 'No coach account with that email' using errcode='22023'; end if;
 select program_key into k from public.athlete_identity_membership where id=p_membership and starts_at<=clock_timestamp() and (ends_at is null or ends_at>clock_timestamp()) for update;
 if not found or not coach_memory_private.can_manage_program(u,k) then raise exception 'Access denied' using errcode='42501'; end if;
 if exists(select 1 from coach_memory_private.coach_grant g where g.membership_id=p_membership and g.user_id=c and g.revoked_at is null) then return true; end if;
 insert into coach_memory_private.coach_grant(user_id,membership_id,granted_by) values(c,p_membership,u);
 return true;
end $$;

-- Revoke a coach's access to one membership (same lock order as the engine: membership, then grant).
create or replace function public.cm_admin_revoke_coach(p_membership uuid, p_email text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid := coach_memory_private.admin_actor(); k text; c uuid;
begin
 select x.id into c from auth.users x where lower(x.email)=lower(btrim(coalesce(p_email,'')));
 select program_key into k from public.athlete_identity_membership where id=p_membership for update;
 if not found or not coach_memory_private.can_manage_program(u,k) then raise exception 'Access denied' using errcode='42501'; end if;
 perform 1 from coach_memory_private.coach_grant g where g.membership_id=p_membership and g.user_id=c and g.revoked_at is null for update;
 update coach_memory_private.coach_grant set revoked_at=clock_timestamp() where membership_id=p_membership and user_id=c and revoked_at is null;
 return found;
end $$;

revoke all on function public.cm_admin_bootstrap(text),public.cm_admin_programs(),public.cm_admin_enroll(text,text),public.cm_admin_memberships(text),
 public.cm_admin_set_label(uuid,text),public.cm_admin_end_membership(uuid),public.cm_admin_coach_exists(text),public.cm_admin_grant_coach(uuid,text),public.cm_admin_revoke_coach(uuid,text) from public,anon;
grant execute on function public.cm_admin_bootstrap(text),public.cm_admin_programs(),public.cm_admin_enroll(text,text),public.cm_admin_memberships(text),
 public.cm_admin_set_label(uuid,text),public.cm_admin_end_membership(uuid),public.cm_admin_coach_exists(text),public.cm_admin_grant_coach(uuid,text),public.cm_admin_revoke_coach(uuid,text) to authenticated;
commit;

-- ---- enrollment-list-role-draft.sql ----
-- DEVELOPMENT ONLY. No legacy name matching, no enrollment self-approval.
-- Returns the administrator-set roster label so a coach can tell enrollments apart; it is display text only.
begin;
drop function if exists coach_memory_private.server_list_enrollments(uuid,uuid,bigint,uuid,integer);
drop policy if exists cm_exec_receipt_read on coach_memory_private.enrollment_receipt;
grant select on coach_memory_private.enrollment_receipt to coach_memory_executor;
create policy cm_exec_receipt_read on coach_memory_private.enrollment_receipt for select to coach_memory_executor using(true);
create function coach_memory_private.server_list_enrollments(actor uuid,session_key uuid,token_exp bigint,after_id uuid,page_size integer)
returns table(membership_id uuid,program_key text,label text)
language plpgsql security definer set search_path='' as $$
begin
 if not coach_memory_private.active_session(actor,session_key,token_exp) then raise exception 'Session denied' using errcode='28000'; end if;
 if page_size is null or page_size not between 1 and 100 then raise exception 'Invalid page' using errcode='22023'; end if;
 return query select m.id,m.program_key,m.label from public.athlete_identity_membership m
 join coach_memory_private.enrollment_receipt r on r.membership_id=m.id and r.athlete_id=m.athlete_id
 join coach_memory_private.coach_grant g on g.membership_id=m.id
 where g.user_id=actor and g.revoked_at is null and g.granted_at<=clock_timestamp()
 and m.starts_at<=clock_timestamp() and (m.ends_at is null or m.ends_at>clock_timestamp())
 and (after_id is null or m.id>after_id)
 order by m.id limit page_size;
end $$;
revoke all on function coach_memory_private.server_list_enrollments(uuid,uuid,bigint,uuid,integer) from public,anon,authenticated;
grant coach_memory_executor to postgres;
grant create on schema coach_memory_private to coach_memory_executor;
alter function coach_memory_private.server_list_enrollments(uuid,uuid,bigint,uuid,integer) owner to coach_memory_executor;
set local role coach_memory_executor;
grant execute on function coach_memory_private.server_list_enrollments(uuid,uuid,bigint,uuid,integer) to coach_memory_backend;
reset role;
revoke create on schema coach_memory_private from coach_memory_executor;
revoke coach_memory_executor from postgres;
commit;

-- ---- server login (run separately, with a real password, then put the URL in Render as COACH_MEMORY_DATABASE_URL) ----
-- create role coach_memory_login login noinherit password '<long random password>';
-- grant coach_memory_backend to coach_memory_login;

-- Check: expect 7 tables and the functions listed.
select 'table' as kind, table_schema||'.'||table_name as name from information_schema.tables
 where (table_schema='public' and table_name like 'athlete_identity%') or table_schema='coach_memory_private'
union all
select 'function', proname from pg_proc where proname like 'cm_admin_%' or proname like 'server_%'
order by 1,2;
