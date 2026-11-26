-- Disposable database only; rollback synthetic fixtures.
begin;
do $$
declare
 admin_a uuid:=gen_random_uuid(); admin_b uuid:=gen_random_uuid(); coach_a uuid:=gen_random_uuid(); guardian_a uuid:=gen_random_uuid();
 approval uuid:=gen_random_uuid(); athlete uuid; membership uuid; athlete_b uuid; membership_b uuid;
 grant_a uuid; req uuid:=gen_random_uuid(); ev uuid; replay uuid; n integer;
begin
 insert into auth.users values(admin_a),(admin_b),(coach_a),(guardian_a);
 insert into coach_memory_private.admin_grant(user_id,program_key) values(admin_a,'demo-a'),(admin_b,'demo-b');
 insert into coach_memory_private.enrollment_approval(id,program_key,approved_by,guardian_user_id,expires_at)
 values(approval,'demo-a',admin_a,guardian_a,now()+interval '1 day');
 begin perform coach_memory_private.consume_enrollment(admin_b,approval); raise exception 'wrong admin allowed'; exception when insufficient_privilege then null; end;
 select x.athlete_id,x.membership_id into athlete,membership from coach_memory_private.consume_enrollment(admin_a,approval) x;
 select x.athlete_id,x.membership_id into athlete_b,membership_b from coach_memory_private.consume_enrollment(admin_a,approval) x;
 if athlete is null or athlete is distinct from athlete_b or membership is distinct from membership_b then raise exception 'duplicate enrollment'; end if;
 if not coach_memory_private.can_access_athlete(guardian_a,athlete,'guardian') or coach_memory_private.can_access_athlete(guardian_a,athlete,'athlete') then raise exception 'guardian scope'; end if;
 if coach_memory_private.can_access_memory(admin_a,membership) then raise exception 'admin can read memory'; end if;
 begin perform coach_memory_private.read_memory(coach_a,membership); raise exception 'unassigned coach allowed'; exception when insufficient_privilege then null; end;
 insert into coach_memory_private.coach_grant(user_id,membership_id,granted_by) values(coach_a,membership,admin_a) returning id into grant_a;
 ev:=coach_memory_private.append_memory(coach_a,membership,'bpm_confirmation',current_date-1,req,'{"bpm":84,"source":"reaction_speed"}');
 replay:=coach_memory_private.append_memory(coach_a,membership,'bpm_confirmation',current_date-1,req,'{"bpm":84,"source":"reaction_speed"}');
 if ev is null or ev is distinct from replay then raise exception 'idempotency failed'; end if;
 begin perform coach_memory_private.append_memory(coach_a,membership,'bpm_confirmation',current_date-1,req,'{"bpm":85,"source":"reaction_speed"}'); raise exception 'changed request accepted'; exception when invalid_parameter_value then null; end;
 select count(*) into n from coach_memory_private.read_memory(coach_a,membership);
 if n<>1 then raise exception 'unexpected memory count'; end if;
 insert into public.athlete_identity default values returning id into athlete_b;
 insert into public.athlete_identity_membership(athlete_id,program_key) values(athlete_b,'demo-b') returning id into membership_b;
 begin perform coach_memory_private.read_memory(coach_a,membership_b); raise exception 'cross membership allowed'; exception when insufficient_privilege then null; end;
 begin perform coach_memory_private.read_memory(guardian_a,membership); raise exception 'guardian read coach memory'; exception when insufficient_privilege then null; end;
 update coach_memory_private.coach_grant set revoked_at=clock_timestamp() where id=grant_a;
 begin perform coach_memory_private.read_memory(coach_a,membership); raise exception 'revoked coach allowed'; exception when insufficient_privilege then null; end;
 raise notice 'PASS: enrollment scope, retry, guardian scope, coach scope, memory idempotency and revocation';
end $$;
rollback;
