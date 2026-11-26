-- Synthetic fixtures only. Test with the actual restricted backend role.
begin;
do $$
declare a uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); x uuid; y uuid; m uuid; n uuid; v uuid; c uuid; e uuid; r uuid:=gen_random_uuid(); at_time timestamptz; expiry bigint:=extract(epoch from now()+interval '1 hour')::bigint; d date:=(clock_timestamp() at time zone 'America/Puerto_Rico')::date; p jsonb:='{"stage":"11-12","days":3,"stations":["zn","recall"]}';
begin
 insert into auth.users(id) values(a);
 insert into auth.sessions(id,user_id) values(s,a);
 insert into public.athlete_identity default values returning id into x;
 insert into public.athlete_identity default values returning id into y;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(x,'synthetic') returning id into m;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(y,'synthetic') returning id into n;
 insert into coach_memory_private.coach_grant(user_id,membership_id,granted_by) values(a,m,a),(a,n,a);
 at_time:=clock_timestamp();
 set local role coach_memory_backend;
 v:=coach_memory_private.server_submit_bpm(a,s,expiry,m,r,84,at_time);
 c:=coach_memory_private.server_confirm_bpm(a,s,expiry,m,v,gen_random_uuid());
 e:=coach_memory_private.server_save_bpm_plan(a,s,expiry,m,c,d,gen_random_uuid(),p);
 if e is null or not exists(select 1 from coach_memory_private.server_read_memory(a,s,expiry,m,25,null,null) where id=e and payload->>'bpm'='84') then raise exception 'Restricted BPM workflow failed';end if;
 begin perform coach_memory_private.server_save_bpm_plan(a,s,expiry,n,c,d,gen_random_uuid(),p);raise exception 'Cross-athlete BPM accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.server_save_bpm_plan(a,s,expiry,m,c,d,gen_random_uuid(),p||'{"bpm":99}');raise exception 'BPM override accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.server_submit_bpm(a,s,0,m,gen_random_uuid(),84,at_time);raise exception 'Expired session accepted';exception when invalid_authorization_specification then null;end;
 begin perform 1 from coach_memory_private.bpm_measurement;raise exception 'Raw measurement access';exception when insufficient_privilege then null;end;
 begin perform 1 from coach_memory_private.bpm_confirmation;raise exception 'Raw confirmation access';exception when insufficient_privilege then null;end;
 begin perform 1 from coach_memory_private.plan_bpm_binding;raise exception 'Raw binding access';exception when insufficient_privilege then null;end;
 reset role;
 if has_function_privilege('authenticated','coach_memory_private.server_submit_bpm(uuid,uuid,bigint,uuid,uuid,integer,timestamptz)','EXECUTE') or has_function_privilege('anon','coach_memory_private.server_confirm_bpm(uuid,uuid,bigint,uuid,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','coach_memory_private.server_save_bpm_plan(uuid,uuid,bigint,uuid,uuid,date,uuid,jsonb)','EXECUTE') then raise exception 'Public wrapper access';end if;
 if has_table_privilege('coach_memory_executor','coach_memory_private.bpm_measurement','UPDATE') or has_table_privilege('coach_memory_executor','coach_memory_private.bpm_confirmation','DELETE') or has_table_privilege('coach_memory_executor','coach_memory_private.plan_bpm_binding','UPDATE') then raise exception 'Protected history mutation privilege';end if;
 raise notice 'PASS: restricted BPM submit, confirm, prescription, readback, cross-athlete denial and private table protection';
end $$;
rollback;
