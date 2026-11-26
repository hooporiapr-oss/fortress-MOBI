-- Synthetic tests, owner-only. No runtime access.
begin;
do $$
declare a uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); x uuid; y uuid; m uuid; n uuid; v uuid; c uuid; c2 uuid; e uuid; r uuid:=gen_random_uuid(); expiry bigint:=extract(epoch from now()+interval '1 hour')::bigint; d date:=(clock_timestamp() at time zone 'America/Puerto_Rico')::date; p jsonb:='{"stage":"11-12","days":3,"stations":["zn","recall"]}';
begin
 insert into auth.users(id) values(a);
 insert into auth.sessions(id,user_id) values(s,a);
 insert into public.athlete_identity default values returning id into x;
 insert into public.athlete_identity default values returning id into y;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(x,'synthetic') returning id into m;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(y,'synthetic') returning id into n;
 insert into coach_memory_private.coach_grant(user_id,membership_id,granted_by) values(a,m,a),(a,n,a);
 v:=coach_memory_private.submit_observed_bpm(a,s,expiry,m,gen_random_uuid(),84,clock_timestamp());
 c:=coach_memory_private.confirm_observed_bpm(a,s,expiry,m,v,gen_random_uuid());
 e:=coach_memory_private.save_confirmed_bpm_plan(a,s,expiry,m,c,d,r,p);
 if e is null or not exists(select 1 from coach_memory_private.event where id=e and payload->>'bpm'='84') or not exists(select 1 from coach_memory_private.plan_bpm_binding where event_id=e and confirmation_id=c) then raise exception 'Stored BPM binding missing'; end if;
 if e is distinct from coach_memory_private.save_confirmed_bpm_plan(a,s,expiry,m,c,d,r,p) then raise exception 'Plan retry failed';end if;
 begin perform coach_memory_private.save_confirmed_bpm_plan(a,s,expiry,m,c,d,gen_random_uuid(),p||'{"bpm":99}');raise exception 'Override accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.save_confirmed_bpm_plan(a,s,expiry,n,c,d,gen_random_uuid(),p);raise exception 'Cross-athlete plan accepted';exception when invalid_parameter_value then null;end;
 v:=coach_memory_private.submit_observed_bpm(a,s,expiry,m,gen_random_uuid(),84,clock_timestamp());
 c2:=coach_memory_private.confirm_observed_bpm(a,s,expiry,m,v,gen_random_uuid());
 begin perform coach_memory_private.save_confirmed_bpm_plan(a,s,expiry,m,c2,d,r,p);raise exception 'Changed confirmation retry accepted';exception when invalid_parameter_value then null;end;
 if not exists(select 1 from coach_memory_private.plan_bpm_binding where event_id=e and confirmation_id=c) then raise exception 'History altered';end if;
 if has_function_privilege('coach_memory_backend','coach_memory_private.save_confirmed_bpm_plan(uuid,uuid,bigint,uuid,uuid,date,uuid,jsonb)','EXECUTE') then raise exception 'Premature runtime access';end if;
 raise notice 'PASS: confirmed BPM derivation, same-athlete plan, override rejection, immutable confirmation binding and retry';
end $$;
rollback;
