-- Synthetic isolated database only.
begin;
do $$
declare a uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); athlete uuid; m uuid; r uuid:=gen_random_uuid(); ev uuid; n integer; expiry bigint:=extract(epoch from now()+interval '1 hour')::bigint;
begin
 insert into auth.users(id) values(a);
 insert into auth.sessions(id,user_id) values(s,a);
 insert into public.athlete_identity default values returning id into athlete;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(athlete,'synthetic') returning id into m;
 insert into coach_memory_private.coach_grant(user_id,membership_id,granted_by) values(a,m,a);
 set local role coach_memory_backend;
 ev:=coach_memory_private.server_save_plan(a,s,expiry,m,current_date-1,r,'{"stage":"5-6","bpm":null,"days":3,"stations":["recall"]}');
 if ev is null then raise exception 'backend save returned null'; end if;
 select count(*) into n from coach_memory_private.server_read_memory(a,s,expiry,m,25,null,null);
 if n<>1 then raise exception 'backend read failed'; end if;
 begin perform coach_memory_private.server_save_plan(a,s,expiry,m,current_date-1,gen_random_uuid(),'{"stage":"5-6","bpm":84,"days":3,"stations":["recall"]}');raise exception 'unverified bpm accepted';exception when invalid_parameter_value then null;end;
 begin perform coach_memory_private.server_read_memory(a,s,0,m,25,null,null);raise exception 'expired session accepted';exception when invalid_authorization_specification then null;end;
 begin perform 1 from coach_memory_private.event;raise exception 'raw event read allowed';exception when insufficient_privilege then null;end;
 reset role;
 if has_function_privilege('authenticated','coach_memory_private.server_save_plan(uuid,uuid,bigint,uuid,date,uuid,jsonb)','EXECUTE') then raise exception 'browser wrapper exposed';end if;
 if has_table_privilege('coach_memory_backend','coach_memory_private.event','DELETE') then raise exception 'backend delete allowed';end if;
 raise notice 'PASS: restricted backend wrapper, session enforcement, no direct event access, unverified BPM blocked';
end $$;
rollback;
