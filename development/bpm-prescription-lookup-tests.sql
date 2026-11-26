-- Synthetic exact lookup tests; rollback all fixtures.
begin;
do $$
declare a uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); os uuid:=gen_random_uuid(); x uuid; y uuid; m uuid; n uuid; v uuid; c uuid; e uuid; unbound uuid; answer jsonb; expiry bigint:=extract(epoch from now()+interval '1 hour')::bigint; d date:=(clock_timestamp() at time zone 'America/Puerto_Rico')::date; p jsonb:='{"stage":"11-12","days":3,"stations":["recall","recognition"]}';
begin
 insert into auth.users(id) values(a),(outsider);
 insert into auth.sessions(id,user_id) values(s,a),(os,outsider);
 insert into public.athlete_identity default values returning id into x;
 insert into public.athlete_identity default values returning id into y;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(x,'synthetic') returning id into m;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(y,'synthetic') returning id into n;
 insert into coach_memory_private.coach_grant(user_id,membership_id,granted_by) values(a,m,a),(a,n,a);
 set local role coach_memory_backend;
 v:=coach_memory_private.server_submit_bpm(a,s,expiry,m,gen_random_uuid(),84,clock_timestamp());
 c:=coach_memory_private.server_confirm_bpm(a,s,expiry,m,v,gen_random_uuid());
 e:=coach_memory_private.server_save_bpm_plan(a,s,expiry,m,c,d,gen_random_uuid(),p);
 unbound:=coach_memory_private.server_save_plan(a,s,expiry,m,d,gen_random_uuid(),p||'{"bpm":null}');
 reset role;
 for i in 1..105 loop
  perform coach_memory_private.append_memory(a,m,'coaching_decision',d,gen_random_uuid(),'{"reason":"maintain"}');
 end loop;
 set local role coach_memory_backend;
 answer:=coach_memory_private.server_get_bpm_plan(a,s,expiry,m,e,'recall');
 if answer->>'bpm' is distinct from '84' or answer->>'plan_id' is distinct from e::text or answer->>'membership_id' is distinct from m::text or answer->>'confirmation_id' is distinct from c::text or answer->>'station' is distinct from 'recall' then raise exception 'Exact binding lookup failed';end if;
 if coach_memory_private.server_get_bpm_plan(a,s,expiry,m,e,'recognition')->>'bpm' is distinct from '84' then raise exception 'Shared BPM failed';end if;
 begin perform coach_memory_private.server_get_bpm_plan(a,s,expiry,n,e,'recall');raise exception 'Cross membership accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.server_get_bpm_plan(a,s,expiry,m,e,'replay');raise exception 'Unprescribed station accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.server_get_bpm_plan(a,s,expiry,m,unbound,'recall');raise exception 'Unbound plan accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.server_get_bpm_plan(a,s,expiry,m,gen_random_uuid(),'recall');raise exception 'Unknown plan accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.server_get_bpm_plan(outsider,os,expiry,m,e,'recall');raise exception 'Unauthorized coach accepted';exception when insufficient_privilege then null;end;
 begin perform coach_memory_private.server_get_bpm_plan(a,s,0,m,e,'recall');raise exception 'Expired token accepted';exception when invalid_authorization_specification then null;end;
 reset role;
 perform coach_memory_private.append_memory(a,m,'correction',d,gen_random_uuid(),'{"reason":"incorrect_selection"}',e);
 set local role coach_memory_backend;
 begin perform coach_memory_private.server_get_bpm_plan(a,s,expiry,m,e,'recall');raise exception 'Corrected plan accepted';exception when invalid_parameter_value then null;end;
 reset role;
 delete from auth.sessions where id=s;
 set local role coach_memory_backend;
 begin perform coach_memory_private.server_get_bpm_plan(a,s,expiry,m,e,'recall');raise exception 'Revoked session accepted';exception when invalid_authorization_specification then null;end;
 reset role;
 if has_function_privilege('anon','coach_memory_private.server_get_bpm_plan(uuid,uuid,bigint,uuid,uuid,text)','EXECUTE') or has_function_privilege('authenticated','coach_memory_private.server_get_bpm_plan(uuid,uuid,bigint,uuid,uuid,text)','EXECUTE') then raise exception 'Browser execution allowed';end if;
 raise notice 'PASS: exact bound lookup beyond 100 events, shared BPM, denied membership/station/unbound/corrected/expired/revoked access';
end $$;
rollback;
