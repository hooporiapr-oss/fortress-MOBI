-- Isolated tests for the administrator operations. Synthetic users only.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values
 ('a0000000-0000-4000-8000-000000000001','admin@example.test'),
 ('a0000000-0000-4000-8000-000000000002','other-admin@example.test'),
 ('c0000000-0000-4000-8000-000000000001','coach-a@example.test'),
 ('c0000000-0000-4000-8000-000000000002','coach-b@example.test'),
 ('c0000000-0000-4000-8000-000000000009','ghost@example.test');
update auth.users set is_anonymous=true where id='c0000000-0000-4000-8000-000000000009';
insert into public.admins values('a0000000-0000-4000-8000-000000000001'),('a0000000-0000-4000-8000-000000000002');
insert into auth.sessions(id,user_id) values('50000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001'),('50000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002');

-- 1. anon and a non-admin authenticated user are denied
set local role anon;
do $$ begin perform public.cm_admin_bootstrap('P'); raise exception 'anon bootstrapped'; exception when insufficient_privilege then null; end $$;
reset role;
set local role authenticated; set local request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
do $$ begin perform public.cm_admin_bootstrap('P'); raise exception 'coach bootstrapped'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.cm_admin_programs(); raise exception 'coach listed programs'; exception when insufficient_privilege then null; end $$;
reset role;

-- 2. the administrator bootstraps a program and enrolls two athletes
set local role authenticated; set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.cm_admin_bootstrap('Canovanas') as bootstrapped \gset
select public.cm_admin_bootstrap('Canovanas') as again \gset
select public.cm_admin_enroll('Canovanas','Team 8 · #23') as m1 \gset
select public.cm_admin_enroll('Canovanas','Team 8 · #7') as m2 \gset
select set_config('t.m1',:'m1',true), set_config('t.m2',:'m2',true);
do $$ begin perform public.cm_admin_enroll('Canovanas',''); raise exception 'empty label accepted'; exception when invalid_parameter_value then null; end $$;
do $$ begin perform public.cm_admin_enroll('Nope','x'); raise exception 'unmanaged program accepted'; exception when insufficient_privilege then null; end $$;
select count(*)=2 as two_memberships from public.cm_admin_memberships('Canovanas') \gset
select (select count(*) from public.cm_admin_programs() where program_key='Canovanas' and active_memberships=2)=1 as program_listed \gset

-- 3. grant coach A to membership 1 only; unknown and anonymous emails are refused
select public.cm_admin_coach_exists('COACH-A@example.test') as exists_a \gset
select public.cm_admin_coach_exists('nobody@example.test') as exists_nobody \gset
select public.cm_admin_grant_coach(:'m1','coach-a@example.test') as granted \gset
select public.cm_admin_grant_coach(:'m1','coach-a@example.test') as granted_twice \gset
do $$ begin perform public.cm_admin_grant_coach(current_setting('t.m1')::uuid,'nobody@example.test'); raise exception 'unknown email granted'; exception when invalid_parameter_value then null; end $$;
do $$ begin perform public.cm_admin_grant_coach(current_setting('t.m1')::uuid,'ghost@example.test'); raise exception 'anonymous granted'; exception when invalid_parameter_value then null; end $$;
select (coaches->0->>'email')='coach-a@example.test' and jsonb_array_length(coaches)=1 as one_coach from public.cm_admin_memberships('Canovanas') where membership_id=:'m1' \gset
reset role;

-- 4. the backend sees exactly what each coach was granted (with the label)
set local role coach_memory_backend;
select count(*)=1 as a_sees_one, bool_and(label='Team 8 · #23') as a_sees_label from coach_memory_private.server_list_enrollments('c0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',extract(epoch from now())::bigint+600,null,25) \gset
select count(*)=0 as b_sees_none from coach_memory_private.server_list_enrollments('c0000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',extract(epoch from now())::bigint+600,null,25) \gset
reset role;

-- 5. another administrator cannot touch this program
set local role authenticated; set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
do $$ begin perform public.cm_admin_memberships('Canovanas'); raise exception 'other admin listed'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.cm_admin_grant_coach(current_setting('t.m2')::uuid,'coach-b@example.test'); raise exception 'other admin granted'; exception when insufficient_privilege then null; end $$;
do $$ begin perform public.cm_admin_end_membership(current_setting('t.m2')::uuid); raise exception 'other admin ended'; exception when insufficient_privilege then null; end $$;
reset role;

-- 6. revoke, relabel, end membership
set local role authenticated; set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.cm_admin_revoke_coach(:'m1','coach-a@example.test') as revoked \gset
select public.cm_admin_revoke_coach(:'m1','coach-a@example.test') as revoked_again \gset
select public.cm_admin_set_label(:'m2','Team 9 · #7') as relabeled \gset
select public.cm_admin_grant_coach(:'m2','coach-b@example.test') as granted_b \gset
select public.cm_admin_end_membership(:'m2') as ended \gset
select (select label from public.cm_admin_memberships('Canovanas') where membership_id=:'m2')='Team 9 · #7' as label_kept \gset
reset role;
set local role coach_memory_backend;
select count(*)=0 as a_after_revoke from coach_memory_private.server_list_enrollments('c0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',extract(epoch from now())::bigint+600,null,25) \gset
select count(*)=0 as b_after_end from coach_memory_private.server_list_enrollments('c0000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',extract(epoch from now())::bigint+600,null,25) \gset
reset role;

select (:'bootstrapped'='t') and (:'again'='t') and (:'two_memberships'='t') and (:'program_listed'='t') and (:'exists_a'='t') and not (:'exists_nobody'='t') and (:'granted'='t') and (:'granted_twice'='t') and (:'one_coach'='t') and (:'a_sees_one'='t') and (:'a_sees_label'='t') and (:'b_sees_none'='t') and (:'revoked'='t') and not (:'revoked_again'='t') and (:'relabeled'='t') and (:'granted_b'='t') and (:'ended'='t') and (:'label_kept'='t') and (:'a_after_revoke'='t') and (:'b_after_end'='t') as all_ok \gset
\if :all_ok
 \echo PASS: administrator operations — bootstrap, enroll, label, grant/revoke by email, end membership, cross-admin and non-admin denial
\else
 \echo FAIL: administrator operations
 \quit 1
\endif
rollback;
