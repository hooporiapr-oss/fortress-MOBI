-- Synthetic data only; no hosted database.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); x uuid; y uuid; m uuid; n uuid; r uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); v uuid; cf uuid; at_time timestamptz; expiry bigint:=extract(epoch from now()+interval '1 hour')::bigint;
begin
 insert into auth.users(id) values(a),(b);
 insert into auth.sessions(id,user_id) values(s,a);
 insert into public.athlete_identity default values returning id into x;
 insert into public.athlete_identity default values returning id into y;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(x,'synthetic') returning id into m;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(y,'synthetic') returning id into n;
 insert into coach_memory_private.coach_grant(user_id,membership_id,granted_by) values(a,m,a),(a,n,a);
 at_time:=clock_timestamp();
 v:=coach_memory_private.submit_observed_bpm(a,s,expiry,m,r,84,at_time);
 if v is null or v is distinct from coach_memory_private.submit_observed_bpm(a,s,expiry,m,r,84,at_time) then raise exception 'submission retry failed';end if;
 cf:=coach_memory_private.confirm_observed_bpm(a,s,expiry,m,v,c);
 if cf is null or cf is distinct from coach_memory_private.confirm_observed_bpm(a,s,expiry,m,v,c) then raise exception 'confirmation retry failed';end if;
 begin perform coach_memory_private.confirm_observed_bpm(a,s,expiry,n,v,gen_random_uuid());raise exception 'cross-athlete confirmation accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.submit_observed_bpm(a,s,expiry,m,r,85,at_time);raise exception 'changed retry accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.submit_observed_bpm(b,s,expiry,m,gen_random_uuid(),84,at_time);raise exception 'wrong session accepted';exception when invalid_authorization_specification then null;end;
 if has_function_privilege('authenticated','coach_memory_private.confirm_observed_bpm(uuid,uuid,bigint,uuid,uuid,uuid)','EXECUTE') then raise exception 'browser execution exposed';end if;
 if has_function_privilege('coach_memory_backend','coach_memory_private.submit_observed_bpm(uuid,uuid,bigint,uuid,uuid,integer,timestamptz)','EXECUTE') then raise exception 'premature runtime grant';end if;
 raise notice 'PASS: BPM identity binding, confirmation, idempotency, session rejection and restricted execution';
end $$;
rollback;
