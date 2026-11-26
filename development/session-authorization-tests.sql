-- Disposable synthetic fixtures only.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); expiry bigint:=extract(epoch from now()+interval '1 hour')::bigint;
begin
 insert into auth.users(id,is_anonymous) values(a,false),(b,true);
 insert into auth.sessions(id,user_id,not_after) values(s,a,now()+interval '1 hour');
 if not coach_memory_private.active_session(a,s,expiry) then raise exception 'valid session denied'; end if;
 if coach_memory_private.active_session(b,s,expiry) then raise exception 'wrong actor accepted'; end if;
 if coach_memory_private.active_session(a,s,0) then raise exception 'expired token accepted'; end if;
 update auth.sessions set not_after=now()-interval '1 second' where id=s;
 if coach_memory_private.active_session(a,s,expiry) then raise exception 'expired session accepted'; end if;
 update auth.sessions set not_after=null,user_id=b where id=s;
 if coach_memory_private.active_session(b,s,expiry) then raise exception 'anonymous session accepted'; end if;
 update auth.sessions set user_id=a where id=s;
 delete from auth.sessions where id=s;
 if coach_memory_private.active_session(a,s,expiry) then raise exception 'revoked session accepted'; end if;
 if has_function_privilege('authenticated','coach_memory_private.active_session(uuid,uuid,bigint)','EXECUTE') then raise exception 'browser session helper exposed'; end if;
 raise notice 'PASS: synthetic session ownership, expiry, anonymous and revocation checks';
end $$;
rollback;
