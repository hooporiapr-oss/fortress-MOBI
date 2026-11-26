-- Coach Memory — full removal of everything release.sql created (reverse order of creation).
-- Touches only Coach Memory objects. The pre-existing public.is_admin() keeps its body; only the
-- search_path setting that Coach Memory added is reset.
begin;
drop function if exists public.cm_admin_revoke_coach(uuid,text);
drop function if exists public.cm_admin_grant_coach(uuid,text);
drop function if exists public.cm_admin_coach_exists(text);
drop function if exists public.cm_admin_end_membership(uuid);
drop function if exists public.cm_admin_set_label(uuid,text);
drop function if exists public.cm_admin_memberships(text);
drop function if exists public.cm_admin_enroll(text,text);
drop function if exists public.cm_admin_programs();
drop function if exists public.cm_admin_bootstrap(text);
alter function public.is_admin() reset search_path;
drop schema if exists coach_memory_private cascade;
drop table if exists public.athlete_identity_record_link cascade;
drop table if exists public.athlete_identity_access cascade;
drop table if exists public.athlete_identity_membership cascade;
drop table if exists public.athlete_identity cascade;
do $$ begin
 if exists(select 1 from pg_roles where rolname='coach_memory_login') then
  execute 'drop owned by coach_memory_login'; execute 'drop role coach_memory_login'; end if;
 if exists(select 1 from pg_roles where rolname='coach_memory_backend') then
  execute 'drop owned by coach_memory_backend'; execute 'drop role coach_memory_backend'; end if;
 if exists(select 1 from pg_roles where rolname='coach_memory_executor') then
  execute 'drop owned by coach_memory_executor'; execute 'drop role coach_memory_executor'; end if;
end $$;
commit;
-- Check: all three counts must be 0.
select (select count(*) from pg_namespace where nspname='coach_memory_private') schemas,
       (select count(*) from pg_tables where schemaname='public' and tablename like 'athlete_identity%') tables,
       (select count(*) from pg_roles where rolname like 'coach_memory%') roles;
